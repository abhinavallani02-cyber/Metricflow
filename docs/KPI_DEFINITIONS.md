# KPI definitions

All business metrics use the same filtered `sales` table. “Valid” follows [DATA_METHODOLOGY.md](DATA_METHODOLOGY.md). SQL implementations live in `backend/app/analytics.py`; response contracts live in `backend/app/models.py`.

| Metric | Definition | Important qualification |
| --- | --- | --- |
| Sales revenue | `SUM(revenue_units) / 10000.0`; each line is quantity × unit price | Gross positive sales in GBP; returns excluded, not netted; not profit |
| Completed orders | `COUNT(DISTINCT invoice)` | An invoice with at least one valid selected sales line; fulfillment not independently known |
| Average order value | Revenue / distinct orders, or 0 for an empty selection | Includes anonymous valid sales; not mean line value |
| Identifiable customers | `COUNT(DISTINCT customer_id)` | SQL excludes null IDs; one customer counted once in the selection |
| Monthly revenue/orders | Same calculations grouped by `substr(invoice_date,1,7)` | Missing intervening months zero-filled; partial boundary months flagged |
| Revenue MoM | `(current / previous - 1) × 100` | Null unless both consecutive calendar months are complete and previous revenue > 0 |
| Product revenue ranking | Revenue grouped by `stock_code`, descending | Includes positive non-merchandise codes; description is a label, not a key |
| Product unit ranking | `SUM(quantity)` grouped by `stock_code`, descending | Valid positive units only; tie broken by stock code |
| Country revenue/orders | Revenue and distinct invoices grouped by country | Country on transaction; not verified customer residence |
| Customer purchase frequency | Distinct invoices per non-null customer in selection | Multiple lines on one invoice are not repeat purchases |
| Repeat customer rate | Customers with ≥2 invoices / identifiable customers | Fraction 0–1 in API, percent in UI; measured within selection, not lifetime |
| Customer spending distribution | Aggregate selected revenue per identifiable customer, then count into GBP bands | `[0,100)`, `[100,500)`, `[500,1000)`, `[1000,5000)`, `[5000,∞)`; lower-inclusive/upper-exclusive |

Customer denominators exclude anonymous transactions; revenue/order denominators include them. Never mix those populations without disclosure. The customer endpoint returns `excluded_anonymous_sales_rows` to quantify the selected subset.

The country endpoint returns every selected country; charts may show the top ten but the dashboard also has a complete table. Product endpoints return at most ten ranked items. Country order counts should not be assumed additive for arbitrary future data where one invoice appears in multiple countries. Monthly order counts have the same caveat for invoices spanning months; revenue remains additive.

## SQL examples

```sql
-- Executive KPIs; parameters are bound, never interpolated values.
SELECT COALESCE(SUM(revenue_units), 0) / 10000.0 AS revenue,
       COUNT(DISTINCT invoice) AS orders,
       COUNT(DISTINCT customer_id) AS customers
FROM sales
WHERE invoice_date >= :start
  AND invoice_date < date(:end, '+1 day')
  AND country = :country;

-- Customer frequency; repeat means invoices, not rows.
SELECT customer_id, COUNT(DISTINCT invoice) AS orders,
       SUM(revenue_units) / 10000.0 AS spending
FROM sales
WHERE customer_id IS NOT NULL
GROUP BY customer_id;
```

The executable versions support independently omitted date/country parameters. Empty denominators return 0 for AOV/repeat rate and null for undefined MoM. The UI distinguishes empty selections from API failures and missing data; neither is replaced with invented values.
