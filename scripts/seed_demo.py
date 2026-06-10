"""Manually seed or reset the conference demo data.

Usage (from the repo root):

    uv run --env-file .env python -m scripts.seed_demo          # seed if missing
    uv run --env-file .env python -m scripts.seed_demo --reset  # wipe demo trips & re-seed

The backend normally seeds the demo user automatically on startup when
DEMO_MODE=true, and never overwrites it afterwards. This script is the escape
hatch to refresh the sample trips (e.g. between conference days) after attendees
have edited them. It requires the same DATABASE_URL as the running backend.
"""

import argparse
import asyncio
import sys

# Make ``app`` importable when run as a module from the repo root.
sys.path.insert(0, "src")

from app.core.db import SessionLocal, engine  # noqa: E402
from app.demo.seed import reset_demo_trips, seed_demo_data  # noqa: E402


async def main(reset: bool) -> None:
    async with SessionLocal() as session:
        if reset:
            ok = await reset_demo_trips(session)
            if not ok:
                print("Demo user not found — seeding from scratch.")
                await seed_demo_data(session)
            else:
                print("Demo trips reset to the original sample set.")
        else:
            await seed_demo_data(session)
            print("Demo user ensured (seeded only if it was missing).")
        await session.commit()
    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed or reset demo data.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete the demo user's existing trips and re-seed the sample set.",
    )
    args = parser.parse_args()
    asyncio.run(main(args.reset))
