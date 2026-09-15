# Narenj Assistant System — سامانه مغایرت‌یابی نارنج

Financial reconciliation for Keshavarzi Bank branches: POS transactions (Behpardakht), bank statements, and Mohkam accounting records, matched across four reconciliation layers. Persian RTL admin panel served in the browser.

## Stack

- **Backend:** FastAPI (Python 3.12), SQLAlchemy 2.0
- **Database:** PostgreSQL 16
- **Caching / auth security:** Redis 7 (JWT blacklist, rate limiting)
- **Admin panel:** Vue 3 + Tailwind CSS, RTL
- **Deployment:** Docker Compose

## Quick start

```bash
cp .env.example .env   # adjust JWT_SECRET and admin credentials
docker compose up -d --build
```

Services:

| Service | Address | Notes |
|---|---|---|
| Admin panel | http://localhost:8080 | open from any network client at `http://<host-ip>:8080` |
| API | http://localhost:8000/api | OpenAPI docs at `/api/docs` |
| PostgreSQL | internal | volume `pgdata` |
| Redis | internal | JWT blacklist + rate limiter |

First start creates the schema and seeds the four import templates plus the admin user (`ADMIN_USERNAME` / `ADMIN_PASSWORD`, default `admin` / `admin123`).

## Admin panel

After login the sidebar shows **«مغایرت یابی بانکی»** (bank reconciliation), currently containing:

- **داشبورد** — layer stats and run-all
- **ورود اطلاعات** — Excel file upload **or** clipboard paste (TSV/CSV copied straight from Excel)
- **لایه ۱–۴** — per-layer result views with run buttons (POS↔bank, fees, bank↔accounting, POS details)
- **تطبیق دستی** — manual linking and accept/reject of suggestions
- **گزارش‌ها** — reports with Excel export, **حسابرسی** — audit log

The shell is designed as a general admin panel — future modules slot into the sidebar next to the reconciliation section.

## Four reconciliation layers

| Layer | Matches | Key rule |
|---|---|---|
| L1 | POS summaries ↔ shaparak deposits | settlement on date D+1; sum-aggregation fallback |
| L2 | bank fees ↔ accounting fees | leftovers aggregated per day into fee bookkeeping |
| L3 | non-POS bank txs ↔ accounting | exact amount+date, then havale paren-number disambiguation, then trailing digits / check numbers; unresolved ties become suggestions |
| L4 | POS detail txs ↔ accounting | branch+date `سرجمع` sums; individuals by havale ref + card last-4 |

## Tests

```bash
docker compose exec backend python -m pytest -q
```

40 tests cover adapters, Jalali date utils, the Layer-3 havale-paren rule, fixture parity against the real Excel exports (L1 = 45, POS detail = 1120), clipboard import, and the auth API.

## Project layout

- `backend/app/core|models|schemas|adapters|services|routers` — FastAPI application
- `backend/tests/` — pytest suite + real-data fixtures
- `frontend/src/` — Vue 3 panel (`layouts/`, `views/recon/`, `api/`, `stores/`, `router/`)
- `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` — deployment
- `docs/user-guide-fa.md` — Persian user guide (desktop-era flows; panel flows match its reconciliation sections)

## License

TBD — planned for future open-source release.
