"""Back-compat shim for the recommendation package.

The implementation lives in ``app.services.recommendation``; this module re-exports
the public entry points plus the internal helpers the test suite references via
``recommendation_service.<name>``.
"""

import random  # noqa: F401 — tests patch recommendation_service.random.choice

from app.services.recommendation.candidates import (  # noqa: F401
    RecommendationItem,
)
from app.services.recommendation.planning import (  # noqa: F401
    _TRIP_LENGTH_SLOTS,
    _estimated_total,
)
from app.services.recommendation.scoring import (  # noqa: F401
    _DESTINATION_ATTRACTION_RADIUS_M,
    AttractionMatchSignals,
    _attraction_signals,
    _demote_off_season,
    _facet_blended_score,
    _quiz_blended_score,
    _season_for_date,
    _season_signals,
    _style_facet_rank,
)
from app.services.recommendation.service import (  # noqa: F401
    recommend,
    refresh_recommendation_item,
)
from app.services.recommendation.timeline import (  # noqa: F401
    _build_day_timeline,
    _transport_leg_details,
)
