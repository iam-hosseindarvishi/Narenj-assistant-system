# Narenj Reconciliation — Agent Notes

Full-stack web app reconciling Keshavarzi bank statements, POS (Behpardakht) exports, and Mohkam accounting records. All UI text is Persian (RTL); Jalali dates everywhere. The former Electron desktop edition has been removed — `backend/` (FastAPI) + `frontend/` (Vue 3 + Tailwind) + `docker-compose.yml` are the whole product.

## Architecture

- **backend/** — FastAPI (Python 3.12), layered as `core/` (config, database, redis, security, deps), `models/` (SQLAlchemy 2.0), `schemas/` (Pydantic), `adapters/` (ExcelReader, TemplateEngine, Keshavarzi/Mohkam/POS), `services/` (FileImporter, layers 1–4, ManualMatchingService, QueryHelper, ReportGenerator, seeder), `routers/` (auth, templates, files, reconciliation, reports).
- **frontend/** — Vue 3 + Tailwind + Pinia + vue-router (hash mode). `layouts/AdminLayout.vue` is the generic admin shell whose sidebar hosts the «مغایرت یابی بانکی» section (views in `views/recon/`). API access goes through `api/client.ts` (axios with refresh-token interceptor).
- **docker-compose.yml** — postgres:16, redis:7, backend (uvicorn, live-mounted source), frontend (nginx serving the built panel and proxying `/api`). Panel base URL is relative (`/api`), so any network client can use `http://<host-ip>:8080`.
- First backend start runs `Base.metadata.create_all` + `seed_defaults` (4 default templates + admin user). Test backend is in-memory SQLite with a `BigInteger→INTEGER` compile hook in `core/database.py`; production is PostgreSQL.

## Reconciliation layers (domain invariants)

- All records carry status `unmatched|pending|matched|manual`; reconcilers only pick `unmatched`, so re-runs are idempotent.
- L1: `pos_summaries` ↔ shaparak bank deposits, amount-matched on date **D+1** (POS settles next day); falls back to aggregated sum matching (confidence 0.9).
- L2: bank `tx_type='fee'` ↔ accounting `entry_type='fee'` by amount+date; leftover fees are summed per day into `fee_aggregations` and then marked matched. `registered` flag is user bookkeeping only.
- L3: non-POS bank txs ↔ accounting entries; ties broken by excluding descriptions containing `نارنج`, then havale paren-group numbers (numbers inside `(...)` after `حواله` in accounting desc searched in bank desc; exactly-one-hit wins, confidence 0.85), then legacy havale trailing digits, then check numbers; unresolvable ties become `suggested` links (confidence 0.6) the user accepts/rejects.
- L4: `pos_transactions` ↔ accounting; aggregate entries (`سرجمع`) match by branch+date sum, individuals by `حواله (last6 of ref)` + `ک last4 of card`.
- Persian keyword classification is load-bearing: `core/constants.py`, `KeshavarziAdapter.detect_tx_type`, and `LIKE '%واريزپايا%'`-style SQL in layer2/layer3/queries must stay consistent.
- `TemplateEngine.cell_str` mimics JS `String()` (whole floats lose `.0`) — branch/terminal ids parse as `3882021`, not `3882021.0`; `headerRow` semantics match the old TS adapters (data starts at index `headerRow`).

## Gotchas

- `exelcs inputs/` (typo intentional, load-bearing) holds the real Excel fixtures; `backend/tests/fixtures/` holds copies used by pytest, which asserts exact counts (L1 = 45 matches, pos detail = 1120 rows, bank rows = 150, accounting = 253).
- The Python xlsx reader must NOT use openpyxl `read_only=True` — real-world POS exports truncate to 1 row in that mode.
- Backend tests run on in-memory SQLite: JSONB columns were replaced by portable `JSON`, and BigInteger PKs need the sqlite compile hook or autoincrement breaks.
- `TemplateSeeder` does NOT exist in the new stack: `seed_defaults` only inserts missing templates and leaves user edits alone (intentional improvement over the Electron app).
- Auth is stateless JWT (access 30 min / refresh 7 days); logout blacklists jtis in Redis. Rate limiting fails open if Redis is down.
- `docker compose` live-mounts `backend/app` and `backend/tests` into the container — code edits apply after `docker compose restart backend`, but dependency/model changes need `--build`.

## Commands

- `docker compose up -d --build` — bring up postgres, redis, backend (:8000), panel (:8080).
- `docker compose exec backend python -m pytest -q` — backend test suite (40 tests, in-container).
- `docker compose logs backend` — uvicorn logs; DB inspection: `docker compose exec postgres psql -U narenj -d narenj`.
- Panel (dev mode, optional): `cd frontend && npm install && npm run dev` with `VITE_API_BASE_URL=http://localhost:8000/api`.
