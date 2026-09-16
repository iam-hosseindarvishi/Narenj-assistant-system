"""FastAPI application: middleware, routers, startup migration + seeding."""
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.database import Base, SessionLocal, engine
from app.core.deps import rate_limit_api
from app.routers import auth, files, reconciliation, reports, sales, templates

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("narenj")

settings = get_settings()

app = FastAPI(
    title="Narenj Reconciliation API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def api_rate_limit(request: Request, call_next):
    if request.url.path.startswith("/api") and request.method != "OPTIONS":
        rate_limit_api(request)
    return await call_next(request)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.on_event("startup")
def on_startup() -> None:
    """Create tables (dev bootstrap) and seed defaults; Alembic manages upgrades in prod."""
    from app.services.seeder import seed_defaults

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_defaults(db)
        logger.info("Database ready; defaults seeded")
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router, prefix="/api")
app.include_router(templates.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(reconciliation.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(sales.router, prefix="/api")
