# Narenj Reconciliation — Agent Notes

Electron + Vue 3 desktop app reconciling Keshavarzi bank statements, POS (Behpardakht) exports, and Mohkam accounting records. All UI text is Persian (RTL); Jalali dates everywhere.

## Architecture

- Backend lives entirely in the Electron main process (`src/main/`); renderer talks only through IPC. Each channel `x:y` has a handler in `src/main/index.ts`, a bridge in `src/preload/index.ts` (`window.api.*`), and a hand-declared DTO in `src/env.d.ts` — keep all three in sync.
- No vue-router: `App.vue` swaps views via an `activeView` ref; wizard steps are `views/wizard/LayerStep*.vue` inside a Vuetify stepper.
- DB access goes through the `IDatabaseConnection` interface: `BetterSqliteConnection` (production, better-sqlite3, rollup-externalized in vite.config.ts) vs `SqlJsConnection` (sql.js WASM, used by all tests). Services take the connection via constructor.
- SQLite db is created at Electron `userData/narenj.db`; migrations run by filename order from `migrations/` (tracked in `schema_migrations`), packaged via electron-builder `files`.

## Reconciliation layers (domain invariants)

- All records carry status `unmatched|pending|matched|manual`; reconcilers only pick `unmatched`, so re-runs are idempotent.
- L1: `pos_summaries` ↔ shaparak bank deposits, amount-matched on date **D+1** (POS settles next day); falls back to aggregated sum matching (confidence 0.9).
- L2: bank `tx_type='fee'` ↔ accounting `entry_type='fee'` by amount+date; leftover fees are summed per day into `fee_aggregations` and then marked matched (so they don't appear in manual view). `registered` flag is user bookkeeping only.
- L3: non-POS bank txs ↔ accounting entries; ties broken by excluding descriptions containing `نارنج`, then havale paren-group numbers (numbers inside `(...)` after `حواله` in accounting desc searched in bank desc; exactly-one-hit wins, confidence 0.85), then legacy havale trailing digits, then check numbers; unresolvable ties become `suggested` links (confidence 0.6) the user accepts/rejects.
- L4: `pos_transactions` ↔ accounting; aggregate entries (`سرجمع`) match by branch+date sum, individuals by `حواله (last6 of ref)` + `ک last4 of card`.
- Persian keyword classification is load-bearing and duplicated: `constants.ts`, `KeshavarziAdapter.detectTxType`, and `LIKE '%واريزپايا%'`-style SQL in layer2/layer3/QueryHelper must stay consistent.

## Gotchas

- `exelcs inputs/` (typo intentional, load-bearing) holds the real Excel fixtures; e2e + unit tests assert exact counts against them (L1 = 45 matches, pos detail = 1120 rows). Changing import parsing or fixtures changes those numbers.
- `TemplateSeeder` runs at every startup and **silently overwrites** the columnMapping of the 4 seeded default templates if the JSON differs — user edits to seeded templates revert on restart.
- Auth sessions are an in-memory Map in main; tokens in renderer `localStorage` (`narenj.auth`) are never validated by IPC handlers, so stale tokens keep working after restart. `admin/admin123` is seeded on first run; `forcePasswordChange` is just `password === 'admin123'`.
- `ExcelReader.fixDimension` exists because Bank.xls exports can have broken `!ref` dimensions that make sheet_to_json return nothing.
- `ReportGenerator` imports electron at top level, but only `exportPdf` (hidden BrowserWindow + printToPDF) needs it; `exportExcel` runs fine under vitest.
- `npm run lint` is actually a typecheck (`vue-tsc --noEmit`), not a linter.
- `tasks/*.md` are unreadable ([BLOCKED]); `check-status.js` / `test-fees.js` are throwaway better-sqlite3 debug scripts.

## Commands

- `npm test` — vitest run, node env, includes `tests/e2e/` (uses sql.js, no Electron needed).
- `npm run dev` — Vite + electron plugin; renderer expected at `http://localhost:5173`, devtools auto-open.
- `npm run build` — `vue-tsc --noEmit && vite build` (typecheck gates the build).
- `npm run rebuild` — electron-rebuild better-sqlite3 when the native binding mismatches Electron.
- `npm run package` — build + electron-builder → `release/` (productName is Persian: سامانه تطبیق نارنج).
