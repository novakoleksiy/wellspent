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

### Verify the database

```bash
# Ping Postgres and list all tables
docker exec -it wellspent-postgres-1 psql -U postgres -d wellspent -c "\dt"

# Check a specific table
docker exec -it wellspent-postgres-1 psql -U postgres -d wellspent -c "SELECT * FROM users LIMIT 5;"

# Interactive psql shell
docker exec -it wellspent-postgres-1 psql -U postgres -d wellspent
```

If the container name differs, find it with `docker ps`.

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
REGISTRATION_OPEN=false
```

Frontend:

```bash
VITE_API_BASE_URL=https://your-backend-domain
```

## Deploy to Render + Vercel

### Backend on Render

1. Create a Render Blueprint from `render.yaml`.
2. Set the required environment variables when prompted:
   - `DATABASE_URL`
   - `CORS_ORIGINS`
3. Leave `REGISTRATION_OPEN=false` for a waitlist-only launch.
4. Use `/health` as the health check path.
5. Add `MY_SWISS_TOURISM_API` only when you are ready to enable the recommendation endpoints.

Render commonly provides Postgres URLs in `postgres://` or `postgresql://` format. The app normalizes those to `postgresql+asyncpg://` automatically for SQLAlchemy.

### Frontend on Vercel

1. Set the Vercel project root directory to `frontend/`.
2. Set `VITE_API_BASE_URL` to your Render backend URL.
3. Set `frontend/vercel.json` rewrites so client-side routes like `/login` and `/trips` resolve to `index.html`.

### Launch checklist

1. Confirm the landing page loads from Vercel.
2. Confirm waitlist submissions succeed against the Render backend.
3. Confirm duplicate waitlist emails show the friendly error state.
4. Confirm `/register` redirects to `/` while registration is closed.
5. Confirm `/login` remains available for existing users.
