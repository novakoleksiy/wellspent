# AGENTS.md

## Purpose

This file is for coding agents working in `/Users/oleksiy/projects/wellspent`.
Follow the checked-in project configuration first, then use this file as the repository-specific operating guide.

## Repository Summary

- Project: Wellspent, a Swiss travel recommendation app.
- Backend: FastAPI, async SQLAlchemy, SQLite, `uv` for dependency and command management.
- Frontend: React 19, TypeScript, Vite, ESLint.
- Architecture: backend uses Ports and Adapters (hexagonal architecture).

## Rule Files Present

- `CLAUDE.md` exists at the repo root and contains useful project guidance.
- No `.cursorrules` file is present.
- No `.cursor/rules/` directory is present.
- No `.github/copilot-instructions.md` file is present.
- Because there are no Cursor or Copilot rule files, rely on repository code, config, and this file.

## Working Directories

- Backend commands run from the repository root.
- Frontend commands run from `frontend/` unless stated otherwise.
- The backend expects imports relative to `src`, as configured in pytest.

## Environment

- Python requirement: `>=3.12`.
- Main backend env var: `MY_SWISS_TOURISM_API` in `.env`.
- Default database URL: `sqlite+aiosqlite:///./travel.db`.
- Default JWT algorithm: `HS256`.
- Settings are loaded via `pydantic-settings` from `.env`.

## Backend Setup And Run

- Install backend dependencies: `uv sync --group dev`
- Run backend dev server: `uv run uvicorn src.app.main:app --reload`
- Alternative README command seen in repo: `uvicorn src.app.main:app --reload`
- Prefer the `uv run ...` form so the managed environment is used consistently.

## Backend Tests

- Run all backend tests: `uv run pytest tests/`
- Run a single test file: `uv run pytest tests/test_swiss_tourism_client.py`
- Run a single test function: `uv run pytest tests/test_swiss_tourism_client.py::test_list_destinations`
- Run tests matching a keyword: `uv run pytest tests/ -k destinations`

## Backend Lint

- Run backend lint/import ordering: `uv run ruff check .`
- The only checked-in Ruff rule set currently enables import sorting (`I`).
- Do not assume Black, isort, mypy, or pyright are part of the current workflow unless added later.

## Frontend Setup And Run

- Install frontend dependencies: `npm install`
- Run frontend dev server: `npm run dev`
- Build frontend: `npm run build`
- Lint frontend: `npm run lint`
- Preview production build: `npm run preview`

## Frontend TypeScript Constraints

- TypeScript is in `strict` mode.
- `noUnusedLocals` and `noUnusedParameters` are enabled.
- `noFallthroughCasesInSwitch` is enabled.
- `noEmit` is enabled for app compilation.
- If you add code, make it pass `npm run build`, not just ESLint.

## Backend Architecture Rules

- Keep business logic in `src/app/services/`.
- Keep external integrations and persistence details in `src/app/adapters/`.
- Keep interfaces and pure domain records in `src/app/ports/`.
- Keep HTTP routing concerns in `src/app/api/`.
- Keep SQLAlchemy ORM models in `src/app/models/`.
- Keep request/response Pydantic models in `src/app/schemas/`.
- Keep config, DB session wiring, and security helpers in `src/app/core/`.

## Dependency Injection Rules

- FastAPI dependencies are centralized in `app.core.db`.
- Prefer the existing `Annotated[...]` aliases such as `CurrentUser`, `UserRepo`, `TripRepo`, and `SwissTourism` in route signatures.
- Do not duplicate dependency wiring inside individual route modules unless there is a concrete need.

## Backend Coding Style

- Follow existing file formatting instead of introducing a new formatter style.
- Use `snake_case` for functions, variables, and module names.
- Use `PascalCase` for classes, dataclasses, Pydantic models, and exceptions.
- Use `UPPER_SNAKE_CASE` for module-level constants such as API base URLs.
- Prefer explicit type annotations on public functions and service boundaries.
- Use `from __future__ import annotations` where the file already uses it or where forward references help readability.
- Keep functions small and direct; avoid adding abstractions that are not used.
- Prefer keyword-only parameters when the existing service API pattern already uses them.

## Imports And Formatting

- Keep imports grouped in standard library, third-party, then local application imports.
- Let Ruff import-order rules drive final ordering.
- Preserve the current quote and formatting style already used in each area of the repo.
- Do not reformat unrelated files just to normalize style.

## Types And Data Modeling

- Use `Protocol` in `ports/` for repository and adapter interfaces.
- Use dataclasses for domain records in `ports/`.
- Use Pydantic `BaseModel` for API request/response schemas.
- Return domain records from repositories and services, not ORM objects unless the existing API already does so indirectly.
- Keep transport-layer models and domain models separate.

## Error Handling

- Raise typed domain exceptions in the service layer, for example `EmailAlreadyRegistered` or `TripNotFound`.
- Translate domain exceptions to `HTTPException` in the API layer.
- Keep HTTP-specific concerns out of lower layers when possible.
- For auth and dependency failures, follow the existing `HTTPException(status_code=..., detail=...)` pattern in `core/db.py`.
- In DB session management, allow exceptions to trigger rollback and then re-raise.

## Async And I/O

- Backend I/O paths are async; keep route handlers and adapter calls async.
- Use async SQLAlchemy sessions via the shared session factory.
- Use `httpx.AsyncClient` for outbound HTTP.
- Avoid blocking calls inside request handlers or async services.

## API Conventions

- Keep routers focused on request parsing, dependency injection, and response shaping.
- Use `response_model` on FastAPI routes as the existing code does.
- Prefer returning typed schema objects or values directly rather than building ad hoc dicts in routers.
- Keep route prefixes and tags consistent with the current module organization.

## Frontend Coding Style

- Use `PascalCase` for page and component files.
- Use `camelCase` for functions, variables, and helpers.
- Keep API calls in `frontend/src/api/`.
- Keep shared types in `frontend/src/types.ts` unless a new module split is clearly warranted.
- Use TypeScript types for component props and API results.
- Handle caught errors as `unknown` and narrow with `instanceof Error`, matching current code.
- Prefer simple stateful React function components over unnecessary abstractions.

## Frontend React Conventions

- The app currently uses function components, hooks, and React Router.
- Authentication state is provided through `AuthProvider` and `useAuth`.
- Preserve the existing route-guard pattern with `RequireAuth` and `PublicOnly` unless intentionally refactoring it.
- Keep fetch logic centralized through the shared `request<T>()` helper.
- When adding pages, follow the existing route registration style in `frontend/src/App.tsx`.

## Naming Conventions

- Backend service functions are action-oriented, for example `register_user`, `authenticate_user`, `create_trip`.
- Repository implementations are named by technology, for example `SqlAlchemyUserRepo`.
- Adapters should describe the external system or integration they wrap.
- Tests should use descriptive names that state expected behavior.

## Testing Conventions

- Use `pytest` and `pytest-asyncio` for backend tests.
- Use `@pytest.mark.asyncio` for async tests.
- Use `respx` to mock outbound HTTP requests to the Swiss Tourism API.
- Follow the existing test style: focused payload setup, one behavior per test, and direct assertions.
- Add or update tests when changing adapter parsing, request params, or service behavior.

## Change Management For Agents

- Make the smallest correct change.
- Prefer extending existing modules over creating new layers without a clear benefit.
- Do not add backward-compatibility code unless there is an actual compatibility requirement.
- Do not silently change architecture boundaries.
- If a convention is unclear, inspect nearby files and match them.

## Verification Expectations

- For backend-only changes, run `uv run ruff check .` and the smallest relevant `uv run pytest ...` command.
- For frontend-only changes, run `npm run lint` and `npm run build` in `frontend/`.
- For cross-stack changes, run both backend and frontend verification relevant to the touched code.
- If you cannot run a command, state that explicitly in your handoff.

## Practical Notes

- The backend creates database tables on startup in the FastAPI lifespan handler.
- CORS is currently configured for `http://localhost:3000` and `http://localhost:5173`.
- The checked-in README is minimal, so prefer this file plus the code itself for guidance.
- When in doubt, preserve existing patterns instead of introducing a new house style.
