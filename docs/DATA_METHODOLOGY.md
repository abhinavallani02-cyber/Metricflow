# Data methodology

## Provenance and preservation

UCI Online Retail, Daqing Chen (2015), DOI 10.24432/C5BW33, CC BY 4.0. Attribution belongs to the dataset author; MetricFlow applies the transformations below. Source landing page: https://archive.ics.uci.edu/dataset/352/online+retail.

The primary pipeline downloads the official ZIP over verified HTTPS. A download failure is explicit; there is no silent substitute. `--source` imports the original Excel workbook. The original file and provenance manifest are preserved under `data/raw`, separately from `data/processed/retail.sqlite`.

For this execution the cloud proxy denied UCI (403). The explicit mirror command uses https://raw.githubusercontent.com/rajeevratan84/datascienceforbusiness/9400ac76111ec06fb6f73395bdb04cbb7d07f0de/Online%20Retail.xlsx and checks SHA-256 `43465a06f2ccf7c8b5bd2892bc7defb52f97487934fe93b16ae4c3936424676d`. Observed schema, 541,909 rows, and 2010-12-01–2011-12-09 coverage match the described UCI dataset. Direct byte comparison against the official server remains unverified. No synthetic transactions were substituted.

## Validation and transformations

Required columns: InvoiceNo, StockCode, Description, Quantity, InvoiceDate, UnitPrice, CustomerID, Country. Missing columns fail the import. Mixed-format dates are parsed, invalid dates become audited invalid fields. Invoice/stock/country strings are trimmed. Dates retain the source's local clock; the workbook supplies no timezone. Filters therefore operate on source calendar dates, without timezone conversion.

Every input row appears in `row_audit` with its original Excel row number (`source_row`, starting at 2), normalized values, quality flags and one mutually exclusive primary disposition. The workbook preserves all original values, including values that fail parsing. Nothing disappears without accounting.

The first applicable exclusion wins, in this priority order:

1. **duplicate:** exact equality across the eight original columns, after the first occurrence. Duplicates are detected before string normalization. This is an explicit assumption, not proof of erroneous duplication.
2. **cancellation:** invoice identifier starts with C, case-insensitive. Applies regardless of quantity sign.
3. **invalid_fields:** missing/blank invoice, stock code, country, or unparseable date.
4. **invalid_quantity:** missing, nonfinite, zero, negative, or noninteger quantity.
5. **invalid_price:** missing, nonfinite, zero, or negative unit price.
6. Otherwise **valid_sale**.

Every exclusion flag is also counted independently; these overlapping counts must not be summed. `invalid_records` is the union of invalid fields/quantity/price. All sales have positive quantities and prices. Returns and cancellations are excluded; they are not matched to original sales or used to compute net revenue. A valid original positive sale remains included even if a later cancellation exists.

Customer IDs must be positive finite integers and are stored as normalized text identifiers. Missing or invalid IDs become null and are counted together in the quality summary. Such sales are still included in revenue and orders. Missing descriptions become “Description unavailable” rather than being dropped. Products are grouped by stock code, with the lexicographically greatest available description in the filtered group as a deterministic display label. No undocumented removal of postage, fees, or other positive non-merchandise codes occurs.

## Storage and precision

`sales` stores only valid analytical lines. `row_audit` retains every source record's audit decision. `metadata` contains the quality summary and provenance JSON. Date, country/date, invoice and customer indexes support filters and grouping. The database is built in a temporary file and replaced atomically after success; interrupted imports do not replace the previous database.

Revenue is rounded at the line level to integer ten-thousandths of GBP (`revenue_units`, scale 10,000). This preserves the observed sub-penny prices while avoiding binary floating-point accumulation in SQLite. A future dataset with more than four decimal places would be quantized to that precision and needs a policy review. API values are numeric GBP; the UI rounds for presentation to two decimals. AOV uses unrounded aggregate revenue divided by invoice count.

Connections are read-only, unique per request, and closed after use. `check_same_thread=False` permits FastAPI to execute sequential dependency stages in different threadpool threads; connections are never globally shared. Query values are bound parameters. Sort fields are selected from fixed allowlists.

## Dates, empty selections, and interpretation

Filters apply to sales lines before every metric calculation. Both start and end dates are inclusive. Countries must exist in valid sales. Empty valid selections return zero KPIs, empty product/country/monthly arrays and zero customer-band counts. Global data quality deliberately ignores filters and is labeled accordingly.

Monthly results include zero-valued intervening calendar months. A month is partial if the selected range or original coverage does not include every calendar date in it. Revenue MoM requires consecutive complete months and a nonzero previous-month denominator. December 2011 is incomplete. Starting/ending clock times within a calendar date are not used to infer intraday completeness.

The analysis is descriptive of this retailer and this historical window. Customer IDs missing nonrandomly can bias customer results. There is no defensible conversion rate, profit margin, lifetime prediction, causal effect, or churn probability in this dataset alone.
