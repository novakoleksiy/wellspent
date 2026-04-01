from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import PremadeTemplate
from app.ports.repositories import TemplateRecord


def _to_record(tpl: PremadeTemplate) -> TemplateRecord:
    return TemplateRecord(
        id=tpl.id,
        title=tpl.title,
        destination=tpl.destination,
        description=tpl.description,
        itinerary=tpl.itinerary,
        travel_styles=tpl.travel_styles or [],
        budget_tier=tpl.budget_tier,
        pace=tpl.pace,
        match_tags=tpl.match_tags or [],
        created_by=tpl.created_by,
        created_at=tpl.created_at,
    )


class SqlAlchemyPremadeTemplateRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_matching(
        self,
        *,
        travel_styles: list[str],
        budget_tier: str,
        pace: str,
        limit: int = 5,
    ) -> list[TemplateRecord]:
        stmt = (
            select(PremadeTemplate)
            .where(
                PremadeTemplate.budget_tier == budget_tier,
                PremadeTemplate.pace == pace,
            )
            .limit(limit * 3)  # over-fetch so we can rank by style overlap
        )
        result = await self._session.execute(stmt)
        templates = result.scalars().all()

        # Rank by number of overlapping travel styles
        def _style_overlap(tpl: PremadeTemplate) -> int:
            return len(set(tpl.travel_styles or []) & set(travel_styles))

        ranked = sorted(templates, key=_style_overlap, reverse=True)
        return [_to_record(t) for t in ranked[:limit]]

    async def get_by_id(self, template_id: int) -> TemplateRecord | None:
        result = await self._session.execute(
            select(PremadeTemplate).where(PremadeTemplate.id == template_id)
        )
        tpl = result.scalar_one_or_none()
        return _to_record(tpl) if tpl else None
