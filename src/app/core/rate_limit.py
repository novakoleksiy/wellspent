"""Lightweight in-process rate limiting for the publicly reachable,
cost-bearing endpoints (demo login, LLM-backed recommendations, and the
external Swiss Tourism calls).

Limits are keyed on the client IP. Behind Render's proxy the real client IP
arrives in ``X-Forwarded-For``. We must not trust the *leftmost* entry: a client
can prepend its own ``X-Forwarded-For`` value and the proxy only appends the
socket IP to the right. So we read the IP ``settings.trusted_proxy_hops`` in from
the right (the hop our own trusted proxy added) and fall back to the socket peer.
The store is in-memory and resets on restart, which is fine for a single-instance
deployment.
"""

from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # Each proxy appends the IP it saw to the right, so values the client
        # forged sit to the left of the entry our trusted proxy added. Counting
        # in from the right ignores them.
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        hops = settings.trusted_proxy_hops
        if len(parts) >= hops > 0:
            return parts[-hops]
    return get_remote_address(request)


limiter = Limiter(key_func=_client_ip, enabled=settings.rate_limit_enabled)

# Shared budgets so abuse can't be spread across sibling endpoints.
# Recommendation endpoints hit OpenAI + Swiss Tourism, so they're the tightest.
recommend_limit = limiter.shared_limit("15/minute;150/hour", scope="recommend")
# Swiss Tourism reads are cached upstream but still proxy to an external API.
swiss_limit = limiter.shared_limit("60/minute", scope="swiss-tourism")
