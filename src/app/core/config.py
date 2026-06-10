from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = Field(..., min_length=1)
    secret_key: str = Field(..., min_length=1)
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    my_swiss_tourism_api: str = ""
    # Tour data changes rarely, so cache upstream tour responses. Seconds; 0 disables.
    swiss_tours_cache_ttl: int = 86_400  # 1 day
    # Offer data changes rarely too, so cache upstream offer responses. Seconds; 0 disables.
    swiss_offers_cache_ttl: int = 86_400  # 1 day
    opentransportdata_api_key: str = ""
    opentransportdata_ojp_url: str = "https://api.opentransportdata.swiss/ojp20"
    opentransportdata_requestor_ref: str = "wellspent_test"
    opentransportdata_user_agent: str = "wellspent"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_planner_temperature: float = 0.9
    openai_planner_timeout_seconds: float = 12.0
    registration_open: bool = False
    # Per-IP rate limiting on the publicly reachable, cost-bearing endpoints.
    # Disable in tests for deterministic behavior.
    rate_limit_enabled: bool = True
    # Conference demo mode: exposes a credential-free demo-session endpoint and
    # seeds a shared demo user with sample trips on startup. Keep False in prod.
    demo_mode: bool = False
    demo_user_email: str = "demo@wellspent.world"
    demo_user_name: str = "Demo Explorer"
    demo_user_password: str = "wellspent-demo"  # only used when seeding the user
    cors_origins: str = Field(..., min_length=1)

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def cors_origins_list(self) -> list[str]:
        return [
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        ]

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url.startswith("postgres://"):
            return self.database_url.replace("postgres://", "postgresql+asyncpg://", 1)
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace(
                "postgresql://", "postgresql+asyncpg://", 1
            )
        return self.database_url


@lru_cache
def get_settings() -> Settings:
    return Settings()  # pyright: ignore[reportCallIssue]


settings = get_settings()
