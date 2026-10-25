from datetime import date
import sqlite3
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from backend.app.ingest import COLUMNS, build_database, clean
from backend.app import analytics as a
from backend.app.main import app

@pytest.fixture
def frame():
    rows = [
        ['1','A','Apple',2,'2011-01-01 10:00',10,101,'UK'],
        ['1','B','Bag',1,'2011-01-01 10:00',5,101,'UK'],
        ['2','A','Apple',1,'2011-02-28 23:59',10,101,'UK'],
        ['3','B',None,3,'2011-02-02',5,102,'France'],
        ['4','C','Cup',2,'2011-02-03',7,None,'UK'],
        ['C1','A','Apple',-1,'2011-02-04',10,101,'UK'],
        ['5','A','Apple',-2,'2011-02-04',10,101,'UK'],
        ['6','A','Apple',1,'2011-02-04',0,101,'UK'],
        ['7','A','Apple',1,'bad date',10,101,'UK'],
    ]
    rows.append(rows[0].copy())
    return pd.DataFrame(rows, columns=COLUMNS)

@pytest.fixture
def db(frame, tmp_path):
    path = tmp_path / 'retail.sqlite'
    build_database(frame, path)
    with a.connect(path) as connection:
        yield connection

@pytest.fixture
def client(frame, tmp_path, monkeypatch):
    path = tmp_path / 'retail.sqlite'
    build_database(frame, path)
    monkeypatch.setenv('METRICFLOW_DB', str(path))
    with TestClient(app) as client:
        yield client


def test_revenue_orders_aov(db):
    result = a.overview(db)
    assert result == dict(revenue=64, orders=4, average_order_value=16, customers=2, sales_rows=5)


def test_cleaning_audit(frame):
    audit, sales, q = clean(frame)
    assert q['raw_rows'] == 10 and q['valid_sales_rows'] == 5
    assert q['excluded_rows'] == sum(q['excluded_by_reason'].values()) == 5
    assert q['excluded_by_reason'] == dict(duplicate=1,cancellation=1,invalid_fields=1,invalid_quantity=1,invalid_price=1)
    assert q['negative_quantities'] == 2
    assert q['missing_customer_ids'] == 1
    assert len(audit) == len(frame)
    assert 'Description unavailable' in sales.description.tolist()


def test_repeat_customers(db):
    result = a.customers(db)
    assert result['customers'] == 2
    assert result['repeat_customers'] == 1
    assert result['repeat_customer_rate'] == .5
    assert result['excluded_anonymous_sales_rows'] == 1
    assert sum(b['customers'] for b in result['spending_distribution']) == 2


def test_inclusive_date_and_country_filters(db):
    assert a.overview(db, start=date(2011,2,1), end=date(2011,2,28))['revenue'] == 39
    assert a.overview(db, country='France')['revenue'] == 15
    assert a.overview(db, start=date(2011,2,1), country='UK')['orders'] == 2
    assert a.customers(db, country='France')['repeat_customer_rate'] == 0


def test_sql_consistency(db):
    total = a.overview(db)['revenue']
    assert sum(r['revenue'] for r in a.monthly(db)) == total
    assert sum(r['revenue'] for r in a.products(db)) == total
    assert sum(r['revenue'] for r in a.geography(db)) == total
    assert a.products(db, metric='quantity')[0]['stock_code'] == 'B'


def test_empty(db):
    assert a.overview(db, start=date(2020,1,1))['average_order_value'] == 0
    assert a.monthly(db, start=date(2020,1,1)) == []
    assert a.customers(db, start=date(2020,1,1))['repeat_customer_rate'] == 0

@pytest.mark.parametrize('path', ['/api/health','/api/filters','/api/overview','/api/sales/monthly','/api/products/top','/api/customers/summary','/api/geography','/api/data-quality'])
def test_endpoints(client, path):
    assert client.get(path).status_code == 200

@pytest.mark.parametrize('query', ['start=not-a-date','start=2012-01-01&end=2011-01-01',"country=' OR 1=1 --",'country=Atlantis'])
def test_bad_filters(client, query):
    assert client.get('/api/overview?' + query).status_code == 422


def test_product_validation(client):
    assert client.get('/api/products/top?metric=profit').status_code == 422
    assert client.get('/api/products/top?limit=999').status_code == 422


def test_api_filter_consistency(client):
    assert client.get('/api/overview?country=France').json()['revenue'] == 15
    assert client.get('/api/overview?start=2020-01-01').json()['orders'] == 0


def test_missing_database(tmp_path, monkeypatch):
    monkeypatch.setenv('METRICFLOW_DB', str(tmp_path / 'absent.sqlite'))
    with TestClient(app) as client:
        assert client.get('/api/health').json()['dataset_ready'] is False
        assert client.get('/api/overview').status_code == 503
    assert not (tmp_path / 'absent.sqlite').exists()


def test_schema_validation(frame):
    with pytest.raises(ValueError, match='Missing expected columns'):
        clean(frame.drop(columns='Country'))


def test_currency_precision(tmp_path):
    frame = pd.DataFrame([['1','A','A',3,'2011-01-01',.1,1,'UK'], ['2','A','A',1,'2011-01-02',.001,1,'UK']], columns=COLUMNS)
    path = tmp_path / 'money.sqlite'
    build_database(frame,path)
    with a.connect(path) as db:
        assert a.overview(db)['revenue'] == .301


def test_month_gaps_and_partial_periods(tmp_path):
    frame = pd.DataFrame([['1','A','A',1,'2011-01-01',10,1,'UK'],['2','A','A',1,'2011-03-01',20,1,'UK'],['3','A','A',1,'2011-04-15',30,1,'UK']],columns=COLUMNS)
    path = tmp_path / 'months.sqlite'
    build_database(frame,path)
    with a.connect(path) as db:
        months = a.monthly(db)
        assert len(months) == 4
        assert months[1]['revenue'] == 0
        assert months[1]['mom_change_pct'] == -100
        assert months[2]['mom_change_pct'] is None
        assert months[-1]['partial'] is True
        assert months[-1]['mom_change_pct'] is None


def test_ingestion_repeatable(frame,tmp_path):
    path = tmp_path / 'repeat.sqlite'
    first = build_database(frame,path)
    second = build_database(frame,path)
    assert first == second
    with a.connect(path) as db:
        assert a.overview(db)['revenue'] == 64


def test_concurrent_api_requests(client):
    from concurrent.futures import ThreadPoolExecutor
    paths = ['/api/overview', '/api/sales/monthly', '/api/products/top', '/api/customers/summary', '/api/geography', '/api/filters'] * 4
    with ThreadPoolExecutor(max_workers=8) as pool:
        responses = list(pool.map(client.get, paths))
    assert all(r.status_code == 200 for r in responses)


def test_full_calendar_month_filter(db):
    # January has all calendar days within dataset coverage, including its last day.
    result = a.monthly(db, start=date(2011,1,1), end=date(2011,1,31))
    assert result[0]['partial'] is False
