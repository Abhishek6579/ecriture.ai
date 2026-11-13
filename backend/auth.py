"""Supabase JWT verification and verified-email enforcement."""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError, PyJWKClient

bearer_scheme = HTTPBearer(auto_error=False)


class AuthConfigurationError(RuntimeError):
    """Raised when required Supabase environment variables are missing."""


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise AuthConfigurationError(f"Missing required environment variable: {name}")
    return value


def _supabase_issuer() -> str:
    configured = os.getenv("SUPABASE_JWT_ISSUER", "").strip()
    if configured:
        return configured.rstrip("/")
    return f"{_required_env('SUPABASE_URL').rstrip('/')}/auth/v1"


@lru_cache(maxsize=4)
def _jwks_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url, cache_keys=True, lifespan=600)


def verify_access_token(token: str) -> dict[str, Any]:
    """Verify a Supabase access token using the project's signing key/JWKS."""
    supabase_url = _required_env("SUPABASE_URL").rstrip("/")
    issuer = _supabase_issuer()
    audience = os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated").strip() or "authenticated"

    try:
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg")
        if algorithm == "HS256":
            # Legacy Supabase projects may still use the shared JWT secret.
            key = _required_env("SUPABASE_JWT_SECRET")
        elif algorithm in {"ES256", "RS256", "EdDSA"}:
            jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
            key = _jwks_client(jwks_url).get_signing_key_from_jwt(token).key
        else:
            raise InvalidTokenError("Unsupported JWT signing algorithm.")

        claims = jwt.decode(
            token,
            key=key,
            algorithms=[algorithm],
            audience=audience,
            issuer=issuer,
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )
    except AuthConfigurationError:
        raise
    except Exception as exc:
        # PyJWKClient can raise network/key lookup exceptions that aren't
        # subclasses of InvalidTokenError. Treat all verification failures alike.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if not claims.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token has no subject.")
    return claims


def _load_verified_supabase_user(token: str) -> dict[str, Any]:
    """Ask Supabase Auth for the user record so email confirmation is authoritative."""
    supabase_url = _required_env("SUPABASE_URL").rstrip("/")
    anon_key = (os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip() or os.getenv("SUPABASE_ANON_KEY", "").strip())
    if not anon_key:
        raise AuthConfigurationError("Missing SUPABASE_PUBLISHABLE_KEY (or legacy SUPABASE_ANON_KEY).")
    try:
        response = httpx.get(
            f"{supabase_url}/auth/v1/user",
            headers={"apikey": anon_key, "Authorization": f"Bearer {token}"},
            timeout=8.0,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Could not verify the Supabase user. Try again shortly.") from exc

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="The Supabase session is no longer valid.")
    if response.is_error:
        raise HTTPException(status_code=503, detail="Supabase Auth verification is temporarily unavailable.")

    try:
        user = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail="Supabase Auth returned an invalid response.") from exc
    if not user.get("id"):
        raise HTTPException(status_code=401, detail="Supabase returned an invalid user record.")
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any]:
    """FastAPI dependency returning the verified Supabase user identity."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to use the OCR service.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        claims = verify_access_token(credentials.credentials)
        require_verified_email = os.getenv("REQUIRE_VERIFIED_EMAIL", "true").lower() in {"1", "true", "yes"}
        if require_verified_email:
            user = _load_verified_supabase_user(credentials.credentials)
            if str(user.get("id")) != str(claims["sub"]):
                raise HTTPException(status_code=401, detail="Access token user does not match the Supabase user.")
            if not user.get("email_confirmed_at"):
                raise HTTPException(status_code=403, detail="Verify your email address before using OCR.")
            return {"id": str(user["id"]), "email": user.get("email")}

        return {"id": str(claims["sub"]), "email": claims.get("email")}
    except AuthConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
