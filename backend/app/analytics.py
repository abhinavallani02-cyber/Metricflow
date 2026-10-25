"""SQL is the source of truth for business metrics; all values are gross sales."""
import json
import sqlite3
from contextlib import contextmanager
from datetime import date, timedelta
from pathlib import Path
from .ingest import SCALE

@contextmanager
def connect(path):
    db = sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True, check_same_thread=False)
    db.row_factory = sqlite3.Row
    try:
        yield db
    finally:
        db.close()


def predicate(start=None, end=None, country=None):
    clauses, params = ['1=1'], []
    if start:
        clauses.append('invoice_date >= ?')
        params.append(str(start))
    if end:
        clauses.append('invoice_date < date(?, "+1 day")')
        params.append(str(end))
    if country:
        clauses.append('country = ?')
        params.append(country)
    return ' AND '.join(clauses), params


def overview(db, **filters):
    where, args = predicate(**filters)
    row = db.execute(f'''SELECT COALESCE(SUM(revenue_units),0) AS revenue,
        COUNT(DISTINCT invoice) AS orders, COUNT(DISTINCT customer_id) AS customers,
        COUNT(*) AS sales_rows FROM sales WHERE {where}''', args).fetchone()
    revenue = row['revenue'] / SCALE
    return dict(revenue=revenue, orders=row['orders'], customers=row['customers'],
                average_order_value=revenue / row['orders'] if row['orders'] else 0, sales_rows=row['sales_rows'])


def quality(db):
    return json.loads(db.execute("SELECT value FROM metadata WHERE key='quality'").fetchone()[0])


def monthly(db, **filters):
    where, args = predicate(**filters)
    rows = db.execute(f'''SELECT substr(invoice_date,1,7) AS month,
        SUM(revenue_units) / {SCALE}.0 AS revenue, COUNT(DISTINCT invoice) AS orders
        FROM sales WHERE {where} GROUP BY month ORDER BY month''', args).fetchall()
    if not rows:
        return []
    by_month = {r['month']: dict(r) for r in rows}
    info = quality(db)
    lower = max(str(filters.get('start') or info['min_date']), info['min_date'])
    upper = min(str(filters.get('end') or info['max_date']), info['max_date'])
    current = date.fromisoformat(lower).replace(day=1)
    last = date.fromisoformat(upper).replace(day=1)
    result = []
    while current <= last:
        next_month = date(current.year + (current.month == 12), current.month % 12 + 1, 1)
        key = current.strftime('%Y-%m')
        item = by_month.get(key, dict(month=key, revenue=0.0, orders=0))
        # Inclusive calendar-day filters; flag months truncated by selected or dataset boundaries.
        item['partial'] = str(current) < lower or str(next_month - timedelta(days=1)) > upper
        previous = result[-1] if result else None
        item['mom_change_pct'] = ((item['revenue'] / previous['revenue'] - 1) * 100
            if previous and previous['revenue'] > 0 and not item['partial'] and not previous['partial'] else None)
        result.append(item)
        current = next_month
    return result


def products(db, metric='revenue', limit=10, **filters):
    where, args = predicate(**filters)
    order = {'revenue': 'revenue', 'quantity': 'quantity'}[metric]
    return [dict(r) for r in db.execute(f'''SELECT stock_code, MAX(description) AS description,
        SUM(revenue_units) / {SCALE}.0 AS revenue, SUM(quantity) AS quantity,
        COUNT(DISTINCT invoice) AS orders FROM sales WHERE {where}
        GROUP BY stock_code ORDER BY {order} DESC, stock_code LIMIT ?''', [*args, limit])]


def geography(db, **filters):
    where, args = predicate(**filters)
    return [dict(r) for r in db.execute(f'''SELECT country, SUM(revenue_units) / {SCALE}.0 AS revenue,
        COUNT(DISTINCT invoice) AS orders FROM sales WHERE {where}
        GROUP BY country ORDER BY revenue DESC, country''', args)]


def customers(db, **filters):
    where, args = predicate(**filters)
    # One row per identifiable customer, with invoice frequency rather than line count.
    cte = f'''WITH purchase_frequency AS (
        SELECT customer_id, COUNT(DISTINCT invoice) AS orders, SUM(revenue_units) / {SCALE}.0 AS spending
        FROM sales WHERE {where} AND customer_id IS NOT NULL GROUP BY customer_id)'''
    row = db.execute(cte + ''' SELECT COUNT(*) AS customers,
        COALESCE(SUM(CASE WHEN orders >= 2 THEN 1 ELSE 0 END),0) AS repeat_customers FROM purchase_frequency''', args).fetchone()
    bins = [('[0, 100)', 0, 100), ('[100, 500)', 100, 500), ('[500, 1,000)', 500, 1000),
            ('[1,000, 5,000)', 1000, 5000), ('[5,000, ∞)', 5000, None)]
    distribution = []
    for label, low, high in bins:
        clause = 'spending >= ?' + (' AND spending < ?' if high is not None else '')
        count = db.execute(cte + f' SELECT COUNT(*) FROM purchase_frequency WHERE {clause}', [*args, low] + ([high] if high is not None else [])).fetchone()[0]
        distribution.append(dict(band=label, customers=count))
    missing = db.execute(f'SELECT COUNT(*) FROM sales WHERE {where} AND customer_id IS NULL', args).fetchone()[0]
    return dict(customers=row['customers'], repeat_customers=row['repeat_customers'],
                repeat_customer_rate=row['repeat_customers'] / row['customers'] if row['customers'] else 0,
                excluded_anonymous_sales_rows=missing, spending_distribution=distribution)
