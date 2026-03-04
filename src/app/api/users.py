from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.db import CurrentUser, Db
from app.core.security import create_token, hash_password, verify_password
from app.models.user import User
from app.schemas.schemas import (
    LoginRequest,
    Preferences,
    RegisterRequest,
    Token,
    UserOut,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/register", response_model=UserOut, status_code=201)
async def register(body: RegisterRequest, db: Db):
    exists = await db.execute(select(User).where(User.email == body.email))
    if exists.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(body: LoginRequest, db: Db):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "Bad credentials")
    return Token(access_token=create_token(user.id))


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser):
    return user


@router.put("/me/preferences", response_model=UserOut)
async def update_preferences(prefs: Preferences, user: CurrentUser, db: Db):
    user.preferences = prefs.model_dump()
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user
