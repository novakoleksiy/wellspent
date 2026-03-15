from __future__ import annotations

from typing import Annotated, AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.adapters.sqlalchemy_trip_repo import SqlAlchemyTripRepo
from app.adapters.sqlalchemy_user_repo import SqlAlchemyUserRepo
from app.adapters.swiss_tourism_client import HttpxSwissTourismClient
from app.core.config import settings
from app.core.security import decode_token
from app.ports.repositories import UserRecord

engine = create_async_engine(settings.database_url, echo=False)
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


def get_user_repo(db: Annotated[AsyncSession, Depends(get_db)]) -> SqlAlchemyUserRepo:
    return SqlAlchemyUserRepo(db)


def get_trip_repo(db: Annotated[AsyncSession, Depends(get_db)]) -> SqlAlchemyTripRepo:
    return SqlAlchemyTripRepo(db)


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    user_repo: Annotated[SqlAlchemyUserRepo, Depends(get_user_repo)],
):

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


def get_swiss_tourism_client() -> HttpxSwissTourismClient:
    return HttpxSwissTourismClient(api_key=settings.my_swiss_tourism_api)


# Type aliases for route signatures
Db = Annotated[AsyncSession, Depends(get_db)]
UserRepo = Annotated[SqlAlchemyUserRepo, Depends(get_user_repo)]
TripRepo = Annotated[SqlAlchemyTripRepo, Depends(get_trip_repo)]
CurrentUser = Annotated[UserRecord, Depends(get_current_user)]
SwissTourism = Annotated[HttpxSwissTourismClient, Depends(get_swiss_tourism_client)]
