# Wellspent

## Local Postgres setup

1. Start PostgreSQL (requires Docker; on Mac without Docker Desktop use [Colima](https://github.com/abiosoft/colima)):

```bash
# Mac without Docker Desktop
brew install colima docker docker-compose
colima start

docker-compose up -d postgres
```

2. Create a backend `.env` from `.env.example` and set your Swiss Tourism API key.

3. Install backend dependencies:

```bash
uv sync --group dev
```

4. Run the backend:

```bash
uv run uvicorn src.app.main:app --reload
```

The backend creates tables automatically on startup for a fresh MVP database.

## Frontend setup

1. Create `frontend/.env` from `frontend/.env.example`.

2. Install and run the frontend from `frontend/`:

```bash
npm install
npm run dev
```

## Backend quality checks

```bash
uv run ruff check .
uv run ruff format --check .
uv run pytest tests/
```

## Frontend quality checks

```bash
npm run lint
npm run build
```

## Production env vars

Backend:

```bash
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/DBNAME
SECRET_KEY=replace-me
MY_SWISS_TOURISM_API=replace-me
CORS_ORIGINS=https://your-frontend-domain
```

Frontend:

```bash
VITE_API_BASE_URL=https://your-backend-domain
```
