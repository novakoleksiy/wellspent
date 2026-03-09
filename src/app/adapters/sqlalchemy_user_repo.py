from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.ports.repositories import UserRecord


def _to_record(user: User) -> UserRecord:
    return UserRecord(
        id=user.id,
        email=user.email,
        hashed_password=user.hashed_password,
        full_name=user.full_name,
        preferences=user.preferences,
        created_at=user.created_at,
    )


class SqlAlchemyUserRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: int) -> UserRecord | None:
        result = await self._session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        return _to_record(user) if user else None

    async def get_by_email(self, email: str) -> UserRecord | None:
        result = await self._session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        return _to_record(user) if user else None

    async def create(
        self, *, email: str, hashed_password: str, full_name: str
    ) -> UserRecord:
        user = User(email=email, hashed_password=hashed_password, full_name=full_name)
        self._session.add(user)
        await self._session.flush()
        await self._session.refresh(user)
        return _to_record(user)

    async def update_preferences(self, user_id: int, preferences: dict) -> UserRecord:
        result = await self._session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one()
        user.preferences = preferences
        self._session.add(user)
        await self._session.flush()
        await self._session.refresh(user)
        return _to_record(user)
