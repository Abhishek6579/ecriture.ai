from __future__ import annotations

import os
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest

DATABASE_URL = os.getenv("TEST_DATABASE_URL", "").strip()
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="TEST_DATABASE_URL is not configured")

if DATABASE_URL:
    import psycopg
else:  # Keep local unit tests lightweight when PostgreSQL isn't running.
    psycopg = None


def create_auth_user() -> str:
    user_id = str(uuid.uuid4())
    with psycopg.connect(DATABASE_URL) as connection:
        connection.execute("insert into auth.users (id) values (%s)", (user_id,))
    return user_id


def reserve(user_id: str, limit: int = 5, global_limit: int = 0):
    with psycopg.connect(DATABASE_URL) as connection:
        return connection.execute(
            "select * from public.reserve_scan(%s, %s, %s)",
            (user_id, limit, global_limit),
        ).fetchone()


def test_scan_allowance_stops_exactly_at_the_limit():
    user_id = create_auth_user()
    first = reserve(user_id, limit=2)
    second = reserve(user_id, limit=2)
    third = reserve(user_id, limit=2)

    assert first[0] is True
    assert second[0] is True
    assert third[0] is False
    assert third[1] == "user_quota_exceeded"
    assert third[3] == 2
    assert third[5] == 0


def test_parallel_requests_cannot_spend_the_same_last_scan():
    user_id = create_auth_user()
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(lambda _index: reserve(user_id, limit=1), range(10)))

    assert sum(1 for result in results if result[0]) == 1
    assert sum(1 for result in results if result[1] == "user_quota_exceeded") == 9


def test_refund_releases_the_user_scan_reservation():
    user_id = create_auth_user()
    reservation = reserve(user_id, limit=1)
    assert reservation[0] is True

    with psycopg.connect(DATABASE_URL) as connection:
        refunded = connection.execute(
            "select public.refund_scan(%s)", (reservation[6],)
        ).fetchone()[0]
        usage = connection.execute(
            "select scans_used from public.profiles where user_id = %s", (user_id,)
        ).fetchone()[0]

    assert refunded is True
    assert usage == 0


def test_global_daily_circuit_breaker_blocks_new_users_after_cap():
    first_user = create_auth_user()
    second_user = create_auth_user()
    first = reserve(first_user, limit=5, global_limit=1)
    second = reserve(second_user, limit=5, global_limit=1)

    assert first[0] is True
    assert second[0] is False
    assert second[1] == "global_daily_limit"
