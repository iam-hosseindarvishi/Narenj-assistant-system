"""Test fixtures: SQLite-backed database with the same schema + seeded defaults."""
import os

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "admin123")
# Tests log in many times; disable the login rate limit for the suite.
os.environ.setdefault("RATE_LIMIT_LOGIN_PER_MINUTE", "100000")

from app.core.database import Base  # noqa: E402
import app.models  # noqa: F401,E402 - register all models
from app.services.seeder import seed_defaults  # noqa: E402

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()
    seed_defaults(session)
    yield session
    session.close()
    engine.dispose()


@pytest.fixture()
def templates(db_session):
    """The four seeded default templates keyed by type."""
    from app.models.template import Template

    rows = db_session.execute(Template.__table__.select()).mappings().all()
    return {r["type"]: r for r in rows}
