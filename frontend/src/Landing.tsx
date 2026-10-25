import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  Code2,
  Copy,
  Layers3,
  MousePointer2,
  Pause,
  Play,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  Chart,
  DashboardLink,
  Empty,
  Failure,
  Filters,
  Header,
  Kpis,
  Loading,
  MonthlyChart,
  Pill,
} from "./components";
import { emptySelection, useAnalytics } from "./api";
const commands = `python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
python -m backend.app.ingest
npm --prefix frontend ci --cache .npm-cache
# Start API + Vite together
bash scripts/dev.sh`;
function WordChip({
  words,
  icon,
  paused,
}: {
  words: string[];
  icon: React.ReactNode;
  paused: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || paused || focused) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % words.length),
      2500,
    );
    return () => clearInterval(timer);
  }, [reduced, paused, focused, words.length]);
  return (
    <button
      className="word-chip"
      onClick={() => setIndex((i) => (i + 1) % words.length)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onMouseEnter={() => setFocused(true)}
      onMouseLeave={() => setFocused(false)}
      aria-label={`Change word: ${words[index]}`}
    >
      <span className="chip-icon">{icon}</span>
      <span className="slot">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={index}
            initial={reduced ? false : { y: 22, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? undefined : { y: -22, opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            {words[index]}
          </motion.span>
        </AnimatePresence>
      </span>
      <ChevronDown className="chip-chevron" size={16} />
    </button>
  );
}
function Preview() {
  const [selection, setSelection] = useState(emptySelection);
  const { data, options, loading, error, retry } = useAnalytics(selection);
  const [tab, setTab] = useState("Overview");
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const [limit, setLimit] = useState(5);
  const [accent, setAccent] = useState("#327e70");
  return (
    <div className="demo-wrap">
      <div className="demo-canvas">
        <div className="gallery">
          <div className="gallery-heading">
            <div>
              <span className="mini-label">THE BIG PICTURE</span>
              <h3>A clearer view of retail.</h3>
            </div>
            <span className="live-tag">
              <span />
              Historical data
            </span>
          </div>
          <div className="preview-tabs" role="group" aria-label="Preview view">
            {["Overview", "Products", "Countries"].map((t) => (
              <button
                key={t}
                aria-pressed={t === tab}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {loading ? (
            <Loading />
          ) : error ? (
            <Failure message={error} retry={retry} />
          ) : (
            data && (
              <>
                <Kpis data={data} />
                {data.overview.sales_rows === 0 ? (
                  <Empty />
                ) : (
                  <>
                    {tab === "Overview" && (
                      <>
                        <MonthlyChart
                          data={data}
                          metric={metric}
                          accent={accent}
                        />
                        <div className="preview-small-charts">
                          <Chart
                            title="Top products"
                            subtitle={`Top ${limit} by revenue`}
                            horizontal
                            currency
                            accent={accent}
                            rows={data.products
                              .slice(0, limit)
                              .map((p) => ({
                                name: p.description,
                                value: p.revenue,
                                note: p.stock_code,
                              }))}
                          />
                          <Chart
                            title="Country revenue"
                            subtitle={`Top ${limit} countries by revenue`}
                            horizontal
                            currency
                            accent={accent}
                            rows={data.geography
                              .slice(0, limit)
                              .map((c) => ({
                                name: c.country,
                                value: c.revenue,
                              }))}
                          />
                        </div>
                      </>
                    )}
                    {tab === "Products" && (
                      <>
                        <Chart
                          title="Products by revenue"
                          subtitle={`Top ${limit} · ranked by gross sales`}
                          horizontal
                          currency
                          accent={accent}
                          rows={data.products
                            .slice(0, limit)
                            .map((p) => ({
                              name: p.description,
                              value: p.revenue,
                              note: p.stock_code,
                            }))}
                        />
                        <Chart
                          title="Products by quantity"
                          subtitle={`Top ${limit} · valid units sold`}
                          horizontal
                          accent={accent}
                          rows={data.units
                            .slice(0, limit)
                            .map((p) => ({
                              name: p.description,
                              value: p.quantity,
                              note: p.stock_code,
                            }))}
                        />
                      </>
                    )}
                    {tab === "Countries" && (
                      <Chart
                        title={
                          metric === "revenue"
                            ? "Country revenue"
                            : "Orders by country"
                        }
                        subtitle={`Top ${limit} countries · ranked by ${metric}`}
                        horizontal
                        currency={metric === "revenue"}
                        accent={accent}
                        rows={[...data.geography]
                          .sort((a, b) => b[metric] - a[metric])
                          .slice(0, limit)
                          .map((c) => ({ name: c.country, value: c[metric] }))}
                      />
                    )}
                  </>
                )}
                <p className="gallery-footnote">
                  {selection.country || "All countries"} ·{" "}
                  {selection.start || data.options.min_date} →{" "}
                  {selection.end || data.options.max_date} · GBP
                </p>
              </>
            )
          )}
        </div>
        <aside className="inspector">
          <div className="inspector-heading">
            <SlidersHorizontal size={17} />
            <span>Make it yours</span>
            <span className="inspector-mark">⌘</span>
          </div>
          <p>
            A different perspective.
            <br />
            The same real data.
          </p>
          <Filters
            value={selection}
            onChange={setSelection}
            options={options}
          />
          <div className="inspector-divider" />
          <label className="control-label">
            Chart metric
            <select
              value={metric}
              onChange={(e) =>
                setMetric(e.target.value as "revenue" | "orders")
              }
            >
              <option value="revenue">Revenue</option>
              <option value="orders">Orders</option>
            </select>
          </label>
          <p className="control-hint">
            Applies to monthly and country charts. Products use revenue and
            units.
          </p>
          <div className="control-label">
            Rankings
            <div className="segmented">
              {[5, 10].map((n) => (
                <button
                  key={n}
                  aria-pressed={limit === n}
                  onClick={() => setLimit(n)}
                  className={limit === n ? "active" : ""}
                >
                  Top {n}
                </button>
              ))}
            </div>
          </div>
          <div className="control-label">
            Chart accent
            <div className="swatches">
              {["#327e70", "#6554a4", "#a34b26", "#346eae"].map((c) => (
                <button
                  key={c}
                  aria-label={`Use ${c} chart accent`}
                  aria-pressed={accent === c}
                  style={{ background: c }}
                  onClick={() => setAccent(c)}
                >
                  {accent === c && <Check size={14} />}
                </button>
              ))}
            </div>
          </div>
          <div className="inspector-note">
            <CheckCheck size={16} />
            <span>
              Real transactions.
              <br />
              Transparent calculations.
            </span>
          </div>
          <a href="#reproduce" className="inspector-source">
            Explore the methodology <ArrowUpRight size={13} />
          </a>
        </aside>
      </div>
      <div className="preview-bottom">
        <span>
          <MousePointer2 size={14} />
          Go on. Change a filter.
        </span>
        <DashboardLink />
      </div>
    </div>
  );
}
function Terminal() {
  const reduced = useReducedMotion();
  const [length, setLength] = useState(reduced ? commands.length : 0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (reduced) {
      setLength(commands.length);
      return;
    }
    const timer = setInterval(
      () => setLength((n) => Math.min(n + 5, commands.length)),
      22,
    );
    return () => clearInterval(timer);
  }, [reduced]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(commands);
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyError(true);
      setLength(commands.length);
      const range = document.createRange();
      if (ref.current) {
        range.selectNodeContents(ref.current);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  }
  return (
    <div className="terminal">
      <div className="terminal-top">
        <div className="window-dots">
          <i />
          <i />
          <i />
        </div>
        <span>metricflow — terminal</span>
        <button onClick={copy} aria-label="Copy commands">
          {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
          {copied ? "Copied" : "Copy commands"}
        </button>
      </div>
      <div className="terminal-body">
        <span className="terminal-comment">
          # From the repository root · Python 3.11+ & Node 22+
        </span>
        <pre ref={ref} aria-label="Setup commands">
          {commands.slice(0, length)}
          <span className="cursor" aria-hidden="true">
            ▋
          </span>
        </pre>
        <span className="sr-only">{commands}</span>
      </div>
      <div className="terminal-bottom">
        <span className="terminal-prompt">↳</span> Local-first. Reproducible.
        Yours to explore.
      </div>
      <div role="status" className="copy-status">
        {copyError
          ? "Commands selected. Press Ctrl+C or ⌘C to copy."
          : copied
            ? "Commands copied to clipboard."
            : ""}
      </div>
    </div>
  );
}
export default function Landing() {
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  return (
    <>
      <Header />
      <main id="main-content" className="landing">
        <section className="hero">
          <Pill>SMALL DATA. BIGGER PERSPECTIVE.</Pill>
          <h1>
            Turn{" "}
            <WordChip
              words={["transactions", "sales data", "numbers"]}
              icon={<Layers3 />}
              paused={paused}
            />
            <br className="desktop-break" /> into{" "}
            <WordChip
              words={["insights", "patterns", "clarity"]}
              icon={<Sparkles />}
              paused={paused}
            />{" "}
            and make
            <br className="desktop-break" />{" "}
            <WordChip
              words={[
                "better decisions",
                "smarter strategies",
                "informed choices",
              ]}
              icon={<TrendingUp />}
              paused={paused}
            />
            .
          </h1>
          <p className="hero-description">
            Your retail data, made clear.
            <br />A hands-on exploration of real transactions, useful patterns,
            <br className="desktop-break" /> and the stories behind the numbers.
          </p>
          <div className="hero-actions">
            <a href="#explore" className="button primary">
              Find your perspective <ArrowDown size={16} />
            </a>
            <span className="open-note">Built on real, historical data.</span>
          </div>
          <div className="hero-caption">
            <MousePointer2 size={13} />
            <span>
              Select a highlighted word to explore another perspective.
            </span>
            {!reduced && (
              <button
                className="pause"
                aria-label={
                  paused ? "Play word animation" : "Pause word animation"
                }
                onClick={() => setPaused(!paused)}
              >
                {paused ? <Play size={12} /> : <Pause size={12} />}
              </button>
            )}
          </div>
          <div className="hero-baseline">
            <span>AN INDEPENDENT ANALYTICS PROJECT</span>
            <span>
              PYTHON <i /> SQL <i /> REACT
            </span>
            <a href="#explore" aria-label="Scroll to analytics preview">
              <ArrowDown size={16} />
            </a>
          </div>
        </section>
        <section id="explore" className="preview-section">
          <div className="section-title">
            <div>
              <span className="section-index">01 / EXPLORE</span>
              <h2>See what your data reveals.</h2>
              <p>Not a screenshot. A real dataset, ready to explore.</p>
            </div>
            <span className="handwritten">
              try it out
              <ArrowDownRight size={35} strokeWidth={1} />
            </span>
          </div>
          <Preview />
          <div className="source-caption">
            <span>THE DATA BEHIND THE DETAILS</span>
            <p>
              UCI Online Retail · A UK-based retailer · 2010–2011
              <br />
              Historical transactions. No live feeds. No made-up numbers.
            </p>
            <a
              href="https://archive.ics.uci.edu/dataset/352/online+retail"
              target="_blank"
              rel="noreferrer"
            >
              Meet the dataset <ArrowUpRight size={15} />
            </a>
          </div>
        </section>
        <section id="reproduce" className="reproduce-section">
          <div className="reproduce-copy">
            <span className="section-index">02 / GO DEEPER</span>
            <h2>
              Explore the data.
              <br />
              Run the analysis.
            </h2>
            <p>
              Every number has a source.
              <br />
              Every calculation is yours to inspect.
            </p>
            <div className="tech-pills">
              <span>
                <Code2 size={14} />
                Python + SQL
              </span>
              <span>React + TypeScript</span>
            </div>
            <p className="reproduce-small">
              Download the original UCI workbook, clean it with an auditable
              pipeline, and explore locally. See the repository README and docs
              for metric definitions and limitations.
            </p>
          </div>
          <Terminal />
          <footer className="site-footer">
            <span>
              MetricFlow{" "}
              <span className="muted">/ Your retail data, made clear.</span>
            </span>
            <span>Made for curiosity. Built for clarity.</span>
          </footer>
        </section>
      </main>
    </>
  );
}
