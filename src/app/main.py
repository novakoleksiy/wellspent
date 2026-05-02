import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.adapters.swiss_tourism_client import SwissTourismAuthError
from app.core.config import settings
from app.core.db import engine
from app.models.user import Base

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Running database migrations (create_all)...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                "ALTER TABLE trips ADD COLUMN IF NOT EXISTS shared_at TIMESTAMP WITH TIME ZONE"
            )
        )
        await conn.execute(
            text("ALTER TABLE trips ADD COLUMN IF NOT EXISTS folder_id INTEGER")
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_trips_folder_id ON trips (folder_id)")
        )
        await conn.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'trips_folder_id_fkey'
                    ) THEN
                        ALTER TABLE trips
                        ADD CONSTRAINT trips_folder_id_fkey
                        FOREIGN KEY (folder_id) REFERENCES folders (id)
                        ON DELETE SET NULL;
                    END IF;
                END
                $$
                """
            )
        )
    logger.info("Database tables ready.")
    yield
    await engine.dispose()


app = FastAPI(title="Travel Recommender", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
from app.api.folders import router as folders_router  # noqa: E402
from app.api.public_settings import router as settings_router  # noqa: E402
from app.api.swiss_tourism import router as swiss_router  # noqa: E402
from app.api.trips import router as trips_router  # noqa: E402
from app.api.users import router as users_router  # noqa: E402
from app.api.waitlist import router as waitlist_router  # noqa: E402

app.include_router(users_router, prefix="/api")
app.include_router(trips_router, prefix="/api")
app.include_router(folders_router, prefix="/api")
app.include_router(swiss_router, prefix="/api")
app.include_router(waitlist_router, prefix="/api")
app.include_router(settings_router, prefix="/api")


@app.exception_handler(SwissTourismAuthError)
async def handle_swiss_tourism_auth_error(request: Request, exc: SwissTourismAuthError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.get("/health")
async def health():
    return {"status": "ok"}
