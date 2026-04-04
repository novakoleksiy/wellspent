from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import engine
from app.models.user import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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
from app.api.public_settings import router as settings_router  # noqa: E402
from app.api.swiss_tourism import router as swiss_router  # noqa: E402
from app.api.trips import router as trips_router  # noqa: E402
from app.api.users import router as users_router  # noqa: E402
from app.api.waitlist import router as waitlist_router  # noqa: E402

app.include_router(users_router, prefix="/api")
app.include_router(trips_router, prefix="/api")
app.include_router(swiss_router, prefix="/api")
app.include_router(waitlist_router, prefix="/api")
app.include_router(settings_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
