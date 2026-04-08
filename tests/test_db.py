from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.adapters.swiss_tourism_client import HttpxSwissTourismClient
from app.core.config import settings
from app.core.db import get_swiss_tourism_client


def test_get_swiss_tourism_client_requires_api_key(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "my_swiss_tourism_api", "")

    with pytest.raises(HTTPException) as exc_info:
        get_swiss_tourism_client()

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "Swiss Tourism API is not configured"


def test_get_swiss_tourism_client_returns_httpx_client(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(settings, "my_swiss_tourism_api", "test-key")

    client = get_swiss_tourism_client()

    assert isinstance(client, HttpxSwissTourismClient)


def test_sqlalchemy_database_url_normalizes_render_postgres_url(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(
        settings,
        "database_url",
        "postgresql://user:pass@render-host:5432/wellspent",
    )

    assert (
        settings.sqlalchemy_database_url
        == "postgresql+asyncpg://user:pass@render-host:5432/wellspent"
    )


def test_sqlalchemy_database_url_preserves_asyncpg_driver(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(
        settings,
        "database_url",
        "postgresql+asyncpg://user:pass@render-host:5432/wellspent",
    )

    assert (
        settings.sqlalchemy_database_url
        == "postgresql+asyncpg://user:pass@render-host:5432/wellspent"
    )
