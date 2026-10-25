import { useEffect, useState } from "react";
export interface Selection {
  start: string;
  end: string;
  country: string;
}
export interface Overview {
  revenue: number;
  orders: number;
  average_order_value: number;
  customers: number;
  sales_rows: number;
}
export interface Month {
  month: string;
  revenue: number;
  orders: number;
  partial: boolean;
  mom_change_pct: number | null;
}
export interface Product {
  stock_code: string;
  description: string;
  revenue: number;
  quantity: number;
  orders: number;
}
export interface Country {
  country: string;
  revenue: number;
  orders: number;
}
export interface Customers {
  customers: number;
  repeat_customers: number;
  repeat_customer_rate: number;
  excluded_anonymous_sales_rows: number;
  spending_distribution: { band: string; customers: number }[];
}
export interface Quality {
  raw_rows: number;
  valid_sales_rows: number;
  excluded_rows: number;
  excluded_by_reason: Record<string, number>;
  flags: Record<string, number>;
  missing_customer_ids: number;
  valid_sales_missing_customer_ids: number;
  negative_quantities: number;
  invalid_records: number;
  missing_descriptions: number;
  min_date: string;
  max_date: string;
  provenance: Record<string, string>;
}
export interface Options {
  countries: string[];
  min_date: string;
  max_date: string;
}
export interface Dataset {
  overview: Overview;
  monthly: Month[];
  products: Product[];
  units: Product[];
  geography: Country[];
  customers: Customers;
  quality: Quality;
  options: Options;
}
export const emptySelection: Selection = { start: "", end: "", country: "" };
async function get<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      typeof body?.detail === "string"
        ? body.detail
        : response.status === 422
          ? "Please enter a valid date range and country."
          : `The analytics service returned ${response.status}. Check that the backend is running and the dataset is loaded.`,
    );
  }
  return response.json();
}
export function useAnalytics(selection: Selection) {
  const [data, setData] = useState<Dataset | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    const query = new URLSearchParams(
      Object.entries(selection).filter(([, value]) => value),
    );
    const q = query.toString();
    Promise.all([
      get<Overview>(`/api/overview?${q}`, controller.signal),
      get<Month[]>(`/api/sales/monthly?${q}`, controller.signal),
      get<Product[]>(
        `/api/products/top?metric=revenue&limit=10&${q}`,
        controller.signal,
      ),
      get<Product[]>(
        `/api/products/top?metric=quantity&limit=10&${q}`,
        controller.signal,
      ),
      get<Country[]>(`/api/geography?${q}`, controller.signal),
      get<Customers>(`/api/customers/summary?${q}`, controller.signal),
      get<Quality>("/api/data-quality", controller.signal),
      get<Options>("/api/filters", controller.signal),
    ])
      .then(
        ([
          overview,
          monthly,
          products,
          units,
          geography,
          customers,
          quality,
          options,
        ]) => {
          if (!controller.signal.aborted) {
            setData({
              overview,
              monthly,
              products,
              units,
              geography,
              customers,
              quality,
              options,
            });
            setOptions(options);
          }
        },
      )
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selection.country, selection.start, selection.end, attempt]);
  return {
    data,
    options,
    error,
    loading,
    retry: () => setAttempt((n) => n + 1),
  };
}
export const money = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value);
export const number = (value: number) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
export const compact = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
