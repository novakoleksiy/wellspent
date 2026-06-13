from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import date

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

# The opposing season whose attractions should be demoted when off-season. Summer
# and winter are the strong case (ski content surfacing in July, lake content in
# January); spring/autumn oppose each other symmetrically.
_OPPOSITE_SEASON: dict[str, str] = {
    "summer": "winter",
    "winter": "summer",
    "spring": "autumn",
    "autumn": "spring",
}

# Keywords that mark an item as food/markets-related, used to enforce the food-slot
# quota on "Food & Markets" trips. Deliberately broader than the foodie style
# keywords: the genuine food content lives in offer names ("Zürich Food Tour",
# "Zermatt Tapas Tour", "Culinary hike"), which the attraction experiencetype facet
# never tags as food, so quota membership is decided on free text instead.
_FOOD_KEYWORDS: tuple[str, ...] = (
    "food",
    "restaurant",
    "wine",
    "cheese",
    "culinary",
    "gourmet",
    "gastronom",
    "market",
    "chocolate",
    "fondue",
    "raclette",
    "brewery",
    "tasting",
    "degustation",
    "vineyard",
    "winery",
    "dining",
    "cuisine",
    "bakery",
    "tapas",
    "apéro",
    "aperitif",
    "distillery",
)


def _text_is_food(*texts: str | None) -> bool:
    """Whether any of the given text fragments names a food/markets experience."""
    blob = " ".join(text for text in texts if text).lower()
    return any(keyword in blob for keyword in _FOOD_KEYWORDS)


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
    season_mismatch: bool = False


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


def _season_for_date(value: date) -> str:
    return _METEOROLOGICAL_SEASONS[value.month]


def _season_pool_filter(trip_date: date) -> str:
    """Facet filter selecting attractions tagged with the trip's season.

    Used as a *pool builder*, not just a ranking signal: the unfiltered destination
    query returns only a small curated slice (sometimes empty), whereas this faceted
    query traverses the full classification index and surfaces the in-season items the
    broad query never returns. The ``seasons`` facet name and lowercase season values
    are stable in the live API, so the filter is constructed directly without consulting
    the facet snapshot.
    """
    return f"seasons:{_season_for_date(trip_date)}"


def _style_facet_rank(experiencetype: list[str], styles: list[str]) -> int | None:
    """Rank of the highest-priority style matched by the item's experience types.

    Styles are listed best-first, so the lowest matching index is the strongest match.
    Returned as a 0-based rank that feeds ``_facet_blended_score``'s high score band;
    ``None`` means no style matched (the item is scored on text + proximity only).
    """
    if not experiencetype or not styles:
        return None
    text = " ".join(experiencetype).lower()
    tokens = _tokens(text)
    for rank, style in enumerate(styles):
        terms = _STYLE_FACET_TERMS.get(style, [style.replace("_", " ")])
        if any(_matches_term(text, tokens, term) for term in terms):
            return rank
    return None


def _season_signals(seasons: list[str], trip_date: date) -> tuple[bool, bool]:
    """Whether the item is tagged with the trip's season and/or its opposite.

    Returns ``(season_match, season_mismatch)``. An untagged item is neutral on both.
    A year-round item tagged with both seasons reports both True, and the demotion in
    ``_demote_off_season`` lets the in-season match override the off-season penalty.
    """
    if not seasons:
        return False, False
    labels = {season.lower() for season in seasons}
    trip_season = _season_for_date(trip_date)
    opposite = _OPPOSITE_SEASON.get(trip_season)
    return trip_season in labels, opposite is not None and opposite in labels


def _attraction_signals(
    experiencetype: list[str],
    seasons: list[str],
    styles: list[str],
    trip_date: date,
) -> AttractionMatchSignals:
    """Derive ranking signals from an item's own classification tags."""
    season_match, season_mismatch = _season_signals(seasons, trip_date)
    return AttractionMatchSignals(
        facet_rank=_style_facet_rank(experiencetype, styles),
        season_match=season_match,
        season_mismatch=season_mismatch,
    )


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


# Out-of-season content (e.g. ski runs in July) is demoted multiplicatively. Halving
# is deliberately heavy: a facet-matched, nearby off-season attraction can score ~0.95,
# and only a cut this large reliably drops it below mediocre in-season alternatives.
# The demotion is applied *after* the proximity blend (see `_demote_off_season`) so it
# clears the facet score floor and isn't diluted by a close distance.
_OFF_SEASON_PENALTY_FACTOR = 0.5


def _quiz_blended_score(text_score: float, signals: AttractionMatchSignals) -> float:
    score = _facet_blended_score(text_score, signals.facet_rank)
    if signals.season_match:
        score = min(1.0, score + 0.04)
    return round(score, 3)


def _demote_off_season(score: float, signals: AttractionMatchSignals) -> float:
    """Scale down out-of-season attractions, applied after the proximity blend.

    A current-season tag overrides the demotion, so year-round attractions tagged with
    both the trip's season and its opposite are never demoted. Relative order among
    off-season items is preserved, so they still degrade gracefully into the plan when
    nothing in-season is available rather than vanishing entirely.
    """
    if signals.season_mismatch and not signals.season_match:
        return round(score * _OFF_SEASON_PENALTY_FACTOR, 3)
    return score


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
