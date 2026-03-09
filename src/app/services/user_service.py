from app.core.security import create_token, hash_password, verify_password
from app.ports.repositories import UserRecord, UserRepository


class EmailAlreadyRegistered(Exception):
    pass


class InvalidCredentials(Exception):
    pass


async def register_user(
    repo: UserRepository, *, email: str, password: str, full_name: str
) -> UserRecord:
    if await repo.get_by_email(email):
        raise EmailAlreadyRegistered
    return await repo.create(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
    )


async def authenticate_user(repo: UserRepository, *, email: str, password: str) -> str:
    """Returns a JWT access token or raises InvalidCredentials."""
    user = await repo.get_by_email(email)
    if not user or not verify_password(password, user.hashed_password):
        raise InvalidCredentials
    return create_token(user.id)


async def update_preferences(
    repo: UserRepository, user_id: int, preferences: dict
) -> UserRecord:
    return await repo.update_preferences(user_id, preferences)
