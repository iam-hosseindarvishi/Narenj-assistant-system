# Narenj Financial Reconciliation System

Desktop application for reconciling POS transactions, Keshavarzi bank statements, and Mohkam accounting records across four reconciliation layers.

## Features

- Persian RTL interface built with Vue 3 and Vuetify 3
- Excel `.xls` and `.xlsx` import using configurable templates
- Four-layer reconciliation for POS, bank, fees, and accounting records
- Manual matching, users, audit trail, and PDF/Excel reporting
- Electron desktop packaging for Windows NSIS, macOS DMG, and Linux AppImage

## Development setup

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Run verification and production builds with:

```bash
npm test
npm run lint
npm run build
npm run package
```

Package artifacts are written to `release/`. The application stores its SQLite database in Electron's per-user application data directory.

## Stack

- Electron
- Vue 3, Vite, TypeScript
- Vuetify 3 and Pinia
- better-sqlite3
- SheetJS (`xlsx`)
- jalaali-js
- Vitest
- electron-builder

## Project layout

- `src/main/`: Electron main process, database, importers, reconciliation, authentication, and audit services
- `src/renderer/`: Vue application and views
- `src/shared/`: shared types, constants, and Jalali date utilities
- `migrations/`: SQLite schema migrations
- `tests/`: unit tests
- `docs/user-guide-fa.md`: Persian user guide

## License

TBD — planned for future open-source release.
