"""Application configuration via environment variables."""
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+psycopg://narenj:narenj@localhost:5432/narenj"
    # Redis
    redis_url: str = "redis://localhost:6379/0"
    # Security
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    # CORS (comma-separated list of allowed origins; LAN clients supported)
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    # Seeded admin bootstrap credentials
    admin_username: str = "admin"
    admin_password: str = "admin123"
    # Rate limiting
    rate_limit_login_per_minute: int = 10
    rate_limit_api_per_minute: int = 300
    # Dashboard cache TTL seconds
    dashboard_cache_ttl: int = 60

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
