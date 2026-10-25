"""Reproducible UCI import. Preserve workbook; audit every input row."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import tempfile
import zipfile

import httpx
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = ROOT / 'data/processed/retail.sqlite'
SOURCE = 'https://archive.ics.uci.edu/static/public/352/online+retail.zip'
COLUMNS = ['InvoiceNo', 'StockCode', 'Description', 'Quantity', 'InvoiceDate', 'UnitPrice', 'CustomerID', 'Country']
SCALE = 10_000


def clean(frame: pd.DataFrame):
    missing = set(COLUMNS) - set(frame.columns)
    if missing:
        raise ValueError(f'Missing expected columns: {sorted(missing)}')
    frame = frame[COLUMNS].copy()
    duplicate = frame.duplicated(keep='first')
    text = lambda key: frame[key].astype('string').str.strip().replace('', pd.NA)
    qty = pd.to_numeric(frame.Quantity, errors='coerce')
    price = pd.to_numeric(frame.UnitPrice, errors='coerce')
    customer = pd.to_numeric(frame.CustomerID, errors='coerce')
    dates = pd.to_datetime(frame.InvoiceDate, errors='coerce', format='mixed')
    invoice, stock, country = text('InvoiceNo'), text('StockCode'), text('Country')
    cancellation = invoice.str.upper().str.startswith('C').fillna(False)
    invalid_fields = invoice.isna() | stock.isna() | country.isna() | dates.isna()
    invalid_quantity = ~np.isfinite(qty) | (qty <= 0) | (qty % 1 != 0)
    invalid_price = ~np.isfinite(price) | (price <= 0)
    identifiable = customer.notna() & np.isfinite(customer) & (customer > 0) & (customer % 1 == 0)
    flags = {'duplicate': duplicate, 'cancellation': cancellation, 'invalid_fields': invalid_fields,
             'invalid_quantity': invalid_quantity, 'invalid_price': invalid_price}
    reason = pd.Series('valid_sale', index=frame.index)
    for name, mask in reversed(list(flags.items())):
        reason.loc[mask] = name
    # Integer ten-thousandths of GBP avoid binary float accumulation in SQL.
    valid = reason.eq('valid_sale')
    rows = pd.DataFrame({'source_row': np.arange(len(frame)) + 2,
                         'invoice': invoice, 'stock_code': stock,
                         'description': text('Description').fillna('Description unavailable'),
                         'quantity': qty, 'invoice_date': dates.dt.strftime('%Y-%m-%d %H:%M:%S'),
                         'unit_price': price, 'customer_id': customer.where(identifiable).astype('Int64').astype('string'),
                         'country': country, 'exclusion_reason': reason})
    for name, mask in flags.items():
        rows[name] = mask.astype(int)
    rows['missing_customer'] = (~identifiable).astype(int)
    sales = rows.loc[valid, ['source_row', 'invoice', 'stock_code', 'description', 'quantity', 'invoice_date', 'customer_id', 'country']].copy()
    sales['quantity'] = sales.quantity.astype('int64')
    sales['revenue_units'] = np.rint(qty[valid] * price[valid] * SCALE).astype('int64')
    quality = {'raw_rows': len(frame), 'valid_sales_rows': int(valid.sum()), 'excluded_rows': int((~valid).sum()),
               'excluded_by_reason': {k: int(reason.eq(k).sum()) for k in flags},
               'flags': {k: int(v.sum()) for k, v in flags.items()},
               'missing_customer_ids': int((~identifiable).sum()),
               'valid_sales_missing_customer_ids': int((~identifiable & valid).sum()),
               'negative_quantities': int((qty < 0).sum()),
               'invalid_records': int((invalid_fields | invalid_quantity | invalid_price).sum()),
               'missing_descriptions': int(text('Description').isna().sum()),
               'min_date': dates.min().strftime('%Y-%m-%d') if dates.notna().any() else None,
               'max_date': dates.max().strftime('%Y-%m-%d') if dates.notna().any() else None}
    return rows, sales, quality


def build_database(frame, destination=DEFAULT_DB, provenance=None):
    rows, sales, quality = clean(frame)
    quality['provenance'] = provenance or {'source': 'explicit test fixture'}
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=destination.parent, suffix='.sqlite')
    os.close(fd)
    try:
        with sqlite3.connect(temporary) as db:
            rows.to_sql('row_audit', db, index=False)
            sales.to_sql('sales', db, index=False)
            db.executescript('''
                CREATE INDEX sales_date ON sales(invoice_date);
                CREATE INDEX sales_country_date ON sales(country, invoice_date);
                CREATE INDEX sales_invoice ON sales(invoice);
                CREATE INDEX sales_customer ON sales(customer_id);
                CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            ''')
            db.execute('INSERT INTO metadata VALUES (?, ?)', ('quality', json.dumps(quality)))
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return quality


def acquire(source_file=None):
    target = ROOT / 'data/raw/Online Retail.xlsx'
    target.parent.mkdir(parents=True, exist_ok=True)
    if source_file:
        source_file = Path(source_file).resolve()
        if target.exists() and source_file != target.resolve():
            if hashlib.sha256(target.read_bytes()).digest() != hashlib.sha256(source_file.read_bytes()).digest():
                raise ValueError('Existing original workbook differs; preserve it before importing another file.')
        elif source_file != target.resolve():
            shutil.copy2(source_file, target)
    elif not target.exists():
        try:
            with httpx.Client(follow_redirects=True, timeout=120) as client:
                response = client.get(SOURCE)
                response.raise_for_status()
            archive = target.parent / 'online-retail.zip'
            archive.write_bytes(response.content)
            with zipfile.ZipFile(archive) as z:
                member = next(n for n in z.namelist() if n.endswith('Online Retail.xlsx'))
                temporary = target.with_suffix('.tmp')
                temporary.write_bytes(z.read(member))
                temporary.replace(target)
        except Exception as exc:
            raise RuntimeError(f'UCI download failed: {exc}. Allow archive.ics.uci.edu or use --source /path/to/Online Retail.xlsx. No substitute data was loaded.') from exc
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, help='Import the original UCI workbook from disk')
    parser.add_argument('--source-url', help='Record an explicit import provenance URL; no automatic mirror fallback')
    args = parser.parse_args()
    try:
        source = acquire(args.source)
        manifest = source.with_suffix('.provenance.json')
        provenance = json.loads(manifest.read_text()) if manifest.exists() else {}
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        if provenance.get('sha256') and provenance['sha256'] != digest:
            raise ValueError('Preserved workbook checksum differs from its provenance manifest. Investigate before rebuilding.')
        frame = pd.read_excel(source, engine='openpyxl')
        provenance.update({'source': args.source_url or provenance.get('source', 'local import' if args.source else SOURCE), 'official_source': SOURCE, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'file': source.name})
        quality = build_database(frame, provenance=provenance)
        manifest.write_text(json.dumps(provenance, indent=2) + '\n')
        print(json.dumps(quality, indent=2))
    except Exception as exc:
        parser.exit(1, f'{exc}\n')

if __name__ == '__main__':
    main()
