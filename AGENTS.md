# AGENTS.md

Use checked-in config and nearby code as the source of truth. This file only covers repo-specific essentials.

## Stack

- Wellspent is a Swiss travel recommendation app.
- Backend: FastAPI, async SQLAlchemy, PostgreSQL, `uv`.
- Frontend: React 19, TypeScript, Vite.
- Backend architecture follows Ports and Adapters.

## Working Directories

- Run backend commands from the repository root.
- Run frontend commands from `frontend/`.

## Environment

- Python: `>=3.12`
- Main backend env var: `MY_SWISS_TOURISM_API`
- Default DB URL: `postgresql+asyncpg://postgres:postgres@localhost:5432/wellspent`

## Local Run

- Start Postgres: `docker-compose up -d postgres`
- Install backend deps: `uv sync --group dev`
- Run backend: `uv run uvicorn src.app.main:app --reload`
- Install frontend deps: `npm install`
- Run frontend: `npm run dev`

## Backend Structure

- `src/app/api/`: FastAPI routes
- `src/app/services/`: business logic
- `src/app/adapters/`: DB and external integrations
- `src/app/ports/`: interfaces and domain records
- `src/app/models/`: SQLAlchemy models
- `src/app/schemas/`: request and response schemas
- `src/app/core/`: config, DB wiring, security

## Backend Rules

- Keep business logic in `services`, not routes.
- Keep HTTP concerns in `api`.
- Keep external I/O and persistence in `adapters`.
- Prefer existing dependency aliases from `app.core.db`.
- Keep backend code async end-to-end.

## Frontend Rules

- Keep API calls in `frontend/src/api/`.
- Keep shared types in `frontend/src/types.ts` unless a clear split is needed.
- Follow existing auth and route-guard patterns.

## Verification

- Backend-only changes: `uv run ruff check .`, `uv run ruff format --check .`, and the smallest relevant `uv run pytest ...`
- Frontend-only changes: `npm run lint` and `npm run build` in `frontend/`
- Cross-stack changes: run both sets of checks
