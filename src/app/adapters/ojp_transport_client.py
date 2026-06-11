from __future__ import annotations

import logging
import time
from datetime import date, datetime, timezone
from xml.etree import ElementTree
from xml.sax.saxutils import escape

import httpx

from app.ports.transport import TransportItinerary, TransportLeg, TransportPlace

logger = logging.getLogger(__name__)

OJP_URL = "https://api.opentransportdata.swiss/ojp20"
SIRI_NS = "http://www.siri.org.uk/siri"
OJP_NS = "http://www.vdv.de/ojp"


class OjpTransportAuthError(Exception):
    """Raised when OpenTransportData rejects our OJP credentials."""


class HttpxOjpTransportClient:
    """Adapter for OpenTransportData Swiss OJP 2.0 TripRequest."""

    def __init__(
        self,
        *,
        api_key: str,
        url: str = OJP_URL,
        requestor_ref: str = "wellspent_test",
        user_agent: str = "wellspent",
        timeout_seconds: float = 8.0,
    ) -> None:
        self._api_key = api_key
        self._url = url
        self._requestor_ref = requestor_ref
        self._user_agent = user_agent
        self._timeout_seconds = timeout_seconds

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/xml",
            "User-Agent": self._user_agent,
        }

    @staticmethod
    def _raise_for_status(resp: httpx.Response) -> None:
        if resp.status_code in {401, 403}:
            raise OjpTransportAuthError("OpenTransportData OJP authentication failed")
        resp.raise_for_status()

    async def _post(self, body: str, *, kind: str) -> str:
        """POST an OJP request, logging latency and failures. Returns the body text.

        ``kind`` ("trip"/"location") tags the log line. The bearer token is never
        logged. Network errors and non-2xx responses are surfaced after logging so
        the caller's graceful-degradation path still applies.
        """
        started = time.monotonic()
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout_seconds, follow_redirects=True
            ) as client:
                resp = await client.post(
                    self._url, headers=self._headers(), content=body
                )
        except httpx.HTTPError as exc:
            elapsed_ms = (time.monotonic() - started) * 1000
            logger.error(
                "OJP %s request failed after %.0f ms (%s): %s",
                kind,
                elapsed_ms,
                type(exc).__name__,
                exc,
            )
            raise

        elapsed_ms = (time.monotonic() - started) * 1000
        try:
            self._raise_for_status(resp)
        except OjpTransportAuthError:
            logger.error(
                "OJP %s request -> %s: token rejected (check OPENTRANSPORTDATA_API_KEY)",
                kind,
                resp.status_code,
            )
            raise
        except httpx.HTTPStatusError:
            logger.error(
                "OJP %s request -> HTTP %s (%.0f ms): %s",
                kind,
                resp.status_code,
                elapsed_ms,
                resp.text[:300],
            )
            raise

        logger.debug(
            "OJP %s request -> %s (%.0f ms)", kind, resp.status_code, elapsed_ms
        )
        return resp.text

    async def plan_route(
        self,
        *,
        origin: TransportPlace,
        destination: TransportPlace,
        departure_date: date,
        departure_time: str,
        travelers: int = 1,
    ) -> TransportItinerary | None:
        origin = await self.resolve_place(origin)
        destination = await self.resolve_place(destination)
        body = self._build_trip_request(
            origin=origin,
            destination=destination,
            departure_date=departure_date,
            departure_time=departure_time,
        )
        response_text = await self._post(body, kind="trip")
        itinerary = self._parse_trip_response(response_text)
        if itinerary is None:
            logger.info(
                "OJP trip request returned no usable itinerary from %s to %s",
                origin.name,
                destination.name,
            )
        return itinerary

    async def resolve_place(self, place: TransportPlace) -> TransportPlace:
        if place.stop_point_ref is not None or (
            place.latitude is not None and place.longitude is not None
        ):
            return place

        body = self._build_location_request(name=place.name)
        response_text = await self._post(body, kind="location")

        resolved = self._parse_location_response(
            response_text, fallback_name=place.name
        )
        if resolved is None:
            logger.info("OJP could not resolve a stop for %r", place.name)
        return resolved or place

    def _build_location_request(self, *, name: str) -> str:
        timestamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<OJP xmlns="{OJP_NS}" xmlns:siri="{SIRI_NS}" version="2.0">
  <OJPRequest>
    <siri:ServiceRequest>
      <siri:RequestTimestamp>{timestamp}</siri:RequestTimestamp>
      <siri:RequestorRef>{escape(self._requestor_ref)}</siri:RequestorRef>
      <OJPLocationInformationRequest>
        <siri:RequestTimestamp>{timestamp}</siri:RequestTimestamp>
        <siri:MessageIdentifier>wellspent-location-request</siri:MessageIdentifier>
        <InitialInput>
          <Name>{escape(name)}</Name>
        </InitialInput>
        <Restrictions>
          <Type>stop</Type>
          <NumberOfResults>1</NumberOfResults>
        </Restrictions>
      </OJPLocationInformationRequest>
    </siri:ServiceRequest>
  </OJPRequest>
</OJP>"""

    def _build_trip_request(
        self,
        *,
        origin: TransportPlace,
        destination: TransportPlace,
        departure_date: date,
        departure_time: str,
    ) -> str:
        timestamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        departure_datetime = f"{departure_date.isoformat()}T{departure_time}:00"
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<OJP xmlns="{OJP_NS}" xmlns:siri="{SIRI_NS}" version="2.0">
  <OJPRequest>
    <siri:ServiceRequest>
      <siri:RequestTimestamp>{timestamp}</siri:RequestTimestamp>
      <siri:RequestorRef>{escape(self._requestor_ref)}</siri:RequestorRef>
      <OJPTripRequest>
        <siri:RequestTimestamp>{timestamp}</siri:RequestTimestamp>
        <siri:MessageIdentifier>wellspent-trip-request</siri:MessageIdentifier>
        <Origin>
          {self._place_xml(origin)}
          <DepArrTime>{departure_datetime}</DepArrTime>
        </Origin>
        <Destination>
          {self._place_xml(destination)}
        </Destination>
        <Params>
          <NumberOfResults>3</NumberOfResults>
          <IncludeIntermediateStops>true</IncludeIntermediateStops>
          <UseRealtimeData>explanatory</UseRealtimeData>
        </Params>
      </OJPTripRequest>
    </siri:ServiceRequest>
  </OJPRequest>
</OJP>"""

    @staticmethod
    def _place_xml(place: TransportPlace) -> str:
        if place.stop_point_ref is not None:
            return f"""<PlaceRef>
            <siri:StopPointRef>{escape(place.stop_point_ref)}</siri:StopPointRef>
            <Name>
              <Text>{escape(place.name)}</Text>
            </Name>
          </PlaceRef>"""
        if place.latitude is not None and place.longitude is not None:
            return f"""<PlaceRef>
            <GeoPosition>
              <siri:Longitude>{place.longitude}</siri:Longitude>
              <siri:Latitude>{place.latitude}</siri:Latitude>
            </GeoPosition>
          </PlaceRef>"""
        return f"""<PlaceRef>
            <Name>
              <Text>{escape(place.name)}</Text>
            </Name>
          </PlaceRef>"""

    @classmethod
    def _parse_location_response(
        cls, body: str, *, fallback_name: str
    ) -> TransportPlace | None:
        root = ElementTree.fromstring(body)
        place_result = cls._first(root, "PlaceResult")
        place = cls._first(place_result, "Place")
        stop_point_ref = cls._text_deep(cls._first(place, "StopPointRef"))
        stop_place_ref = cls._text_deep(cls._first(place, "StopPlaceRef"))
        ref = stop_point_ref or stop_place_ref
        if ref is None:
            return None
        name = cls._text_deep(cls._first(place, "Name")) or fallback_name
        return TransportPlace(name=name, stop_point_ref=ref)

    @classmethod
    def _parse_trip_response(cls, body: str) -> TransportItinerary | None:
        root = ElementTree.fromstring(body)
        trip_result = cls._first(root, "TripResult")
        if trip_result is None:
            return None

        trip = cls._first(trip_result, "Trip")
        if trip is None:
            trip = trip_result
        legs: list[TransportLeg] = []
        trip_legs = cls._children(trip, "TripLeg") or cls._children(trip, "Leg")
        for leg in trip_legs:
            parsed = cls._parse_leg(leg)
            if parsed is not None:
                legs.append(parsed)

        if not legs:
            return None

        duration = cls._duration_minutes(cls._text(cls._first(trip, "Duration")))
        transfers = cls._int(cls._text(cls._first(trip, "Transfers")))
        if transfers is None:
            transfers = max(sum(1 for leg in legs if leg.mode != "walk") - 1, 0)
        return TransportItinerary(
            duration_minutes=duration,
            transfers=transfers,
            legs=legs,
        )

    @classmethod
    def _parse_leg(cls, leg: ElementTree.Element) -> TransportLeg | None:
        timed_leg = cls._first(leg, "TimedLeg")
        if timed_leg is not None:
            service = cls._first(timed_leg, "Service")
            mode = (
                cls._text_deep(cls._first(service, "PtMode"))
                if service is not None
                else ""
            )
            line = (
                cls._text_deep(cls._first(service, "PublicCode"))
                or cls._text_deep(cls._first(service, "PublishedServiceName"))
                or cls._text_deep(cls._first(service, "PublishedLineName"))
            )
            direction = cls._text_deep(cls._first(service, "DestinationText"))
            origin = cls._timed_stop_name(cls._first(timed_leg, "LegBoard"))
            destination = cls._timed_stop_name(cls._first(timed_leg, "LegAlight"))
            departure = cls._event_time(
                cls._first(timed_leg, "LegBoard"), "ServiceDeparture"
            )
            arrival = cls._event_time(
                cls._first(timed_leg, "LegAlight"), "ServiceArrival"
            )
            return TransportLeg(
                mode=mode or "public_transport",
                line=line,
                departure_time=departure,
                arrival_time=arrival,
                duration_minutes=cls._duration_minutes(
                    cls._text(cls._first(timed_leg, "Duration"))
                    or cls._text(cls._first(leg, "Duration"))
                ),
                origin=origin,
                destination=destination,
                direction=direction,
            )

        transfer_leg = cls._first(leg, "TransferLeg") or cls._first(
            leg, "ContinuousLeg"
        )
        if transfer_leg is None:
            return None

        return TransportLeg(
            mode="walk",
            line=None,
            departure_time=None,
            arrival_time=None,
            duration_minutes=cls._duration_minutes(
                cls._text(cls._first(transfer_leg, "Duration"))
            ),
            origin=cls._text(cls._first(transfer_leg, "FromStopPointName")) or "",
            destination=cls._text(cls._first(transfer_leg, "ToStopPointName")) or "",
            notes=cls._text(cls._first(transfer_leg, "WalkDuration")) or "",
        )

    @classmethod
    def _timed_stop_name(cls, node: ElementTree.Element | None) -> str:
        if node is None:
            return ""
        return (
            cls._text_deep(cls._first(node, "StopPointName"))
            or cls._text_deep(cls._first(node, "StopPlaceName"))
            or cls._text_deep(cls._first(node, "LocationName"))
            or ""
        )

    @classmethod
    def _event_time(cls, node: ElementTree.Element | None, name: str) -> str | None:
        event = cls._first(node, name)
        return (
            cls._text(cls._first(event, "EstimatedTime"))
            or cls._text(cls._first(event, "TimetabledTime"))
            or cls._text(event)
        )

    @staticmethod
    def _local_name(tag: str) -> str:
        return tag.rsplit("}", 1)[-1]

    @classmethod
    def _children(
        cls, node: ElementTree.Element | None, name: str
    ) -> list[ElementTree.Element]:
        if node is None:
            return []
        return [child for child in list(node) if cls._local_name(child.tag) == name]

    @classmethod
    def _first(
        cls, node: ElementTree.Element | None, name: str
    ) -> ElementTree.Element | None:
        if node is None:
            return None
        for child in node.iter():
            if cls._local_name(child.tag) == name:
                return child
        return None

    @staticmethod
    def _text(node: ElementTree.Element | None) -> str | None:
        if node is None or node.text is None:
            return None
        value = node.text.strip()
        return value or None

    @classmethod
    def _text_deep(cls, node: ElementTree.Element | None) -> str | None:
        if node is None:
            return None
        direct = cls._text(node)
        if direct:
            return direct
        for child in node.iter():
            value = cls._text(child)
            if value:
                return value
        return None

    @staticmethod
    def _duration_minutes(value: str | None) -> int | None:
        if not value or not value.startswith("PT"):
            return None
        hours = 0
        minutes = 0
        current = ""
        for char in value[2:]:
            if char.isdigit():
                current += char
            elif char == "H" and current:
                hours = int(current)
                current = ""
            elif char == "M" and current:
                minutes = int(current)
                current = ""
        return hours * 60 + minutes

    @staticmethod
    def _int(value: str | None) -> int | None:
        if value is None:
            return None
        try:
            return int(value)
        except ValueError:
            return None
