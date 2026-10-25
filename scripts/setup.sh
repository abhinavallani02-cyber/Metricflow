#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
npm --prefix frontend ci --cache .npm-cache
.venv/bin/python -m backend.app.ingest "$@"
.venv/bin/python -m pytest backend/tests -q
npm --prefix frontend run build
