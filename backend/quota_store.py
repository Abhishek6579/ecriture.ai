"""Small Supabase PostgREST RPC client for atomic scan-quota operations."""
from __future__ import annotations

import os
from typing import Any

import httpx


class QuotaStoreError(RuntimeError):
    """Raised when the Supabase quota database is unavailable or misconfigured."""


def _rpc(function_name: str, payload: dict[str, Any]) -> Any:
    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    # Prefer the current Supabase secret API key. Legacy service_role JWT keys
    # remain supported for existing projects during migration.
    secret_key = os.getenv("SUPABASE_SECRET_KEY", "").strip()
    legacy_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    api_key = secret_key or legacy_service_role_key
    if not supabase_url or not api_key:
        raise QuotaStoreError("SUPABASE_URL and SUPABASE_SECRET_KEY must be configured.")

    headers = {
        "apikey": api_key,
        "Content-Type": "application/json",
    }
    # New sb_secret_* keys are API keys, not JWTs: do not put them in the
    # Authorization header. Legacy service_role keys are JWTs and can be used
    # in both headers.
    if not secret_key and legacy_service_role_key:
        headers["Authorization"] = f"Bearer {legacy_service_role_key}"

    try:
        response = httpx.post(
            f"{supabase_url}/rest/v1/rpc/{function_name}",
            headers=headers,
            json=payload,
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        raise QuotaStoreError("Could not reach the Supabase database.") from exc

    if response.is_error:
        # Keep database internals and secrets out of client-facing errors/logs.
        raise QuotaStoreError(f"Supabase quota RPC {function_name} failed with HTTP {response.status_code}.")
    try:
        return response.json()
    except ValueError as exc:
        raise QuotaStoreError(f"Supabase quota RPC {function_name} returned invalid JSON.") from exc


def _first_row(result: Any) -> dict[str, Any]:
    if isinstance(result, list) and result and isinstance(result[0], dict):
        return result[0]
    if isinstance(result, dict):
        return result
    raise QuotaStoreError("Supabase quota RPC returned an unexpected response shape.")


def get_usage(user_id: str) -> dict[str, Any]:
    result = _rpc(
        "get_scan_usage",
        {
            "p_user_id": user_id,
            "p_default_scan_limit": max(0, int(os.getenv("FREE_SCAN_LIMIT", "5"))),
        },
    )
    return _first_row(result)


def reserve_scan(user_id: str) -> dict[str, Any]:
    result = _rpc(
        "reserve_scan",
        {
            "p_user_id": user_id,
            "p_default_scan_limit": max(0, int(os.getenv("FREE_SCAN_LIMIT", "5"))),
            "p_global_daily_limit": max(0, int(os.getenv("GLOBAL_DAILY_SCAN_LIMIT", "0"))),
        },
    )
    return _first_row(result)


def finish_scan(reservation_id: str, characters: int) -> bool:
    result = _rpc(
        "finish_scan",
        {"p_reservation_id": reservation_id, "p_characters": max(0, characters)},
    )
    return result is True


def refund_scan(reservation_id: str) -> bool:
    result = _rpc("refund_scan", {"p_reservation_id": reservation_id})
    return result is True
