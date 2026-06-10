"""Manually seed or reset the conference demo data.

Usage (from the repo root):

    uv run --env-file .env python -m scripts.seed_demo          # seed if missing
    uv run --env-file .env python -m scripts.seed_demo --reset  # wipe demo trips & re-seed

The demo data is NOT seeded automatically — run this script once after deploy
to provision the shared demo user + sample trips (until then, the
/api/demo/session endpoint returns 503). `seed_demo_data` is idempotent and
never overwrites an existing demo user, so re-running without --reset is safe.
Use --reset to wipe the demo user's trips and re-seed the sample set, e.g.
between conference days after attendees have edited them. It requires the same
DATABASE_URL as the running backend.
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
