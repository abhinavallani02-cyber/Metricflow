import { useState } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Globe2,
  Layers3,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Brand,
  Chart,
  Empty,
  Failure,
  Filters,
  Kpis,
  Loading,
  MonthlyChart,
  Pill,
} from "./components";
import { emptySelection, number, useAnalytics, type Quality } from "./api";
function QualityView({ data }: { data: Quality }) {
  return (
    <div className="quality-view">
      <div className="notice-inline">
        <ShieldCheck size={20} />
        <p>
          Full dataset audit. These counts describe the original import and do
          not change with dashboard filters.
        </p>
      </div>
      <div className="quality-grid">
        {[
          ["Original records", data.raw_rows],
          ["Valid sales lines", data.valid_sales_rows],
          ["Excluded records", data.excluded_rows],
          ["Missing / invalid customer IDs", data.missing_customer_ids],
          ["Negative quantities", data.negative_quantities],
          ["Invalid records¹", data.invalid_records],
        ].map(([label, value]) => (
          <article key={label}>
            <small>{label}</small>
            <strong>{number(Number(value))}</strong>
          </article>
        ))}
      </div>
      <article className="methodology">
        <h3>Every exclusion, accounted for.</h3>
        <p>
          Each excluded row receives one reason, in the priority order below.
          Flags may overlap; exclusion totals do not.
        </p>
        <table>
          <thead>
            <tr>
              <th>Primary exclusion</th>
              <th>Records</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.excluded_by_reason).map(([k, v]) => (
              <tr key={k}>
                <td>{k.replaceAll("_", " ")}</td>
                <td>{number(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h4>Overlapping quality flags</h4>
        <dl className="flag-list">
          {Object.entries(data.flags).map(([k, v]) => (
            <div key={k}>
              <dt>{k.replaceAll("_", " ")}</dt>
              <dd>{number(v)}</dd>
            </div>
          ))}
        </dl>
        <p>
          ¹ Invalid records have missing required fields, nonpositive/noninteger
          quantities, or nonpositive/nonfinite prices. This overlaps
          cancellation and duplicate flags.
        </p>
        <h4>How to read the numbers</h4>
        <ul>
          <li>
            Revenue is gross positive sales in GBP. Cancellations and returns
            are excluded, not netted against sales. Revenue is not profit.
          </li>
          <li>
            Exact duplicate rows are retained in the audit and excluded after
            the first occurrence. Repeated legitimate lines cannot be
            distinguished with certainty.
          </li>
          <li>
            Anonymous sales count toward revenue and orders. Customer measures
            exclude {number(data.valid_sales_missing_customer_ids)}{" "}
            otherwise-valid anonymous sales lines.
          </li>
          <li>
            Orders are distinct invoice identifiers with at least one valid
            sales line; the workbook does not verify fulfillment.
          </li>
          <li>
            Missing descriptions: {number(data.missing_descriptions)} raw rows.
            Products are grouped by stock code, including non-merchandise codes
            such as postage. A stable, lexicographically greatest description
            labels each filtered group.
          </li>
          <li>
            Monthly changes are withheld for partial boundary months and when
            the previous month has no revenue. Dataset coverage ends partway
            through December 2011.
          </li>
        </ul>
        <h4>Source & reproducibility</h4>
        <p>
          UCI Online Retail, Daqing Chen (2015). DOI: 10.24432/C5BW33. CC BY
          4.0.
        </p>
        <p>
          Coverage: {data.min_date} to {data.max_date}. Source file:{" "}
          {data.provenance.file}.
        </p>
        <p className="checksum">
          Import source: {data.provenance.source}. Public mirror imports are
          explicitly recorded; consult the analysis report for verification
          limits.
        </p>
        <p className="checksum">
          SHA-256: {data.provenance.sha256 || "Not available"}
        </p>
      </article>
    </div>
  );
}
const views = [
  { name: "Overview", icon: Activity },
  { name: "Products", icon: Layers3 },
  { name: "Customers", icon: Users },
  { name: "Geography", icon: Globe2 },
  { name: "Data quality", icon: ShieldCheck },
];
export default function Dashboard() {
  const [selection, setSelection] = useState(emptySelection);
  const [tab, setTab] = useState("Overview");
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const { data, options, error, loading, retry } = useAnalytics(
    tab === "Data quality" ? emptySelection : selection,
  );
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Brand />
        <span className="sidebar-label">WORKSPACE</span>
        <nav aria-label="Dashboard sections">
          {views.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={tab === name ? "active" : ""}
              aria-current={tab === name ? "page" : undefined}
              onClick={() => setTab(name)}
            >
              <Icon size={17} />
              {name}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="dataset-badge">
            <span className="status-dot" />
            <span>
              UCI Online Retail<small>Historical dataset · GBP</small>
            </span>
          </div>
          <Link to="/">
            <ArrowLeft size={14} />
            Back to the story
          </Link>
        </div>
      </aside>
      <main id="main-content" className="dashboard-main">
        <div className="dashboard-top">
          <span>
            WORKSPACE <span>/</span> {tab.toUpperCase()}
          </span>
          <Pill>HISTORICAL ANALYSIS</Pill>
        </div>
        <header className="dashboard-title">
          <div>
            <h1>
              {tab === "Overview"
                ? "The bigger picture."
                : tab === "Products"
                  ? "What moves the needle."
                  : tab === "Customers"
                    ? "The people behind purchases."
                    : tab === "Geography"
                      ? "A world of transactions."
                      : "Clarity starts with clean data."}
            </h1>
            <p>
              {tab === "Data quality"
                ? "A transparent account of what is included, excluded, and unknown."
                : "Real retail transactions. A little easier to understand."}
            </p>
          </div>
          <BarChart3 size={28} strokeWidth={1} />
        </header>
        <div className="dashboard-filters">
          <Filters
            value={selection}
            onChange={setSelection}
            options={options}
          />
        </div>
        <div className="scope-note" aria-live="polite">
          {tab === "Data quality"
            ? "Scope: full original import · filters do not apply to this audit"
            : `Scope: ${selection.country || "All countries"} · ${selection.start || options?.min_date || "Beginning"} → ${selection.end || options?.max_date || "End of dataset"} · gross sales in GBP`}
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <Failure message={error} retry={retry} />
        ) : (
          data && (
            <>
              {tab === "Data quality" ? (
                <QualityView data={data.quality} />
              ) : (
                <>
                  <Kpis data={data} customers />
                  {data.overview.sales_rows === 0 ? (
                    <Empty />
                  ) : (
                    <>
                      {tab === "Overview" && (
                        <>
                          <div
                            className="monthly-switch segmented"
                            role="group"
                            aria-label="Monthly chart metric"
                          >
                            {(["revenue", "orders"] as const).map((m) => (
                              <button
                                key={m}
                                aria-pressed={metric === m}
                                className={metric === m ? "active" : ""}
                                onClick={() => setMetric(m)}
                              >
                                {m === "revenue" ? "Revenue" : "Orders"}
                              </button>
                            ))}
                          </div>
                          <MonthlyChart data={data} metric={metric} />
                          <div className="notice-inline">
                            <ShieldCheck size={18} />
                            <p>
                              Sales revenue includes valid positive sales only.
                              Returns and cancellations are excluded. This is
                              historical analysis, not a live business feed.
                            </p>
                          </div>
                        </>
                      )}
                      {tab === "Products" && (
                        <div className="dashboard-chart-grid">
                          <Chart
                            title="Top 10 products by revenue"
                            subtitle="Stock codes incl. postage/fees · gross GBP"
                            horizontal
                            currency
                            rows={data.products.map((p) => ({
                              name: p.description,
                              value: p.revenue,
                              note: `Stock code: ${p.stock_code}`,
                            }))}
                          />
                          <Chart
                            title="Top 10 products by units sold"
                            subtitle="Gross units · later cancellations are not netted"
                            horizontal
                            rows={data.units.map((p) => ({
                              name: p.description,
                              value: p.quantity,
                              note: `Stock code: ${p.stock_code}`,
                            }))}
                          />
                        </div>
                      )}
                      {tab === "Customers" && (
                        <>
                          <div className="customer-callout">
                            <div>
                              <span>Repeat customer rate</span>
                              <strong>
                                {(
                                  data.customers.repeat_customer_rate * 100
                                ).toFixed(1)}
                                <small>%</small>
                              </strong>
                              <p>
                                {number(data.customers.repeat_customers)} of{" "}
                                {number(data.customers.customers)} identifiable
                                customers made at least two orders in this
                                selection.
                              </p>
                            </div>
                            <Users size={44} strokeWidth={1} />
                          </div>
                          <Chart
                            title="Customer spending distribution"
                            subtitle="Gross spending per identifiable customer · GBP bands"
                            rows={data.customers.spending_distribution.map(
                              (b) => ({ name: b.band, value: b.customers }),
                            )}
                          />
                          <p className="scope-note">
                            Customer subset:{" "}
                            {number(
                              data.customers.excluded_anonymous_sales_rows,
                            )}{" "}
                            selected sales lines without valid customer IDs are
                            excluded. Repeat behavior is measured within the
                            selected period, not lifetime.
                          </p>
                        </>
                      )}
                      {tab === "Geography" && (
                        <div className="dashboard-chart-grid">
                          <Chart
                            title="Revenue by country"
                            subtitle="Chart shows top 10 by revenue"
                            horizontal
                            currency
                            rows={data.geography
                              .slice(0, 10)
                              .map((c) => ({
                                name: c.country,
                                value: c.revenue,
                              }))}
                          />
                          <Chart
                            title="Orders by country"
                            subtitle="Chart shows top 10 by distinct orders"
                            horizontal
                            rows={[...data.geography]
                              .sort((a, b) => b.orders - a.orders)
                              .slice(0, 10)
                              .map((c) => ({
                                name: c.country,
                                value: c.orders,
                              }))}
                          />
                          <article className="chart-card full-width">
                            <h3>All selected countries</h3>
                            <div className="table-scroll">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Country</th>
                                    <th>Revenue (GBP)</th>
                                    <th>Orders</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {data.geography.map((c) => (
                                    <tr key={c.country}>
                                      <th scope="row">{c.country}</th>
                                      <td>
                                        {c.revenue.toLocaleString("en-GB", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </td>
                                      <td>{number(c.orders)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </article>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )
        )}
        <footer className="dashboard-footer">
          MetricFlow / Transparent by design.
          <span>Source: UCI Machine Learning Repository</span>
        </footer>
      </main>
    </div>
  );
}
