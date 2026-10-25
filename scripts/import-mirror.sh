#!/usr/bin/env bash
# Explicit alternative when the official UCI host is inaccessible. Never called silently.
set -euo pipefail
cd "$(dirname "$0")/.."
source_url='https://raw.githubusercontent.com/rajeevratan84/datascienceforbusiness/9400ac76111ec06fb6f73395bdb04cbb7d07f0de/Online%20Retail.xlsx'
source_hash='43465a06f2ccf7c8b5bd2892bc7defb52f97487934fe93b16ae4c3936424676d'
retail_tmp=$(mktemp -d)
trap 'rm -rf "$retail_tmp"' EXIT
curl --fail --location --retry 2 "$source_url" --output "$retail_tmp/Online Retail.xlsx"
.venv/bin/python - "$source_hash" "$retail_tmp/Online Retail.xlsx" <<'VERIFY'
import hashlib
import pathlib
import sys
expected, filename = sys.argv[1:]
actual = hashlib.sha256(pathlib.Path(filename).read_bytes()).hexdigest()
if actual != expected:
    raise SystemExit('Workbook checksum mismatch; import stopped.')
print('Workbook SHA-256 verified.')
VERIFY
.venv/bin/python -m backend.app.ingest --source "$retail_tmp/Online Retail.xlsx" --source-url "$source_url"
