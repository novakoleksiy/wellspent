from __future__ import annotations

from datetime import date, timedelta

from app.ports.repositories import NewTrip, TripRecord, TripRepository


class TripNotFound(Exception):
    pass


async def create_trip(
    repo: TripRepository,
    user_id: int,
    *,
    title: str,
    destination: str,
    description: str | None = None,
    itinerary: dict | None = None,
) -> TripRecord:
    data = NewTrip(
        user_id=user_id,
        title=title,
        destination=destination,
        status="draft",
        description=description,
        itinerary=itinerary,
    )
    return await repo.create(data)


async def list_trips(repo: TripRepository, user_id: int) -> list[TripRecord]:
    return await repo.list_by_user(user_id)


async def get_trip(repo: TripRepository, user_id: int, trip_id: int) -> TripRecord:
    trip = await repo.get_by_id_and_user(trip_id, user_id)
    if not trip:
        raise TripNotFound
    return trip


async def delete_trip(repo: TripRepository, user_id: int, trip_id: int) -> None:
    trip = await repo.get_by_id_and_user(trip_id, user_id)
    if not trip:
        raise TripNotFound
    await repo.delete(trip_id, user_id)


def build_recommendations(
    destination: str | None, start_date: date, end_date: date
) -> list[dict]:
    """Pure function — no DB, no framework."""
    dest = destination or "Barcelona, Spain"
    num_days = (end_date - start_date).days or 1

    days = []
    for i in range(num_days):
        d = start_date + timedelta(days=i)
        days.append(
            {
                "day": i + 1,
                "date": d.isoformat(),
                "activities": [
                    {
                        "time": "09:00",
                        "title": f"Morning in {dest}",
                        "category": "activity",
                        "cost": 30,
                    },
                    {
                        "time": "12:30",
                        "title": "Local lunch",
                        "category": "meal",
                        "cost": 20,
                    },
                    {
                        "time": "15:00",
                        "title": f"Explore {dest}",
                        "category": "activity",
                        "cost": 40,
                    },
                ],
            }
        )

    return [
        {
            "title": f"Discover {dest}",
            "destination": dest,
            "description": f"{num_days}-day trip to {dest}, tailored to your style.",
            "itinerary": {
                "days": days,
                "estimated_total": num_days * 90 + 400,
                "currency": "USD",
            },
            "match_score": 0.85,
            "highlights": ["Great food scene", "Walkable city", "Rich culture"],
        }
    ]
