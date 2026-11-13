from __future__ import annotations

import jwt
import pytest
from fastapi import HTTPException

from auth import verify_access_token


def _token(secret: str, *, subject: str = "user-123", audience: str = "authenticated") -> str:
    return jwt.encode(
        {
            "sub": subject,
            "iss": "https://project.supabase.co/auth/v1",
            "aud": audience,
            "iat": 1_700_000_000,
            "exp": 4_000_000_000,
            "email": "user@example.com",
        },
        secret,
        algorithm="HS256",
    )


def test_verify_access_token_accepts_valid_legacy_hs256_token(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setenv("SUPABASE_JWT_ISSUER", "https://project.supabase.co/auth/v1")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-signing-secret-with-more-than-thirty-two-bytes")
    claims = verify_access_token(_token("test-signing-secret-with-more-than-thirty-two-bytes"))
    assert claims["sub"] == "user-123"


def test_verify_access_token_rejects_wrong_signature(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setenv("SUPABASE_JWT_ISSUER", "https://project.supabase.co/auth/v1")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "correct-secret-with-more-than-thirty-two-bytes")
    with pytest.raises(HTTPException) as error:
        verify_access_token(_token("wrong-secret-with-more-than-thirty-two-bytes"))
    assert error.value.status_code == 401


def test_verify_access_token_requires_expected_audience(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setenv("SUPABASE_JWT_ISSUER", "https://project.supabase.co/auth/v1")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-signing-secret-with-more-than-thirty-two-bytes")
    with pytest.raises(HTTPException) as error:
        verify_access_token(_token("test-signing-secret-with-more-than-thirty-two-bytes", audience="anon"))
    assert error.value.status_code == 401
