"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type AdsData = {
  totalSpend: number;
  currencyCode: string;
  fromDate: string;
  toDate: string;
};

type DatePreset = "this_month" | "last_month" | "this_year";

function getDateRangeForPreset(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  if (preset === "this_month") {
    const start = new Date(y, m, 1);
    const end = new Date();
    return {
      from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      to: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
    };
  }
  if (preset === "last_month") {
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return {
      from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      to: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
    };
  }
  // this_year
  const start = new Date(y, 0, 1);
  const end = new Date();
  return {
    from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    to: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
}

function formatDateRangeLabel(from: string, to: string): string {
  const d1 = new Date(from + "T00:00:00");
  const d2 = new Date(to + "T00:00:00");
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${d1.toLocaleDateString("en-US", opts)} – ${d2.toLocaleDateString("en-US", opts)}`;
}

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  this_month: "This Month",
  last_month: "Last Month",
  this_year: "This Year",
};

export default function RentalsAdsPage() {
  const [data, setData] = useState<AdsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("this_year");

  useEffect(() => {
    let cancelled = false;
    const { from, to } = getDateRangeForPreset(datePreset);
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ from, to });
        const res = await fetch(`/api/rentals-ads?${params.toString()}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json?.error ?? `Request failed: ${res.status}`);
          setData(null);
          return;
        }
        setData({
          totalSpend: json.totalSpend ?? 0,
          currencyCode: json.currencyCode ?? "USD",
          fromDate: json.fromDate ?? "",
          toDate: json.toDate ?? "",
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load data");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [datePreset]);

  const formatCurrency = (amount: number, code: string) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
    }).format(amount);

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Admin
          </Button>
        </Link>
      </div>

      <h1 className="text-2xl font-semibold text-foreground mb-2">
        Rentals Ad Performance
      </h1>
      <p className="text-muted-foreground mb-4">
        Track paid advertising spend and performance for rental listings.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label htmlFor="date-preset" className="text-sm font-medium text-foreground">
          Date range
        </label>
        <select
          id="date-preset"
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value as DatePreset)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="this_month">{DATE_PRESET_LABELS.this_month}</option>
          <option value="last_month">{DATE_PRESET_LABELS.last_month}</option>
          <option value="this_year">{DATE_PRESET_LABELS.this_year}</option>
        </select>
        {(() => {
          const { from, to } = getDateRangeForPreset(datePreset);
          const label = formatDateRangeLabel(from, to);
          return label ? (
            <span className="text-sm text-muted-foreground">{label}</span>
          ) : null;
        })()}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-foreground">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span>Loading…</span>
        </div>
      ) : data ? (
        <div className="rounded-lg bg-card p-6 shadow-[0_4px_6px_rgba(0,0,0,0.05)]">
          <h2 className="text-lg font-medium text-foreground mb-4">
            Total Google Ads Spend
          </h2>
          <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
            <p className="text-3xl font-semibold text-foreground">
              {formatCurrency(data.totalSpend, data.currencyCode)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {data.fromDate} – {data.toDate}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
