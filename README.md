# Wellspent

## Backend setup

```bash
uv sync --group dev
```

## Running the server

```bash
uv run uvicorn src.app.main:app --reload
```

## Backend quality checks

```bash
uv run ruff check .
uv run ruff check --fix .
uv run ruff format .
uv run ruff format --check .
uv run pytest tests/
```
