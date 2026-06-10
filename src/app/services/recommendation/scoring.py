from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import date

from app.ports.swiss_tourism import (
    FacetRecord,
    FacetSnapshotRecord,
    FacetValueRecord,
)
from app.services import recommendation_facets

_STYLE_KEYWORDS: dict[str, list[str]] = {
    "adventure": [
        "hiking",
        "hike",
        "ski",
        "skiing",
        "climbing",
        "outdoor",
        "sport",
        "bike",
        "mountain",
        "adventure",
        "trail",
        "trekking",
        "rafting",
        "paragliding",
    ],
    "cultural": [
        "museum",
        "history",
        "historic",
        "heritage",
        "art",
        "castle",
        "cathedral",
        "architecture",
        "culture",
        "gallery",
        "monument",
        "old town",
        "roman",
        "medieval",
    ],
    "relaxation": [
        "spa",
        "wellness",
        "lake",
        "nature",
        "thermal",
        "calm",
        "relax",
        "garden",
        "scenic",
        "panorama",
        "viewpoint",
        "peaceful",
    ],
    "foodie": [
        "restaurant",
        "wine",
        "cheese",
        "food",
        "culinary",
        "gourmet",
        "taste",
        "market",
        "chocolate",
        "fondue",
        "brewery",
    ],
    "family": [
        "family",
        "children",
        "kids",
        "zoo",
        "park",
        "playground",
        "aquarium",
        "theme",
        "fun",
    ],
}

_MOOD_TO_STYLES: dict[str, list[str]] = {
    "culture_history": ["cultural"],
    "nature_outdoors": ["adventure", "relaxation"],
    "food_markets": ["foodie", "cultural"],
    "slow_relaxing": ["relaxation"],
}

_GROUP_TO_STYLES: dict[str, list[str]] = {
    "solo": [],
    "couple": ["relaxation", "cultural"],
    "family": ["family", "relaxation"],
    "friends": ["adventure", "foodie"],
}

_STYLE_FACET_TERMS: dict[str, list[str]] = {
    "adventure": [
        "adventure",
        "active",
        "outdoor",
        "nature",
        "mountain",
        "hiking",
        "hike",
        "trail",
        "climbing",
        "ski",
        "snow",
        "sport",
        "bike",
        "cycling",
    ],
    "cultural": [
        "culture",
        "cultural",
        "museum",
        "history",
        "historic",
        "heritage",
        "art",
        "architecture",
        "castle",
        "monument",
        "old town",
        "sightseeing",
    ],
    "relaxation": [
        "relax",
        "relaxation",
        "wellness",
        "spa",
        "thermal",
        "nature",
        "lake",
        "water",
        "scenic",
        "panorama",
        "viewpoint",
        "garden",
        "park",
    ],
    "foodie": [
        "food",
        "culinary",
        "gastronomy",
        "restaurant",
        "wine",
        "cheese",
        "chocolate",
        "market",
        "taste",
        "gourmet",
    ],
    "family": [
        "family",
        "children",
        "child",
        "kids",
        "kid",
        "zoo",
        "animal",
        "playground",
        "theme park",
        "park",
        "fun",
    ],
}

_METEOROLOGICAL_SEASONS: dict[int, str] = {
    12: "winter",
    1: "winter",
    2: "winter",
    3: "spring",
    4: "spring",
    5: "spring",
    6: "summer",
    7: "summer",
    8: "summer",
    9: "autumn",
    10: "autumn",
    11: "autumn",
}

_MAX_ATTRACTION_FACET_FILTERS = 3
_DESTINATION_ATTRACTION_RADIUS_M = 30_000
_ATTRACTION_TEXT_SCORE_WEIGHT = 0.55
_ATTRACTION_PROXIMITY_SCORE_WEIGHT = 0.45
_WORD_RE = re.compile(r"[a-z0-9]+")
_DESCRIPTION_MAX_CHARS = 220


@dataclass
class AttractionMatchSignals:
    facet_rank: int | None = None
    season_match: bool = False


def _clean_description(text: str | None) -> str | None:
    if not text:
        return None
    collapsed = " ".join(text.split())
    if not collapsed:
        return None
    if len(collapsed) <= _DESCRIPTION_MAX_CHARS:
        return collapsed
    truncated = collapsed[:_DESCRIPTION_MAX_CHARS].rsplit(" ", 1)[0].rstrip(",.;:")
    return f"{truncated}…"


def _score_text(name: str, description: str, category: str, styles: list[str]) -> float:
    if not styles:
        return 0.5

    text = f"{name} {description} {category}".lower()
    total_possible = 0
    total_matched = 0

    for style in styles:
        keywords = _STYLE_KEYWORDS.get(style, [])
        total_possible += len(keywords)
        total_matched += sum(1 for kw in keywords if kw in text)

    if total_possible == 0:
        return 0.5

    raw = total_matched / total_possible
    return round(0.35 + 0.65 * raw, 3)


def _effective_styles(
    mood: str,
    group_type: str,
) -> list[str]:
    ordered_styles = [
        *_MOOD_TO_STYLES.get(mood, []),
        *_GROUP_TO_STYLES.get(group_type, []),
    ]
    seen: set[str] = set()
    unique_styles: list[str] = []
    for style in ordered_styles:
        if style not in seen:
            seen.add(style)
            unique_styles.append(style)
    return unique_styles


def _tokens(text: str) -> set[str]:
    return set(_WORD_RE.findall(text.lower()))


def _matches_term(text: str, tokens: set[str], term: str) -> bool:
    normalized = term.lower().strip()
    if not normalized:
        return False
    if " " in normalized:
        return normalized in text
    return any(token == normalized or token.startswith(normalized) for token in tokens)


def _facet_value_match_score(
    facet: FacetRecord,
    value: FacetValueRecord,
    styles: list[str],
) -> int:
    value_text = f"{value.name} {value.title or ''}".lower()
    full_text = f"{facet.name} {facet.title or ''} {value_text}".lower()
    value_tokens = _tokens(value_text)
    full_tokens = _tokens(full_text)
    score = 0

    for index, style in enumerate(styles):
        weight = max(len(styles) - index, 1)
        terms = _STYLE_FACET_TERMS.get(style, [style.replace("_", " ")])
        for term in terms:
            if _matches_term(value_text, value_tokens, term):
                score += weight * 2
            elif _matches_term(full_text, full_tokens, term):
                score += weight

    return score


def _season_for_date(value: date) -> str:
    return _METEOROLOGICAL_SEASONS[value.month]


def _season_facet_filter(value: date) -> str | None:
    """Resolve the ``seasons`` facet filter for the trip's season, if available.

    Returns a ``"<facet>:<value>"`` filter only when the live facet snapshot actually
    exposes a season facet with a matching value, so we never guess a facet/value name
    the API doesn't recognise. Returns None otherwise (no season constraint applied).
    """
    snapshot = recommendation_facets.get_attraction_facets_snapshot()
    if snapshot is None:
        return None

    season = _season_for_date(value)
    for facet in snapshot.facets:
        if "season" not in f"{facet.name} {facet.title or ''}".lower():
            continue
        for facet_value in facet.values:
            label = f"{facet_value.name} {facet_value.title or ''}".lower()
            if season in label:
                return f"{facet.name}:{facet_value.name}"
    return None


def _ranked_filters_for_style(snapshot: FacetSnapshotRecord, style: str) -> list[str]:
    candidates: list[tuple[int, int, str]] = []
    for facet in snapshot.facets:
        for value in facet.values:
            if value.count <= 0:
                continue
            score = _facet_value_match_score(facet, value, [style])
            if score <= 0:
                continue
            candidates.append((score, value.count, f"{facet.name}:{value.name}"))

    candidates.sort(key=lambda candidate: (candidate[0], candidate[1]), reverse=True)
    return [facet_filter for _, _, facet_filter in candidates]


def _facet_filters_for_styles(styles: list[str]) -> list[str]:
    snapshot = recommendation_facets.get_attraction_facets_snapshot()
    if snapshot is None or not styles:
        return []

    # Rank facet values per individual style, then round-robin across styles so the
    # chosen filters span different experience types (nature + culture + food) instead
    # of clustering on one. Filters earlier in the list are the higher-priority picks.
    ranked_by_style = [_ranked_filters_for_style(snapshot, style) for style in styles]

    filters: list[str] = []
    seen: set[str] = set()
    max_depth = max((len(ranked) for ranked in ranked_by_style), default=0)
    for depth in range(max_depth):
        for ranked in ranked_by_style:
            if depth >= len(ranked):
                continue
            facet_filter = ranked[depth]
            if facet_filter in seen:
                continue
            seen.add(facet_filter)
            filters.append(facet_filter)
            if len(filters) >= _MAX_ATTRACTION_FACET_FILTERS:
                return filters
    return filters


def _distance_meters(
    origin_latitude: float,
    origin_longitude: float,
    target_latitude: float,
    target_longitude: float,
) -> float:
    earth_radius_m = 6_371_000
    origin_lat = math.radians(origin_latitude)
    target_lat = math.radians(target_latitude)
    delta_lat = math.radians(target_latitude - origin_latitude)
    delta_lon = math.radians(target_longitude - origin_longitude)

    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(origin_lat) * math.cos(target_lat) * math.sin(delta_lon / 2) ** 2
    )
    return (
        earth_radius_m * 2 * math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine))
    )


def _proximity_blended_score(base_score: float, distance_m: float | None) -> float:
    if distance_m is None:
        return base_score

    proximity_score = 1.0 - min(distance_m / _DESTINATION_ATTRACTION_RADIUS_M, 1.0)
    return round(
        base_score * _ATTRACTION_TEXT_SCORE_WEIGHT
        + proximity_score * _ATTRACTION_PROXIMITY_SCORE_WEIGHT,
        3,
    )


def _quiz_blended_score(text_score: float, signals: AttractionMatchSignals) -> float:
    score = _facet_blended_score(text_score, signals.facet_rank)
    if signals.season_match:
        score = min(1.0, score + 0.04)
    return round(score, 3)


def _facet_blended_score(text_score: float, facet_rank: int | None) -> float:
    """Blend the keyword text score with the facet match priority.

    Facet-matched attractions sit in a high score band (floor ~0.84) so they rank
    above generic keyword matches, but higher-priority facets (rank 0) score above
    lower-priority ones, and the text score breaks ties within a band — so ordering
    stays meaningful instead of every facet hit collapsing onto a single value.
    """
    if facet_rank is None:
        return text_score
    rank_weight = max(_MAX_ATTRACTION_FACET_FILTERS - facet_rank, 1)
    return round(min(1.0, 0.78 + 0.04 * rank_weight + 0.08 * text_score), 3)
