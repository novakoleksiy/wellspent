from __future__ import annotations

import os
from datetime import date

import pytest

from app.adapters.ojp_transport_client import HttpxOjpTransportClient
from app.core.config import settings
from app.ports.transport import TransportPlace

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_LIVE_TRANSPORT_TESTS") != "1",
    reason="set RUN_LIVE_TRANSPORT_TESTS=1 to run live OJP tests",
)


@pytest.mark.asyncio
async def test_live_plan_route_accepts_coordinates_without_place_names():
    if not settings.opentransportdata_api_key:
        pytest.skip("OPENTRANSPORTDATA_API_KEY is not configured")

    class CapturingClient(HttpxOjpTransportClient):
        last_trip_request: str | None = None

        def _build_trip_request(self, **kwargs):  # type: ignore[no-untyped-def]
            self.last_trip_request = super()._build_trip_request(**kwargs)
            return self.last_trip_request

    client = CapturingClient(
        api_key=settings.opentransportdata_api_key,
        url=settings.opentransportdata_ojp_url,
        requestor_ref=settings.opentransportdata_requestor_ref,
        user_agent=settings.opentransportdata_user_agent,
        timeout_seconds=12,
    )

    route = await client.plan_route(
        origin=TransportPlace("origin name must not be sent", 47.378177, 8.540192),
        destination=TransportPlace(
            "destination name must not be sent", 47.366609, 8.548393
        ),
        departure_date=date.today(),
        departure_time="10:00",
    )

    assert route is not None
    assert route.legs
    assert client.last_trip_request is not None
    assert "<OJPLocationInformationRequest>" not in client.last_trip_request
    assert "origin name must not be sent" not in client.last_trip_request
    assert "destination name must not be sent" not in client.last_trip_request
    assert "<siri:Longitude>8.540192</siri:Longitude>" in client.last_trip_request
    assert "<siri:Latitude>47.378177</siri:Latitude>" in client.last_trip_request
