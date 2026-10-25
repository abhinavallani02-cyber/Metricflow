# MetricFlow

**Your retail data, made clear.**

A functioning educational retail analytics application built with Python, SQL and React. Explore historical sales, products, customer purchasing and country trends with consistent filters and transparent metric definitions. Designed for analysts learning retail analytics, students building reproducible research, and anyone curious about transaction data.

This is a historical dataset explorer, not a live business service. There are no accounts, payments, predictions, or fabricated dashboard metrics.

## Dataset and current results

[UCI Online Retail](https://archive.ics.uci.edu/dataset/352/online+retail), Daqing Chen (2015), DOI [10.24432/C5BW33](https://doi.org/10.24432/C5BW33), licensed CC BY 4.0. A UK-based online retailer's transactions from 1 December 2010 through 9 December 2011.

The current import contains 541,909 original rows, 524,878 valid sales lines and 17,031 documented exclusions. Executed SQL gives **£10,642,110.80 gross sales**, **19,960 distinct sales invoices**, **£533.17 AOV**, and **4,338 identifiable customers**. These are outputs of the documented cleaning policy, not hardcoded application values. See [the generated analysis report](docs/ANALYSIS_REPORT.md) for evidence and limitations.

The cloud proxy denied the direct UCI download (HTTP 403). This instance explicitly imported a public mirror of `Online Retail.xlsx` at a pinned Git revision, validated the schema/count/date range, and recorded SHA-256 `43465a06f2ccf7c8b5bd2892bc7defb52f97487934fe93b16ae4c3936424676d`. The mirror is not an automatic fallback; details and the exact URL are in the report. Byte equality against a fresh official-host download remains unverified.

## Architecture

```text
Metricflow/                       # existing repository root
├── backend/
│   ├── app/ingest.py             # download/import, cleaning, full row audit, atomic SQLite build
│   ├── app/analytics.py          # parameterized SQL and metric definitions
│   ├── app/main.py               # FastAPI routes, validation, connection lifecycle
│   ├── app/models.py             # typed Pydantic responses
│   ├── app/report.py             # executed-query report + independent Pandas checks
│   ├── tests/test_analytics.py   # independent small fixtures and API regressions
│   └── requirements.txt          # pinned Python environment
├── frontend/
│   ├── src/api.ts               # typed API client, cancellation, errors
│   ├── src/components.tsx       # filters, cards, charts and accessible tables
│   ├── src/Dashboard.tsx        # overview/products/customers/geography/quality workspace
│   ├── src/Landing.tsx          # exactly three primary sections
│   ├── src/styles.css           # responsive dark design system + Tailwind
│   ├── tests/smoke.spec.ts      # Chromium checks against actual API data
│   └── package-lock.json
├── data/raw/                    # preserved original workbook + provenance; gitignored
├── data/processed/              # SQLite and generated summary; gitignored
├── docs/                        # methodology, KPI definitions, analysis and verification
└── scripts/                     # reproducible setup, explicit mirror import, service startup
```

React + Vite + TypeScript, Tailwind CSS, Motion, Recharts, Lucide and self-hosted Inter run in the browser. FastAPI, Pydantic, Pandas, NumPy and SQLite perform the data work. Vite proxies `/api` to the Python service; no external database, API key, or CDN font is needed. SQL is the source of truth for aggregates. Each request has a separate read-only SQLite connection; FastAPI's threadpool can move that connection between sequential request stages.

## Install and run

Requirements: **Python 3.11+**, **Node 22.12+** (Node 24 works), npm, and Bash. Tested here on Python 3.12 and Node 24. Python 3.11 is dependency-compatible but was not independently executed.

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
python -m backend.app.ingest
npm --prefix frontend ci --cache .npm-cache
bash scripts/dev.sh
```

The script starts FastAPI on port **8000** and Vite on **5173** and stops its children on exit. Open the Vite address locally. `/` is the landing page; `/dashboard` is the full workspace. API documentation is served at backend `/docs`. Windows users can use WSL, or start each service in separate terminals using equivalent virtual environment activation.

Alternative one-command install, ingestion, tests and frontend build:

```bash
bash scripts/setup.sh
```

If the official download fails, the pipeline exits with an error and loads no substitute. Either allow `archive.ics.uci.edu` in environment network settings, or import the original workbook yourself:

```bash
.venv/bin/python -m backend.app.ingest --source '/path/to/Online Retail.xlsx'
```

To reproduce this instance's explicitly documented mirror import:

```bash
bash scripts/import-mirror.sh
```

This fetches a pinned GitHub copy, checks the recorded checksum, preserves the original in `data/raw`, and records its provenance. It requires `curl`; checksum verification uses Python. It never runs automatically after a UCI failure. Ingestion refuses to overwrite a differing original workbook. Repeated ingestion rebuilds the database atomically and reuses the preserved original; it does not duplicate rows.

## Reproduce and verify

```bash
.venv/bin/python -m backend.app.ingest
.venv/bin/python -m backend.app.report
.venv/bin/python -m pytest backend/tests -q
npm --prefix frontend run build
# With scripts/dev.sh running:
npm --prefix frontend run test:smoke
```

Browser tests use `/usr/bin/chromium` when available, or Playwright's installed Chromium. On another machine run `cd frontend && npx playwright install chromium`, or set `CHROMIUM_PATH` to your browser executable. Browser tests deliberately require the real ingested dataset; fixture data is confined to backend tests and is never loaded into the UI.

The report generator checks SQL totals against independent Pandas arithmetic on the retained audit, reconciles country/monthly totals, and writes actual findings into `docs/ANALYSIS_REPORT.md`. Validation results are recorded in [docs/VERIFICATION.md](docs/VERIFICATION.md).

## API

All analytics endpoints return typed JSON. Date filters use ISO `YYYY-MM-DD`, inclusive of both calendar dates; country must match `/api/filters`. Omitted filters mean all available records. Reversed dates, invalid dates, unknown countries, unsupported metrics, and limits outside 1–10 return HTTP 422. Missing/unusable analytical data returns 503 with an actionable message. `/api/health` returns 200 with explicit `dataset_ready: false` when data is unavailable.

| GET endpoint | Purpose / query parameters |
| --- | --- |
| `/api/health` | Service and database readiness |
| `/api/filters` | Available countries and original date bounds |
| `/api/overview` | Revenue, orders, AOV, customers; `start`, `end`, `country` |
| `/api/sales/monthly` | Monthly revenue/orders, partial flags, meaningful MoM; same filters |
| `/api/products/top` | Stock-code rankings; same filters + `metric=revenue\|quantity`, `limit=1..10` |
| `/api/customers/summary` | Identifiable/returning customers, spending bands; same filters |
| `/api/geography` | All selected countries, revenue and order counts; same filters |
| `/api/data-quality` | Global full-import audit, independent of dashboard filters |

## Interpret responsibly

- Revenue means positive valid sales, not profit or net revenue. Returns/cancellations are excluded, not matched and subtracted. “Completed” means an invoice with a valid sales line; fulfillment is not verified.
- Anonymous sales remain in revenue/orders; customer statistics exclude invalid/missing IDs and may be biased.
- Exact duplicate removal is an explicit analytical assumption. The workbook lacks line-level IDs to prove whether every repeated row is accidental.
- Positive postage/fee codes remain included. Rankings are stock-code rankings, not a curated merchandise catalog; the largest gross orders may subsequently have cancellations.
- Partial months are flagged; MoM is not shown when either month is partial or the previous revenue is zero. Chart tables expose period context and all displayed values.
- No cost, traffic, acquisition, or inventory data supports profit, conversion, CAC, churn predictions or causal claims.
- This MVP targets local development on one historical workbook, not multi-tenant deployment. Large file ingestion needs memory and takes tens of seconds. Live processes must restart in new cloud tasks.

See [DATA_METHODOLOGY.md](docs/DATA_METHODOLOGY.md) and [KPI_DEFINITIONS.md](docs/KPI_DEFINITIONS.md).

Optional navigation link: copy `frontend/.env.example` to `frontend/.env.local` and set `VITE_GITHUB_URL` to a real HTTPS GitHub repository URL. It is omitted unless configured; restart Vite after changing it. No GitHub authentication is required to run the app.
