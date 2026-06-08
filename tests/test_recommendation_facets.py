from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi import HTTPException

from app.api import swiss_tourism as swiss_tourism_api
from app.ports.swiss_tourism import (
    FacetRecord,
    FacetSnapshotRecord,
    FacetValueRecord,
)
from app.services import recommendation_facets


class FakeFacetClient:
    def __init__(self, snapshot: FacetSnapshotRecord | None = None) -> None:
        self.snapshot = snapshot or _snapshot()

    async def get_attraction_facets(self) -> FacetSnapshotRecord:
        return self.snapshot


class FailingFacetClient:
    async def get_attraction_facets(self) -> FacetSnapshotRecord:
        raise RuntimeError("upstream failed")


def _snapshot() -> FacetSnapshotRecord:
    return FacetSnapshotRecord(
        object_type="attractions",
        language="en",
        fetched_at=datetime(2026, 6, 1, tzinfo=UTC),
        facets=[
            FacetRecord(
                name="experiencetype",
                title="Experience Type",
                values=[FacetValueRecord(name="nature", title="Nature", count=3)],
            )
        ],
    )


@pytest.mark.asyncio
async def test_refresh_attraction_facets_stores_snapshot(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(recommendation_facets, "_attraction_facets_snapshot", None)
    snapshot = _snapshot()

    result = await recommendation_facets.refresh_attraction_facets(
        FakeFacetClient(snapshot)
    )

    assert result == snapshot
    assert recommendation_facets.get_attraction_facets_snapshot() == snapshot


@pytest.mark.asyncio
async def test_refresh_attraction_facets_keeps_existing_snapshot_on_failure(
    monkeypatch: pytest.MonkeyPatch,
):
    snapshot = _snapshot()
    monkeypatch.setattr(
        recommendation_facets,
        "_attraction_facets_snapshot",
        snapshot,
    )

    result = await recommendation_facets.refresh_attraction_facets(FailingFacetClient())

    assert result == snapshot
    assert recommendation_facets.get_attraction_facets_snapshot() == snapshot


@pytest.mark.asyncio
async def test_get_attraction_facets_endpoint_returns_cached_snapshot(
    monkeypatch: pytest.MonkeyPatch,
):
    snapshot = _snapshot()
    monkeypatch.setattr(
        swiss_tourism_api,
        "get_attraction_facets_snapshot",
        lambda: snapshot,
    )

    result = await swiss_tourism_api.get_attraction_facets(object())

    assert result.object_type == "attractions"
    assert result.facets[0].name == "experiencetype"
    assert result.facets[0].values[0].name == "nature"


@pytest.mark.asyncio
async def test_get_attraction_facets_endpoint_rejects_missing_snapshot(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(
        swiss_tourism_api,
        "get_attraction_facets_snapshot",
        lambda: None,
    )

    with pytest.raises(HTTPException) as exc_info:
        await swiss_tourism_api.get_attraction_facets(object())

    assert exc_info.value.status_code == 503
