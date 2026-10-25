import os
import sqlite3
from datetime import date
from pathlib import Path
from typing import Annotated, Literal
from fastapi import Depends, FastAPI, HTTPException, Query
from . import analytics as a
from . import models as m
from .ingest import DEFAULT_DB

app = FastAPI(title='MetricFlow', version='1.0.0', description='Historical UCI retail analysis. Gross sales, not profit or net revenue.')

def db_path():
    return Path(os.environ.get('METRICFLOW_DB', DEFAULT_DB))

def database():
    if not db_path().is_file():
        raise HTTPException(503, 'Dataset not loaded. Run python -m backend.app.ingest with access to archive.ics.uci.edu, or import the original UCI workbook using --source.')
    try:
        with a.connect(db_path()) as db:
            yield db
    except sqlite3.DatabaseError as exc:
        raise HTTPException(503, 'Analytical database unavailable. Re-run ingestion.') from exc

DB = Annotated[sqlite3.Connection, Depends(database)]

def selected_filters(db: DB, start: date | None = None, end: date | None = None, country: str | None = Query(None, max_length=100)):
    if start and end and start > end:
        raise HTTPException(422, 'Start date must be on or before end date.')
    if country and not db.execute('SELECT 1 FROM sales WHERE country = ? LIMIT 1', (country,)).fetchone():
        raise HTTPException(422, 'Unsupported country. Choose a country from /api/filters.')
    return dict(start=start, end=end, country=country)

Selected = Annotated[dict, Depends(selected_filters)]

@app.get('/api/health', response_model=m.Health)
def health():
    ready = False
    if db_path().is_file():
        try:
            with a.connect(db_path()) as db:
                a.overview(db)
                a.quality(db)
                ready = True
        except (sqlite3.DatabaseError, ValueError, TypeError):
            pass
    return dict(status='ok' if ready else 'data_unavailable', dataset_ready=ready)

@app.get('/api/filters', response_model=m.Filters)
def filters(db: DB):
    info = a.quality(db)
    return dict(countries=[r[0] for r in db.execute('SELECT DISTINCT country FROM sales ORDER BY country')], min_date=info['min_date'], max_date=info['max_date'])

@app.get('/api/overview', response_model=m.Overview)
def overview(db: DB, selected: Selected):
    return a.overview(db, **selected)

@app.get('/api/sales/monthly', response_model=list[m.Month])
def monthly(db: DB, selected: Selected):
    return a.monthly(db, **selected)

@app.get('/api/products/top', response_model=list[m.Product])
def products(db: DB, selected: Selected, metric: Literal['revenue', 'quantity'] = 'revenue', limit: int = Query(10, ge=1, le=10)):
    return a.products(db, metric, limit, **selected)

@app.get('/api/customers/summary', response_model=m.Customers)
def customers(db: DB, selected: Selected):
    return a.customers(db, **selected)

@app.get('/api/geography', response_model=list[m.Country])
def geography(db: DB, selected: Selected):
    return a.geography(db, **selected)

@app.get('/api/data-quality', response_model=m.Quality)
def quality(db: DB):
    return a.quality(db)
