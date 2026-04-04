from fastapi import APIRouter, HTTPException
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.db import CurrentUser, UserRepo
from app.schemas.schemas import (
    LoginRequest,
    Preferences,
    RegisterRequest,
    Token,
    UserOut,
)
from app.services.user_service import (
    EmailAlreadyRegistered,
    InvalidCredentials,
    RegistrationClosed,
    authenticate_user,
    register_user,
    update_preferences,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/register", response_model=UserOut, status_code=201)
async def register(body: RegisterRequest, repo: UserRepo):
    try:
        return await register_user(
            repo,
            email=body.email,
            password=body.password,
            full_name=body.full_name,
            registration_open=settings.registration_open,
        )
    except RegistrationClosed:
        raise HTTPException(403, "Registration is currently closed")
    except EmailAlreadyRegistered:
        raise HTTPException(400, "Email already registered")
    except IntegrityError as exc:
        raise HTTPException(400, "Email already registered") from exc


@router.post("/login", response_model=Token)
async def login(body: LoginRequest, repo: UserRepo):
    try:
        access_token = await authenticate_user(
            repo, email=body.email, password=body.password
        )
    except InvalidCredentials:
        raise HTTPException(401, "Bad credentials")
    return Token(access_token=access_token)


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser):
    return user


@router.put("/me/preferences", response_model=UserOut)
async def update_prefs(prefs: Preferences, user: CurrentUser, repo: UserRepo):
    return await update_preferences(repo, user.id, prefs.model_dump())
