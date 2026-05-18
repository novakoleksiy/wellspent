from __future__ import annotations

import asyncio
import json
import os
import sys
from dataclasses import asdict
from datetime import date, datetime
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
sys.path.insert(0, str(SRC))

from app.adapters.ojp_transport_client import (  # noqa: E402
    OJP_URL,
    HttpxOjpTransportClient,
    OjpTransportAuthError,
)
from app.ports.transport import TransportPlace  # noqa: E402

ORIGIN_NAME = "Stadelhofen"
DESTINATION_NAME = "Winterthur"
DEPARTURE_DATE = date.today()
DEPARTURE_TIME = datetime.now().strftime("%H:%M")
TRAVELERS = 1

API_KEY = os.environ.get("OPENTRANSPORTDATA_API_KEY")
URL = os.environ.get("OPENTRANSPORTDATA_OJP_URL", OJP_URL)
REQUESTOR_REF = os.environ.get("OPENTRANSPORTDATA_REQUESTOR_REF", "wellspent_test")
USER_AGENT = os.environ.get("OPENTRANSPORTDATA_USER_AGENT", "wellspent-script")
TIMEOUT_SECONDS = 8.0


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


async def main() -> int:
    load_dotenv(ROOT / ".env")
    api_key = API_KEY or os.environ.get("OPENTRANSPORTDATA_API_KEY")
    url = os.environ.get("OPENTRANSPORTDATA_OJP_URL", URL)
    requestor_ref = os.environ.get("OPENTRANSPORTDATA_REQUESTOR_REF", REQUESTOR_REF)
    user_agent = os.environ.get("OPENTRANSPORTDATA_USER_AGENT", USER_AGENT)
    if not api_key:
        print(
            "Missing API key. Set OPENTRANSPORTDATA_API_KEY in .env or API_KEY in this script.",
            file=sys.stderr,
        )
        return 2

    client = HttpxOjpTransportClient(
        api_key=api_key,
        url=url,
        requestor_ref=requestor_ref,
        user_agent=user_agent,
        timeout_seconds=TIMEOUT_SECONDS,
    )

    try:
        origin = await client.resolve_place(TransportPlace(name=ORIGIN_NAME))
        destination = await client.resolve_place(TransportPlace(name=DESTINATION_NAME))
        if origin.stop_point_ref is None or destination.stop_point_ref is None:
            print("Could not resolve origin or destination to a stop.", file=sys.stderr)
            return 1

        print(f"Resolved origin: {origin.name} ({origin.stop_point_ref})")
        print(
            f"Resolved destination: {destination.name} ({destination.stop_point_ref})"
        )
        itinerary = await client.plan_route(
            origin=origin,
            destination=destination,
            departure_date=DEPARTURE_DATE,
            departure_time=DEPARTURE_TIME,
            travelers=TRAVELERS,
        )
    except OjpTransportAuthError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except httpx.HTTPStatusError as exc:
        print(f"OJP query failed: {exc}", file=sys.stderr)
        print(exc.response.text, file=sys.stderr)
        return 1
    except httpx.HTTPError as exc:
        print(f"OJP query failed: {exc}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(f"OJP response could not be parsed: {exc}", file=sys.stderr)
        return 1

    if itinerary is None:
        print("No itinerary returned.")
        return 1

    print(json.dumps(asdict(itinerary), ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
