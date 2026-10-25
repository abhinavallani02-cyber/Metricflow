import { useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  RotateCcw,
  AlertCircle,
  ArrowRight,
  Database,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  compact,
  money,
  number,
  type Dataset,
  type Options,
  type Selection,
} from "./api";

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="MetricFlow home">
      <span className="brand-icon">
        <ChartNoAxesCombined size={19} />
      </span>
      MetricFlow
    </Link>
  );
}
export function Header() {
  const github = import.meta.env.VITE_GITHUB_URL;
  const validGithub =
    typeof github === "string" &&
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(github);
  return (
    <header className="site-header">
      <Brand />
      <nav aria-label="Main navigation">
        <span className="nav-note">A little more clarity.</span>
        {validGithub && (
          <a
            className="nav-link"
            href={github}
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowUpRight size={14} />
          </a>
        )}
        <Link className="nav-link" to="/dashboard">
          Explore dashboard <ArrowUpRight size={16} />
        </Link>
      </nav>
    </header>
  );
}
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="eyebrow">
      <span className="status-dot" />
      {children}
    </span>
  );
}
export function Filters({
  value,
  onChange,
  options,
}: {
  value: Selection;
  onChange: (s: Selection) => void;
  options: Options | null;
}) {
  const prefix = useId();
  return (
    <div className="filter-fields">
      <label htmlFor={prefix + "country"}>
        Country
        <select
          id={prefix + "country"}
          value={value.country}
          onChange={(e) => onChange({ ...value, country: e.target.value })}
        >
          <option value="">All countries</option>
          {options?.countries.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <div className="date-fields">
        <label htmlFor={prefix + "start"}>
          From
          <input
            id={prefix + "start"}
            type="date"
            min={options?.min_date}
            max={options?.max_date}
            value={value.start}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
          />
        </label>
        <label htmlFor={prefix + "end"}>
          To
          <input
            id={prefix + "end"}
            type="date"
            min={options?.min_date}
            max={options?.max_date}
            value={value.end}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
          />
        </label>
      </div>
      <button
        className="text-button"
        onClick={() => onChange({ country: "", start: "", end: "" })}
      >
        <RotateCcw size={13} />
        Clear filters
      </button>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status" aria-label="Loading analytics">
      <span className="sr-only">Loading analytics</span>
      <div className="skeleton-grid">
        {[0, 1, 2].map((n) => (
          <div className="skeleton" key={n} />
        ))}
      </div>
      <div className="skeleton skeleton-chart" />
    </div>
  );
}
export function Failure({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="notice error" role="alert">
      <AlertCircle size={25} />
      <h3>Let’s connect the data.</h3>
      <p>{message}</p>
      <p>
        The dashboard uses the original UCI Online Retail dataset. No sample
        values are shown.
      </p>
      <button className="button secondary" onClick={retry}>
        Try again <RotateCcw size={14} />
      </button>
    </div>
  );
}
export function Empty() {
  return (
    <div className="notice">
      <Database size={25} />
      <h3>No sales in this selection.</h3>
      <p>
        Try a wider date range or another country. Zero matching records is a
        valid result.
      </p>
    </div>
  );
}
export function Kpis({
  data,
  customers = false,
}: {
  data: Dataset;
  customers?: boolean;
}) {
  const cards = [
    {
      label: "Sales revenue",
      value: money(data.overview.revenue),
      note: "Gross valid sales · GBP",
    },
    {
      label: "Completed orders",
      value: number(data.overview.orders),
      note: "Distinct sales invoices",
    },
    {
      label: "Average order value",
      value: money(data.overview.average_order_value),
      note: "Revenue ÷ orders",
    },
    ...(customers
      ? [
          {
            label: "Identifiable customers",
            value: number(data.overview.customers),
            note: "Valid customer IDs only",
          },
        ]
      : []),
  ];
  return (
    <div className={"kpi-grid " + (customers ? "four" : "")}>
      {cards.map((c, i) => (
        <article className="kpi" key={c.label}>
          <div className="kpi-label">
            {c.label}
            <span>0{i + 1}</span>
          </div>
          <strong>{c.value}</strong>
          <small>{c.note}</small>
        </article>
      ))}
    </div>
  );
}
type ChartRow = { name: string; value: number; note?: string };
export function Chart({
  title,
  subtitle,
  rows,
  accent = "#327e70",
  currency = false,
  horizontal = false,
  line = false,
}: {
  title: string;
  subtitle?: string;
  rows: ChartRow[];
  accent?: string;
  currency?: boolean;
  horizontal?: boolean;
  line?: boolean;
}) {
  const id = useId();
  const format = currency ? money : number;
  return (
    <article className="chart-card">
      <div className="chart-heading">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <span className="chart-unit">{currency ? "GBP" : "COUNT"}</span>
      </div>
      <div
        className="chart-container"
        role="img"
        aria-label={`${title}. ${rows.length} values; accessible data table below.`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {line ? (
            <AreaChart
              data={rows}
              margin={{ left: -12, right: 12, top: 12, bottom: 0 }}
            >
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 5"
                vertical={false}
                stroke="var(--chart-grid)"
              />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--chart-text)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                tickFormatter={compact}
                tick={{ fill: "var(--chart-text)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  borderRadius: 12,
                  color: "#171717",
                  border: "1px solid #ddd",
                }}
                formatter={(v) => format(Number(v))}
              />
              <Area
                type="monotone"
                dataKey="value"
                name={title}
                stroke={accent}
                strokeWidth={2.5}
                fill={`url(#${id})`}
                isAnimationActive={false}
              />
            </AreaChart>
          ) : (
            <BarChart
              data={rows}
              layout={horizontal ? "vertical" : "horizontal"}
              margin={{
                left: horizontal ? 5 : -15,
                right: 16,
                top: 8,
                bottom: 0,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 5"
                horizontal={!horizontal}
                vertical={horizontal}
                stroke="var(--chart-grid)"
              />
              {horizontal ? (
                <>
                  <XAxis
                    type="number"
                    tickFormatter={compact}
                    tick={{ fill: "var(--chart-text)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tickFormatter={(s) =>
                      String(s).length > 15
                        ? String(s).slice(0, 14) + "…"
                        : String(s)
                    }
                    tick={{ fill: "var(--chart-text)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                </>
              ) : (
                <>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "var(--chart-text)", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={compact}
                    tick={{ fill: "var(--chart-text)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                </>
              )}
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  borderRadius: 12,
                  color: "#171717",
                }}
                formatter={(v) => format(Number(v))}
              />
              <Bar
                dataKey="value"
                name={title}
                fill={accent}
                radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <details className="data-table">
        <summary>View data table</summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col">Period / item</th>
                <th scope="col">{currency ? "Revenue (GBP)" : "Count"}</th>
                <th scope="col">Context</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <th scope="row">{r.name}</th>
                  <td>{format(r.value)}</td>
                  <td>{r.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </article>
  );
}
export function MonthlyChart({
  data,
  metric = "revenue",
  accent,
}: {
  data: Dataset;
  metric?: "revenue" | "orders";
  accent?: string;
}) {
  return (
    <Chart
      title={metric === "revenue" ? "Revenue, over time" : "Orders, over time"}
      subtitle="Monthly · * marks partial calendar months. MoM in data table."
      rows={data.monthly.map((m) => ({
        name: m.month + (m.partial ? "*" : ""),
        value: m[metric],
        note: m.partial
          ? "Partial month · MoM unavailable"
          : m.mom_change_pct === null
            ? "Revenue MoM unavailable"
            : `Revenue MoM: ${m.mom_change_pct.toFixed(1)}%`,
      }))}
      line
      currency={metric === "revenue"}
      accent={accent}
    />
  );
}
export function DashboardLink() {
  return (
    <Link to="/dashboard" className="button primary">
      Open full dashboard <ArrowRight size={16} />
    </Link>
  );
}
