# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Backend** — `uv` is the primary tool for running and managing the backend:
```bash
uv sync --group dev                        # Install dependencies
uv run uvicorn src.app.main:app --reload   # Run dev server
uv run ruff check .                        # Lint + import sorting
uv run ruff check --fix .                  # Apply safe lint fixes
uv run ruff format .                       # Format Python files
uv run ruff format --check .               # Check formatting in CI
uv run pytest tests/                       # Run all tests
uv run pytest tests/test_foo.py::test_bar  # Run single test
```

**Frontend** (in `frontend/`)
```bash
npm run dev    # Dev server at http://localhost:5173
npm run build
npm run lint
```

**Environment**: create `.env` with `DATABASE_URL`, `SECRET_KEY`, and `CORS_ORIGINS`. `MY_SWISS_TOURISM_API` is optional and only needed for recommendation endpoints. `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, and `REGISTRATION_OPEN` still have defaults.

## Architecture

Wellspent is a Swiss travel recommendation app. A FastAPI backend + React frontend. The backend follows **Ports & Adapters** (Hexagonal Architecture):

- `ports/` — Python `Protocol` interfaces + pure domain dataclasses (`UserRecord`, `TripRecord`, `DestinationRecord`, etc.)
- `adapters/` — Concrete implementations: SQLAlchemy repos + `HttpxSwissTourismClient` (wraps [MySwitzerland OpenData API](https://opendata.myswitzerland.io))
- `services/` — Business logic only; raises typed domain exceptions (`EmailAlreadyRegistered`, `TripNotFound`, etc.)
- `api/` — FastAPI routers; catch domain exceptions and map to HTTP errors
- `models/` — SQLAlchemy ORM models (separate from domain dataclasses)
- `schemas/` — Pydantic request/response models
- `core/` — Config (pydantic-settings), DB engine/session, security (bcrypt + JWT)

**Dependency injection** via FastAPI `Depends`. `core/db.py` exposes type aliases used directly in route signatures: `CurrentUser`, `UserRepo`, `TripRepo`, `SwissTourism`.

**Database**: SQLite via SQLAlchemy async + aiosqlite. Schema created on startup.

**Recommendation engine** (`services/recommendation_service.py`): fetches candidate destinations from Swiss API, scores against user's `travel_styles` via `_STYLE_KEYWORDS`, picks top 2, concurrently fetches attractions + tours, builds a day-by-day itinerary respecting `pace` (relaxed/moderate/packed → 2/3/4 activities/day) and `budget_tier`.

## Testing

Uses `pytest` + `pytest-asyncio` + `respx` (httpx mock library). Mock the Swiss API using `@respx.mock` decorator — see `tests/test_swiss_tourism_client.py` for patterns.
