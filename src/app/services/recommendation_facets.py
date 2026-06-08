from __future__ import annotations

import logging

from app.ports.swiss_tourism import FacetSnapshotRecord, SwissTourismClient

logger = logging.getLogger(__name__)

_attraction_facets_snapshot: FacetSnapshotRecord | None = None


async def refresh_attraction_facets(
    client: SwissTourismClient,
) -> FacetSnapshotRecord | None:
    global _attraction_facets_snapshot

    try:
        _attraction_facets_snapshot = await client.get_attraction_facets()
    except Exception:
        logger.exception("Failed to refresh Swiss Tourism attraction facets")
        return _attraction_facets_snapshot

    logger.info(
        "Refreshed %s Swiss Tourism attraction facets",
        len(_attraction_facets_snapshot.facets),
    )
    return _attraction_facets_snapshot


def get_attraction_facets_snapshot() -> FacetSnapshotRecord | None:
    return _attraction_facets_snapshot
