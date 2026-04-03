from app.ports.repositories import WaitlistEntryRecord, WaitlistRepository


class AlreadyOnWaitlist(Exception):
    pass


async def join_waitlist(
    repo: WaitlistRepository, *, email: str, name: str | None = None
) -> WaitlistEntryRecord:
    if await repo.get_by_email(email):
        raise AlreadyOnWaitlist
    return await repo.create(email=email, name=name)
