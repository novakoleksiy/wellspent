from __future__ import annotations

import logging
import sys

_CONFIGURED = False

_FORMAT = "%(asctime)s %(levelname)-7s %(name)s | %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def configure_logging(level: str = "INFO") -> None:
    """Wire the app's own loggers (``app.*``) to stdout with a readable format.

    Idempotent: safe to call from module import and from the lifespan handler.
    We attach a dedicated handler to the ``app`` logger and disable propagation
    so messages aren't duplicated by uvicorn's root handler. ``httpx`` is pinned
    to WARNING so its per-request INFO chatter doesn't drown the app's own logs.
    """
    global _CONFIGURED
    if _CONFIGURED:
        return

    resolved = logging.getLevelName(level.upper())
    if not isinstance(resolved, int):
        resolved = logging.INFO

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(_FORMAT, datefmt=_DATE_FORMAT))

    app_logger = logging.getLogger("app")
    app_logger.setLevel(resolved)
    app_logger.handlers = [handler]
    app_logger.propagate = False

    logging.getLogger("httpx").setLevel(logging.WARNING)

    _CONFIGURED = True
