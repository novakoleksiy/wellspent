from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import WaitlistEntry
from app.ports.repositories import WaitlistEntryRecord


def _to_record(entry: WaitlistEntry) -> WaitlistEntryRecord:
    return WaitlistEntryRecord(
        id=entry.id,
        email=entry.email,
        name=entry.name,
        created_at=entry.created_at,
    )


class SqlAlchemyWaitlistRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_email(self, email: str) -> WaitlistEntryRecord | None:
        result = await self._session.execute(
            select(WaitlistEntry).where(WaitlistEntry.email == email)
        )
        entry = result.scalar_one_or_none()
        return _to_record(entry) if entry else None

    async def create(
        self, *, email: str, name: str | None = None
    ) -> WaitlistEntryRecord:
        entry = WaitlistEntry(email=email, name=name)
        self._session.add(entry)
        await self._session.flush()
        await self._session.refresh(entry)
        return _to_record(entry)
