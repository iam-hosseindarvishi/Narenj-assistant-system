# Narenj Financial Reconciliation System

Financial reconciliation for Keshavarzi Bank branches: POS transactions, bank statements, and Mohkam accounting records, matched across four reconciliation layers.

## Two editions

| | Desktop (Electron) | Full stack (Docker) |
|---|---|---|
| Backend | Electron main process (TypeScript) | FastAPI (Python) |
| Database | SQLite | PostgreSQL 16 |
| Cache / sessions | in-memory | Redis 7 |
| UI | Vue 3 + Vuetify (app window) | Vue 3 + Tailwind (admin panel in browser) |
| Access | single machine | any client on the network |

Both share the same domain logic and produce the same reconciliation results (verified by fixture parity tests).

## Full-stack deployment (Docker)

```bash
cp .env.example .env   # adjust JWT_SECRET and admin credentials
docker compose up -d --build
```

Services:

- **panel** — http://localhost:8080 (Vue 3 + Tailwind, RTL) — open from any machine at `http://<host-ip>:8080`
- **backend API** — http://localhost:8000/api (FastAPI, docs at `/api/docs`)
- **PostgreSQL** on the internal network (volume `pgdata`)
- **Redis** — JWT blacklist, rate limiting

First start creates the schema and seeds the four import templates plus the admin user (`ADMIN_USERNAME` / `ADMIN_PASSWORD`, default `admin` / `admin123`).

### Admin panel

After login the sidebar shows **«مغایرت یابی بانکی»** (bank reconciliation) containing the current project:

- داشبورد (dashboard with layer stats and run-all)
- ورود اطلاعات (import): Excel file upload **or** clipboard paste (TSV/CSV from Excel)
- لایه ۱–۴: per-layer result views with run buttons
- تطبیق دستی (manual matching + suggestion accept/reject)
- گزارش‌ها (reports + Excel export) و حسابرسی (audit log)

The panel is designed as a general admin shell — future modules slot into the sidebar next to the reconciliation section.

### Backend tests

```bash
docker compose exec backend python -m pytest -q
```

40 tests cover adapters, the Jalali date utils, the Layer-3 havale-paren disambiguation rule, layer parity against the real fixtures (L1 = 45, POS detail = 1120 rows), clipboard import, and the auth API.

## Desktop edition (original Electron app)

```bash
npm install
npm run dev      # development
npm test         # vitest
npm run package  # electron-builder → release/
```

Project layout:

- `backend/`: FastAPI app (core, models, adapters, services, routers), tests
- `frontend/`: Vue 3 + Tailwind admin panel
- `src/`: Electron desktop app (main process, renderer, shared)
- `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`: full-stack deployment

## License

TBD — planned for future open-source release.
