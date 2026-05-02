from __future__ import annotations

from typing import Annotated, AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.adapters.sqlalchemy_folder_repo import SqlAlchemyFolderRepo
from app.adapters.sqlalchemy_trip_repo import SqlAlchemyTripRepo
from app.adapters.sqlalchemy_user_repo import SqlAlchemyUserRepo
from app.adapters.sqlalchemy_waitlist_repo import SqlAlchemyWaitlistRepo
from app.adapters.swiss_tourism_client import HttpxSwissTourismClient
from app.core.config import settings
from app.core.security import decode_token
from app.ports.repositories import (
    FolderRepository,
    TripRepository,
    UserRecord,
    UserRepository,
)
from app.ports.swiss_tourism import SwissTourismClient

engine = create_async_engine(settings.sqlalchemy_database_url, echo=False)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/users/login")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_user_repo(db: Annotated[AsyncSession, Depends(get_db)]) -> UserRepository:
    return SqlAlchemyUserRepo(db)


def get_trip_repo(db: Annotated[AsyncSession, Depends(get_db)]) -> TripRepository:
    return SqlAlchemyTripRepo(db)


def get_folder_repo(db: Annotated[AsyncSession, Depends(get_db)]) -> FolderRepository:
    return SqlAlchemyFolderRepo(db)


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    user_repo: Annotated[UserRepository, Depends(get_user_repo)],
) -> UserRecord:

    user_id = decode_token(token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    user = await user_repo.get_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    return user


def get_waitlist_repo(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SqlAlchemyWaitlistRepo:
    return SqlAlchemyWaitlistRepo(db)


def get_swiss_tourism_client() -> SwissTourismClient:
    if not settings.my_swiss_tourism_api:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Swiss Tourism API is not configured",
        )
    return HttpxSwissTourismClient(api_key=settings.my_swiss_tourism_api)


# Type aliases for route signatures
Db = Annotated[AsyncSession, Depends(get_db)]
UserRepo = Annotated[UserRepository, Depends(get_user_repo)]
TripRepo = Annotated[TripRepository, Depends(get_trip_repo)]
FolderRepo = Annotated[FolderRepository, Depends(get_folder_repo)]
CurrentUser = Annotated[UserRecord, Depends(get_current_user)]
WaitlistRepo = Annotated[SqlAlchemyWaitlistRepo, Depends(get_waitlist_repo)]
SwissTourism = Annotated[SwissTourismClient, Depends(get_swiss_tourism_client)]
