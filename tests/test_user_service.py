from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone

import pytest

from app.core.security import hash_password
from app.ports.repositories import UserRecord
from app.services import user_service


class FakeUserRepo:
    def __init__(self, users: list[UserRecord] | None = None) -> None:
        self.users = {user.id: user for user in users or []}
        self.users_by_email = {user.email: user for user in users or []}
        self.next_id = max(self.users, default=0) + 1

    async def get_by_id(self, user_id: int) -> UserRecord | None:
        return self.users.get(user_id)

    async def get_by_email(self, email: str) -> UserRecord | None:
        return self.users_by_email.get(email)

    async def create(
        self, *, email: str, hashed_password: str, full_name: str
    ) -> UserRecord:
        user = UserRecord(
            id=self.next_id,
            email=email,
            hashed_password=hashed_password,
            full_name=full_name,
            preferences=None,
            created_at=datetime.now(timezone.utc),
        )
        self.next_id += 1
        self.users[user.id] = user
        self.users_by_email[user.email] = user
        return user

    async def update_preferences(self, user_id: int, preferences: dict) -> UserRecord:
        user = replace(self.users[user_id], preferences=preferences)
        self.users[user_id] = user
        self.users_by_email[user.email] = user
        return user


def _user_record(*, user_id: int = 1, email: str = "user@example.com") -> UserRecord:
    return UserRecord(
        id=user_id,
        email=email,
        hashed_password=hash_password("secret123"),
        full_name="Test User",
        preferences=None,
        created_at=datetime.now(timezone.utc),
    )


@pytest.mark.asyncio
async def test_register_user_hashes_password_and_persists_user():
    repo = FakeUserRepo()

    user = await user_service.register_user(
        repo,
        email="new@example.com",
        password="plain-text-password",
        full_name="New User",
    )

    assert user.email == "new@example.com"
    assert user.full_name == "New User"
    assert user.hashed_password != "plain-text-password"


@pytest.mark.asyncio
async def test_register_user_rejects_duplicate_email():
    repo = FakeUserRepo(users=[_user_record()])

    with pytest.raises(user_service.EmailAlreadyRegistered):
        await user_service.register_user(
            repo,
            email="user@example.com",
            password="secret123",
            full_name="Duplicate User",
        )


@pytest.mark.asyncio
async def test_authenticate_user_returns_token_for_valid_credentials(
    monkeypatch: pytest.MonkeyPatch,
):
    repo = FakeUserRepo(users=[_user_record()])
    monkeypatch.setattr(
        user_service, "create_token", lambda user_id: f"token-for-{user_id}"
    )

    token = await user_service.authenticate_user(
        repo,
        email="user@example.com",
        password="secret123",
    )

    assert token == "token-for-1"


@pytest.mark.asyncio
async def test_authenticate_user_rejects_bad_credentials():
    repo = FakeUserRepo(users=[_user_record()])

    with pytest.raises(user_service.InvalidCredentials):
        await user_service.authenticate_user(
            repo,
            email="user@example.com",
            password="wrong-password",
        )


@pytest.mark.asyncio
async def test_update_preferences_stores_new_preferences():
    repo = FakeUserRepo(users=[_user_record()])

    user = await user_service.update_preferences(
        repo,
        1,
        {"pace": "packed", "travel_styles": ["cultural"]},
    )

    assert user.preferences == {"pace": "packed", "travel_styles": ["cultural"]}
