# Verification

These checks were executed in the prepared cloud workspace; they are not a claim of deployment or fresh-task restoration.

## Data and calculations

- Preserved workbook: 541,909 rows, required eight-column schema, observed coverage 2010-12-01 through 2011-12-09.
- Original file SHA-256: `43465a06f2ccf7c8b5bd2892bc7defb52f97487934fe93b16ae4c3936424676d`.
- Explicit pinned-mirror import script executed successfully, including checksum verification. A second import produced the same quality summary and totals.
- `row_audit` has exactly 541,909 rows. Valid sales plus mutually exclusive exclusions reconcile to that count: 524,878 + 17,031.
- SQL revenue reconciled with monthly/country aggregates and an independent Pandas sum of quantity × unit price over retained valid audit rows. Invoice and customer distinct counts also reconcile independently.
- Generated report: `python -m backend.app.report`; actual evidence is in `ANALYSIS_REPORT.md`.
- Official UCI download: **blocked**, HTTP 403 from the environment proxy. No direct byte comparison to a fresh UCI-hosted workbook was possible. The explicit mirror and its provenance are documented, not a synthetic fallback.

## Automated checks

- `python -m pytest backend/tests -q`: **27 passed**. Tests cover revenue, distinct invoices, AOV, cancellation/negative quantity/invalid price handling, missing customer IDs, repeat customers, SQL reconciliation, empty results, inclusive date/country filters, invalid API parameters, missing database, money precision, partial/gap months, repeated ingestion, and concurrent API requests.
- `npm --prefix frontend run build`: **passed**, TypeScript checking and production Vite build.
- `npm --prefix frontend run test:smoke`: **9 passed** in Chromium. Checks use the real imported database for successful metrics. They cover exactly three landing sections, keyboard word changes, clipboard contents, dashboard navigation, country/date filter reconciliation against API responses, every dashboard view, preview metric/ranking/accent controls, accessible data tables, a genuinely empty selection, a deliberately injected 503 error, 320/375/768/1440-pixel layouts, and all word variants at 320 pixels.
- `git diff --check`: **passed**.

The pytest run emits one upstream Starlette deprecation warning about its httpx-based TestClient. Tests execute successfully; this is not a hidden skip. No tests are disabled or marked expected-failure.

## Reproduction and startup

- `bash scripts/setup.sh`: **passed** with the preserved original workbook, including pinned Python installation, frozen npm installation, repeat ingestion, backend tests and frontend build. npm uses a project-local cache because the managed home directory is not writable.
- `bash scripts/dev.sh`: **started and restarted successfully**; it manages both FastAPI and Vite child processes.
- Backend health returned `status: ok` and `dataset_ready: true`.
- Vite's `/api/overview` proxy returned real calculated KPIs.
- Tested runtime: Python 3.12.14, Node 24.19.0, npm 11.9.0, system Chromium. Python 3.11 is supported by the pinned dependency metadata but was not independently run. Other browsers/operating systems were not exercised.

Reusable `install_script` and `start_skill` instructions were saved to the environment draft, along with the required UCI domain addition. Saving a draft does not publish the environment. This describes validation before the GitHub handoff. Application deployment and environment publication were not performed.

Mac compatibility: the startup script uses a Bash 3.2-compatible process wait loop, and mirror checksum verification uses Python instead of GNU-only `sha256sum`. These paths were checked in Linux; native macOS execution remains unverified.
