from __future__ import annotations

from datetime import date

import pytest
import respx
from httpx import Response

from app.adapters.ojp_transport_client import (
    OJP_URL,
    HttpxOjpTransportClient,
    OjpTransportAuthError,
)
from app.ports.transport import TransportPlace


def test_build_trip_request_uses_coordinates_and_requestor_ref():
    client = HttpxOjpTransportClient(
        api_key="test-token",
        requestor_ref="wellspent_test",
    )

    body = client._build_trip_request(
        origin=TransportPlace("Kunsthaus & Museum", 47.3701, 8.5480),
        destination=TransportPlace("Bellevue", 47.3667, 8.5433),
        departure_date=date(2026, 6, 1),
        departure_time="09:30",
    )

    assert '<OJP xmlns="http://www.vdv.de/ojp"' in body
    assert "<siri:RequestorRef>wellspent_test</siri:RequestorRef>" in body
    assert "<siri:Latitude>47.3701</siri:Latitude>" in body
    assert "<siri:Longitude>8.548</siri:Longitude>" in body
    assert "Kunsthaus &amp; Museum" not in body
    assert "<DepArrTime>2026-06-01T09:30:00</DepArrTime>" in body
    assert "<TripRequestPeriod>" not in body


def test_build_trip_request_prefers_stop_point_refs():
    client = HttpxOjpTransportClient(api_key="test-token")

    body = client._build_trip_request(
        origin=TransportPlace("Zurich HB", stop_point_ref="8503000"),
        destination=TransportPlace("Luzern", stop_point_ref="8505000"),
        departure_date=date(2026, 6, 1),
        departure_time="09:30",
    )

    assert "<siri:StopPointRef>8503000</siri:StopPointRef>" in body
    assert "<siri:StopPointRef>8505000</siri:StopPointRef>" in body
    assert "<GeoPosition>" not in body


def test_build_location_request_uses_stop_restriction():
    client = HttpxOjpTransportClient(
        api_key="test-token",
        requestor_ref="wellspent_test",
    )

    body = client._build_location_request(name="Kunsthaus & Museum")

    assert "<OJPLocationInformationRequest>" in body
    assert "<Name>Kunsthaus &amp; Museum</Name>" in body
    assert "<Type>stop</Type>" in body
    assert "<NumberOfResults>1</NumberOfResults>" in body


def test_parse_location_response_returns_stop_point_ref():
    result = HttpxOjpTransportClient._parse_location_response(
        _location_response(), fallback_name="Stadelhofen"
    )

    assert result == TransportPlace(
        name="Zürich Stadelhofen",
        stop_point_ref="8503008",
    )


@pytest.mark.asyncio
@respx.mock
async def test_plan_route_sends_ojp_headers_and_parses_trip_response():
    respx.post(OJP_URL).mock(return_value=Response(200, text=_trip_response()))
    client = HttpxOjpTransportClient(
        api_key="test-token",
        requestor_ref="wellspent_test",
        user_agent="wellspent-tests",
    )

    result = await client.plan_route(
        origin=TransportPlace("Kunsthaus", 47.3701, 8.5480),
        destination=TransportPlace("Bellevue", 47.3667, 8.5433),
        departure_date=date(2026, 6, 1),
        departure_time="09:30",
    )

    request = respx.calls.last.request
    assert request.headers["Authorization"] == "Bearer test-token"
    assert request.headers["Content-Type"] == "application/xml"
    assert request.headers["User-Agent"] == "wellspent-tests"
    assert result is not None
    assert result.duration_minutes == 18
    assert result.transfers == 0
    assert result.legs[0].mode == "tram"
    assert result.legs[0].line == "4"
    assert result.legs[0].origin == "Kunsthaus"
    assert result.legs[0].destination == "Bellevue"
    assert len(respx.calls) == 1
    assert "<OJPLocationInformationRequest>" not in request.content.decode()
    assert "<GeoPosition>" in request.content.decode()
    assert "<Name>" not in request.content.decode()


@pytest.mark.asyncio
@respx.mock
async def test_plan_route_resolves_places_before_trip_request():
    respx.post(OJP_URL).mock(
        side_effect=[
            Response(200, text=_location_response("Zürich Stadelhofen", "8503008")),
            Response(200, text=_location_response("Winterthur", "8506000")),
            Response(200, text=_trip_response()),
        ]
    )
    client = HttpxOjpTransportClient(api_key="test-token")

    result = await client.plan_route(
        origin=TransportPlace("Stadelhofen"),
        destination=TransportPlace("Winterthur"),
        departure_date=date(2026, 6, 1),
        departure_time="09:30",
    )

    assert result is not None
    assert len(respx.calls) == 3
    assert "<OJPLocationInformationRequest>" in respx.calls[0].request.content.decode()
    assert "<Name>Stadelhofen</Name>" in respx.calls[0].request.content.decode()
    assert "<Name>Winterthur</Name>" in respx.calls[1].request.content.decode()
    trip_body = respx.calls[2].request.content.decode()
    assert "<OJPTripRequest>" in trip_body
    assert "<siri:StopPointRef>8503008</siri:StopPointRef>" in trip_body
    assert "<siri:StopPointRef>8506000</siri:StopPointRef>" in trip_body


def test_parse_trip_response_returns_none_without_trip_result():
    assert HttpxOjpTransportClient._parse_trip_response("<OJPResponse />") is None


def test_parse_trip_response_handles_ojp_2_leg_shape():
    result = HttpxOjpTransportClient._parse_trip_response(_ojp_2_trip_response())

    assert result is not None
    assert result.duration_minutes == 49
    assert result.transfers == 0
    assert len(result.legs) == 1
    assert result.legs[0].mode == "rail"
    assert result.legs[0].line == "IR75"
    assert result.legs[0].origin == "Zürich HB"
    assert result.legs[0].destination == "Luzern"
    assert result.legs[0].duration_minutes == 49


@pytest.mark.asyncio
@respx.mock
async def test_plan_route_raises_auth_error_on_unauthorized():
    respx.post(OJP_URL).mock(return_value=Response(401))
    client = HttpxOjpTransportClient(api_key="bad-token")

    with pytest.raises(OjpTransportAuthError, match="authentication failed"):
        await client.plan_route(
            origin=TransportPlace("Kunsthaus"),
            destination=TransportPlace("Bellevue"),
            departure_date=date(2026, 6, 1),
            departure_time="09:30",
        )


def _trip_response() -> str:
    return """<?xml version="1.0" encoding="UTF-8"?>
<OJPResponse xmlns="http://www.siri.org.uk/siri" xmlns:ojp="http://www.vdv.de/ojp">
  <ServiceDelivery>
    <ojp:OJPTripDelivery>
      <ojp:TripResult>
        <ojp:Trip>
          <ojp:Duration>PT18M</ojp:Duration>
          <ojp:TripLeg>
            <ojp:TimedLeg>
              <ojp:Duration>PT18M</ojp:Duration>
              <ojp:LegBoard>
                <ojp:StopPointName><ojp:Text>Kunsthaus</ojp:Text></ojp:StopPointName>
                <ojp:ServiceDeparture>
                  <ojp:TimetabledTime>2026-06-01T09:30:00</ojp:TimetabledTime>
                </ojp:ServiceDeparture>
              </ojp:LegBoard>
              <ojp:LegAlight>
                <ojp:StopPointName><ojp:Text>Bellevue</ojp:Text></ojp:StopPointName>
                <ojp:ServiceArrival>
                  <ojp:TimetabledTime>2026-06-01T09:48:00</ojp:TimetabledTime>
                </ojp:ServiceArrival>
              </ojp:LegAlight>
              <ojp:Service>
                <ojp:PtMode>tram</ojp:PtMode>
                <ojp:PublishedLineName><ojp:Text>4</ojp:Text></ojp:PublishedLineName>
                <ojp:DestinationText><ojp:Text>Bahnhof Tiefenbrunnen</ojp:Text></ojp:DestinationText>
              </ojp:Service>
            </ojp:TimedLeg>
          </ojp:TripLeg>
        </ojp:Trip>
      </ojp:TripResult>
    </ojp:OJPTripDelivery>
  </ServiceDelivery>
</OJPResponse>"""


def _location_response(name: str = "Zürich Stadelhofen", ref: str = "8503008") -> str:
    return f"""<?xml version="1.0" encoding="utf-8"?>
<OJP xmlns:siri="http://www.siri.org.uk/siri" version="2.0" xmlns="http://www.vdv.de/ojp">
  <OJPResponse>
    <siri:ServiceDelivery>
      <OJPLocationInformationDelivery>
        <PlaceResult>
          <Place>
            <StopPointRef>{ref}</StopPointRef>
            <Name><Text xml:lang="de">{name}</Text></Name>
          </Place>
        </PlaceResult>
      </OJPLocationInformationDelivery>
    </siri:ServiceDelivery>
  </OJPResponse>
</OJP>"""


def _ojp_2_trip_response() -> str:
    return """<?xml version="1.0" encoding="utf-8"?>
<OJP xmlns:siri="http://www.siri.org.uk/siri" version="2.0" xmlns="http://www.vdv.de/ojp">
  <OJPResponse>
    <siri:ServiceDelivery>
      <OJPTripDelivery>
        <TripResult>
          <Trip>
            <Duration>PT49M36S</Duration>
            <Transfers>0</Transfers>
            <Leg>
              <Duration>PT49M36S</Duration>
              <TimedLeg>
                <LegBoard>
                  <StopPointName><Text xml:lang="de">Zürich HB</Text></StopPointName>
                  <ServiceDeparture>
                    <EstimatedTime>2026-05-11T17:36:00Z</EstimatedTime>
                  </ServiceDeparture>
                </LegBoard>
                <LegAlight>
                  <StopPointName><Text xml:lang="de">Luzern</Text></StopPointName>
                  <ServiceArrival>
                    <EstimatedTime>2026-05-11T18:25:36Z</EstimatedTime>
                  </ServiceArrival>
                </LegAlight>
                <Service>
                  <PublicCode>IR75</PublicCode>
                  <Mode><PtMode>rail</PtMode></Mode>
                  <DestinationText><Text xml:lang="de">Luzern</Text></DestinationText>
                </Service>
              </TimedLeg>
            </Leg>
          </Trip>
        </TripResult>
      </OJPTripDelivery>
    </siri:ServiceDelivery>
  </OJPResponse>
</OJP>"""
