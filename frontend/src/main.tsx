import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { MotionConfig } from "motion/react";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "./styles.css";
const Landing = lazy(() => import("./Landing"));
const Dashboard = lazy(() => import("./Dashboard"));
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Suspense
          fallback={
            <div className="route-loading" role="status">
              Opening MetricFlow…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route
              path="*"
              element={
                <main id="main-content" className="notice">
                  <h1>Page not found.</h1>
                  <Link to="/">Return to MetricFlow</Link>
                </main>
              }
            />
          </Routes>
        </Suspense>
      </MotionConfig>
    </BrowserRouter>
  </React.StrictMode>,
);
