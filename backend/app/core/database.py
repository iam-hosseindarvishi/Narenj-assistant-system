"""SQLAlchemy engine, session, and base declarative class."""
from sqlalchemy import BigInteger, create_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings

settings = get_settings()

engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


@compiles(BigInteger, "sqlite")
def _bigint_sqlite(type_, compiler, **kw):
    """Render INTEGER so BigInteger PKs autoincrement under the SQLite test backend."""
    return "INTEGER"


def get_db():
    """FastAPI dependency yielding a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
