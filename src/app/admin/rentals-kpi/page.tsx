"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Calendar, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const LEASE_BASE_URL = "https://cloud.congdonandcoleman.com/lease";

type RentalKpiRow = {
  booking_id: number;
  lease_id: string;
  contract_data: string;
  agent_name: string;
  address: string;
  status: string;
  gross_rent: number;
  total_commission: number;
  office_commission: number;
  booking_fee: number;
  total_revenue: number;
};

/** Format currency: abbreviated ($8.7k) for >= 1k, full for smaller. One decimal for k. */
function formatCurrency(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1000) {
    const sign = n < 0 ? "-" : "";
    const value = abs / 1000;
    return `${sign}$${value.toFixed(1)}k`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Get pct change and direction for trend badge. Returns null if no comparison. */
function getTrendPct(
  current: number,
  prev: number | null | undefined
): { pct: number; isPositive: boolean } | null {
  if (prev == null || (current === 0 && prev === 0)) return null;
  const pct = prev !== 0 ? ((current - prev) / prev) * 100 : (current !== 0 ? 100 : 0);
  return { pct, isPositive: pct >= 0 };
}

/** Format ISO date string (or timestamp) as m/d/yyyy (no leading zeros). */
function formatContractDate(value: string): string {
  const s = value?.trim();
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}

/** Format YYYY-MM-DD range. Same month: "MMM dd - dd, yyyy". Else: "MMM d – MMM d, yyyy". */
function formatComparisonPeriodLabel(gte: string, lte: string): string {
  const d1 = new Date(gte + "T00:00:00");
  const d2 = new Date(lte + "T00:00:00");
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return "";
  const sameMonth = d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  if (sameMonth) {
    const month = d1.toLocaleDateString("en-US", { month: "short" });
    const day1 = d1.getDate();
    const day2 = d2.getDate();
    const year = d1.getFullYear();
    return `${month} ${day1} - ${day2}, ${year}`;
  }
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${d1.toLocaleDateString("en-US", opts)} – ${d2.toLocaleDateString("en-US", opts)}`;
}

type FeedDebug = { keys: string[]; sample: Record<string, unknown> };

type DatePreset = "this_month" | "last_month" | "this_year";

function getDateRangeForPreset(preset: DatePreset, yearOffset = 0): { gte: string; lte: string } {
  const now = new Date();
  const y = now.getFullYear() + yearOffset;
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  if (preset === "this_month") {
    const start = new Date(y, m, 1);
    const end =
      yearOffset === 0
        ? new Date()
        : new Date(y, m, Math.min(now.getDate(), new Date(y, m + 1, 0).getDate()));
    return {
      gte: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      lte: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
    };
  }
  if (preset === "last_month") {
    const start = new Date(y, m - 1, 1);
    const currentEnd = new Date(now.getFullYear(), m, 0);
    const end =
      yearOffset === 0
        ? currentEnd
        : new Date(
            y,
            m - 1,
            Math.min(currentEnd.getDate(), new Date(y, m, 0).getDate())
          );
    return {
      gte: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      lte: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
    };
  }
  // this_year
  const start = new Date(y, 0, 1);
  const end =
    yearOffset === 0
      ? new Date()
      : new Date(y, m, Math.min(now.getDate(), new Date(y, m + 1, 0).getDate()));
  return {
    gte: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    lte: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
}

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  this_month: "This Month",
  last_month: "Last Month",
  this_year: "This Year",
};

type ComparisonPreset =
  | "same_period_last_year"
  | "same_period_last_month"
  | "last_month"
  | "last_year";

const COMPARISON_PRESET_LABELS: Record<ComparisonPreset, string> = {
  same_period_last_year: "Same period last year",
  same_period_last_month: "Same period last month",
  last_month: "Last month",
  last_year: "Last year",
};

function getComparisonDateRange(
  datePreset: DatePreset,
  comparisonPreset: ComparisonPreset
): { gte: string; lte: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const { gte, lte } = getDateRangeForPreset(datePreset);

  if (comparisonPreset === "same_period_last_year") {
    return getDateRangeForPreset(datePreset, -1);
  }

  if (comparisonPreset === "same_period_last_month") {
    const d1 = new Date(gte + "T00:00:00");
    const d2 = new Date(lte + "T00:00:00");
    d1.setMonth(d1.getMonth() - 1);
    d2.setMonth(d2.getMonth() - 1);
    return {
      gte: `${d1.getFullYear()}-${pad(d1.getMonth() + 1)}-${pad(d1.getDate())}`,
      lte: `${d2.getFullYear()}-${pad(d2.getMonth() + 1)}-${pad(d2.getDate())}`,
    };
  }

  if (comparisonPreset === "last_month") {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0);
    return {
      gte: `${prevMonth.getFullYear()}-${pad(prevMonth.getMonth() + 1)}-${pad(prevMonth.getDate())}`,
      lte: `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`,
    };
  }

  // last_year: full previous calendar year
  const y = new Date().getFullYear() - 1;
  return {
    gte: `${y}-01-01`,
    lte: `${y}-12-31`,
  };
}

type StatusFilter = "all" | "signed" | "unsigned";

function isSignedStatus(s: string): boolean {
  const t = s.trim().toLowerCase();
  return ["signed", "paid in full", "paid", "complete", "completed", "executed", "active", "closed"].some((x) =>
    t.includes(x)
  );
}

function isUnsignedStatus(s: string): boolean {
  const t = s.trim().toLowerCase();
  return ["unsigned", "not signed", "draft", "pending signature"].some((x) => t.includes(x));
}

function applyStatusFilter(rows: RentalKpiRow[], filter: StatusFilter): RentalKpiRow[] {
  if (filter === "all") return rows;
  if (filter === "signed") {
    return rows.filter((r) => isSignedStatus(r.status) && !isUnsignedStatus(r.status));
  }
  return rows.filter((r) => !isSignedStatus(r.status) || isUnsignedStatus(r.status));
}

export default function RentalsKPIPage() {
  const [rows, setRows] = useState<RentalKpiRow[]>([]);
  const [rowsLy, setRowsLy] = useState<RentalKpiRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedFields, setFeedFields] = useState<FeedDebug | null>(null);
  const [loadingFields, setLoadingFields] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("this_month");
  const [comparisonPreset, setComparisonPreset] = useState<ComparisonPreset>("same_period_last_year");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setDatePickerOpen(false);
      }
    }
    if (datePickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [datePickerOpen]);

  useEffect(() => {
    let cancelled = false;
    const { gte, lte } = getDateRangeForPreset(datePreset);
    const { gte: gteComp, lte: lteComp } = getComparisonDateRange(datePreset, comparisonPreset);
    async function fetchData() {
      setLoading(true);
      setError(null);
      setRowsLy(null);
      try {
        const [res, resLy] = await Promise.all([
          fetch(`/api/rentals-kpi?${new URLSearchParams({ created_date_gte: gte, created_date_lte: lte }).toString()}`),
          fetch(`/api/rentals-kpi?${new URLSearchParams({ created_date_gte: gteComp, created_date_lte: lteComp }).toString()}`),
        ]);
        const data = await res.json();
        const dataLy = await resLy.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error ?? `Request failed: ${res.status}`);
          setRows(data?.results ?? []);
          return;
        }
        setRows(data?.results ?? []);
        if (resLy.ok && Array.isArray(dataLy?.results)) {
          setRowsLy(dataLy.results as RentalKpiRow[]);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load data");
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [datePreset, comparisonPreset]);

  async function showFeedFields() {
    setLoadingFields(true);
    setFeedFields(null);
    const { gte, lte } = getDateRangeForPreset(datePreset);
    try {
      const params = new URLSearchParams({
        created_date_gte: gte,
        created_date_lte: lte,
        debug: "1",
      });
      const res = await fetch(`/api/rentals-kpi?${params.toString()}`);
      const data = await res.json();
      if (data?.debug) setFeedFields(data.debug);
      else setFeedFields({ keys: [], sample: {} });
    } catch {
      setFeedFields({ keys: [], sample: {} });
    } finally {
      setLoadingFields(false);
    }
  }

  const filteredRows = applyStatusFilter(rows, statusFilter);
  const filteredRowsLy = rowsLy ? applyStatusFilter(rowsLy, statusFilter) : [];

  const totals = filteredRows.reduce(
    (acc, row) => ({
      grossRent: acc.grossRent + row.gross_rent,
      totalCommission: acc.totalCommission + row.total_commission,
      officeCommission: acc.officeCommission + row.office_commission,
      bookingFee: acc.bookingFee + row.booking_fee,
      totalRevenue: acc.totalRevenue + row.total_revenue,
    }),
    {
      grossRent: 0,
      totalCommission: 0,
      officeCommission: 0,
      bookingFee: 0,
      totalRevenue: 0,
    }
  );

  const totalsLy =
    filteredRowsLy.length > 0
      ? filteredRowsLy.reduce(
          (acc, row) => ({
            grossRent: acc.grossRent + row.gross_rent,
            totalCommission: acc.totalCommission + row.total_commission,
            officeCommission: acc.officeCommission + row.office_commission,
            bookingFee: acc.bookingFee + row.booking_fee,
            totalRevenue: acc.totalRevenue + row.total_revenue,
          }),
          {
            grossRent: 0,
            totalCommission: 0,
            officeCommission: 0,
            bookingFee: 0,
            totalRevenue: 0,
          }
        )
      : null;
  const lyLeaseCount = rowsLy != null ? filteredRowsLy.length : null;

  const currentRange = getDateRangeForPreset(datePreset);
  const currentPeriodLabel = formatComparisonPeriodLabel(currentRange.gte, currentRange.lte);
  const comparisonRange = getComparisonDateRange(datePreset, comparisonPreset);
  const comparisonPeriodLabel = formatComparisonPeriodLabel(comparisonRange.gte, comparisonRange.lte);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={showFeedFields}
          disabled={loadingFields}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          {loadingFields ? "Loading…" : "Show feed fields"}
        </Button>
      </div>

      <h1 className="text-2xl font-semibold text-foreground mb-2">
        Rentals KPI
      </h1>
      <p className="text-muted-foreground mb-8">
        Contract data, agent performance, and revenue metrics.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-md border border-input bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="all">All statuses</option>
          <option value="signed">Signed</option>
          <option value="unsigned">Unsigned</option>
        </select>

        <div className="relative" ref={datePickerRef}>
          <button
            type="button"
            onClick={() => setDatePickerOpen(!datePickerOpen)}
            className="flex items-center gap-2 rounded-md border border-input bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm ring-offset-background hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <Calendar className="size-4 text-muted-foreground" />
            <span className="font-medium text-foreground">
              {currentPeriodLabel || "Select date range"}
            </span>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${datePickerOpen ? "rotate-180" : ""}`} />
          </button>
          {datePickerOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[260px] rounded-md border border-border bg-card p-3 shadow-lg">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Period
              </p>
              <div className="mb-4 flex flex-col gap-1">
                {(["this_month", "last_month", "this_year"] as DatePreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDatePreset(preset)}
                    className={`rounded px-2 py-1.5 text-left text-sm ${datePreset === preset ? "bg-accent font-medium text-accent-foreground" : "text-foreground hover:bg-muted"}`}
                  >
                    {DATE_PRESET_LABELS[preset]}
                  </button>
                ))}
              </div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Compare to
              </p>
              <div className="flex flex-col gap-1">
                {(["same_period_last_year", "same_period_last_month", "last_month", "last_year"] as ComparisonPreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setComparisonPreset(preset)}
                    className={`rounded px-2 py-1.5 text-left text-sm ${comparisonPreset === preset ? "bg-accent font-medium text-accent-foreground" : "text-foreground hover:bg-muted"}`}
                  >
                    {COMPARISON_PRESET_LABELS[preset]}
                  </button>
                ))}
              </div>
              {comparisonPeriodLabel && (
                <p className="mt-2 text-xs text-muted-foreground" title={comparisonPeriodLabel}>
                  {comparisonPeriodLabel}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-foreground">
          {error}
        </div>
      )}

      {feedFields && (
        <div className="mb-8 rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <p className="mb-2 font-medium text-foreground">Fields in the feed (first record)</p>
          <p className="mb-2 text-muted-foreground">
            Keys: {feedFields.keys.length ? feedFields.keys.join(", ") : "(none)"}
          </p>
          <pre className="max-h-96 overflow-auto rounded bg-background p-3 text-xs">
            {JSON.stringify(feedFields.sample, null, 2)}
          </pre>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span>Loading live data…</span>
        </div>
      ) : (
        <>
          {/* Summary cards - funnel: Leases → Gross Rent → Commission → Company Split → Booking Fee → Total Revenue */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            {/* Leases - count, distinct styling */}
            <div className="rounded-lg bg-card p-5 shadow-[0_4px_6px_rgba(0,0,0,0.05)] min-w-0 overflow-hidden">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                Leases
              </p>
              <p className="text-[28pt] font-bold text-black dark:text-white mt-2 leading-tight break-words">
                {filteredRows.length}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2 break-words">
                {lyLeaseCount != null ? `${lyLeaseCount} (Prev.)` : "—"}
              </p>
              {(() => {
                const trend = getTrendPct(filteredRows.length, lyLeaseCount);
                if (!trend) return <p className="text-[10px] mt-0.5 text-muted-foreground">—</p>;
                const Icon = trend.isPositive ? ArrowUp : ArrowDown;
                return (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium mt-0.5 ${
                      trend.isPositive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400"
                    }`}
                  >
                    <Icon className="size-3" />
                    {trend.pct >= 0 ? "+" : ""}{trend.pct.toFixed(0)}%
                  </span>
                );
              })()}
            </div>
            <div className="rounded-lg bg-card p-5 shadow-[0_4px_6px_rgba(0,0,0,0.05)] min-w-0 overflow-hidden">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                Gross Rent
              </p>
              <p className="text-[28pt] font-bold text-foreground mt-2 leading-tight break-words">
                {formatCurrency(totals.grossRent)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2 break-words">
                {totalsLy?.grossRent != null ? `${formatCurrency(totalsLy.grossRent)} (Prev.)` : "—"}
              </p>
              {(() => {
                const trend = getTrendPct(totals.grossRent, totalsLy?.grossRent);
                if (!trend) return <p className="text-[10px] mt-0.5 text-muted-foreground">—</p>;
                const Icon = trend.isPositive ? ArrowUp : ArrowDown;
                return (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium mt-0.5 ${
                      trend.isPositive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400"
                    }`}
                  >
                    <Icon className="size-3" />
                    {trend.pct >= 0 ? "+" : ""}{trend.pct.toFixed(0)}%
                  </span>
                );
              })()}
            </div>
            <div className="rounded-lg bg-card p-5 shadow-[0_4px_6px_rgba(0,0,0,0.05)] min-w-0 overflow-hidden">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                Commission
              </p>
              <p className="text-[28pt] font-bold text-foreground mt-2 leading-tight break-words">
                {formatCurrency(totals.totalCommission)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2 break-words">
                {totalsLy?.totalCommission != null ? `${formatCurrency(totalsLy.totalCommission)} (Prev.)` : "—"}
              </p>
              {(() => {
                const trend = getTrendPct(totals.totalCommission, totalsLy?.totalCommission);
                if (!trend) return <p className="text-[10px] mt-0.5 text-muted-foreground">—</p>;
                const Icon = trend.isPositive ? ArrowUp : ArrowDown;
                return (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium mt-0.5 ${
                      trend.isPositive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400"
                    }`}
                  >
                    <Icon className="size-3" />
                    {trend.pct >= 0 ? "+" : ""}{trend.pct.toFixed(0)}%
                  </span>
                );
              })()}
            </div>
            <div className="rounded-lg bg-card p-5 shadow-[0_4px_6px_rgba(0,0,0,0.05)] min-w-0 overflow-hidden">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                Company Split
              </p>
              <p className="text-[28pt] font-bold text-foreground mt-2 leading-tight break-words">
                {formatCurrency(totals.officeCommission)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2 break-words">
                {totalsLy?.officeCommission != null ? `${formatCurrency(totalsLy.officeCommission)} (Prev.)` : "—"}
              </p>
              {(() => {
                const trend = getTrendPct(totals.officeCommission, totalsLy?.officeCommission);
                if (!trend) return <p className="text-[10px] mt-0.5 text-muted-foreground">—</p>;
                const Icon = trend.isPositive ? ArrowUp : ArrowDown;
                return (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium mt-0.5 ${
                      trend.isPositive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400"
                    }`}
                  >
                    <Icon className="size-3" />
                    {trend.pct >= 0 ? "+" : ""}{trend.pct.toFixed(0)}%
                  </span>
                );
              })()}
            </div>
            <div className="rounded-lg bg-card p-5 shadow-[0_4px_6px_rgba(0,0,0,0.05)] min-w-0 overflow-hidden">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                Booking Fee
              </p>
              <p className="text-[28pt] font-bold text-foreground mt-2 leading-tight break-words">
                {formatCurrency(totals.bookingFee)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2 break-words">
                {totalsLy?.bookingFee != null ? `${formatCurrency(totalsLy.bookingFee)} (Prev.)` : "—"}
              </p>
              {(() => {
                const trend = getTrendPct(totals.bookingFee, totalsLy?.bookingFee);
                if (!trend) return <p className="text-[10px] mt-0.5 text-muted-foreground">—</p>;
                const Icon = trend.isPositive ? ArrowUp : ArrowDown;
                return (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium mt-0.5 ${
                      trend.isPositive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400"
                    }`}
                  >
                    <Icon className="size-3" />
                    {trend.pct >= 0 ? "+" : ""}{trend.pct.toFixed(0)}%
                  </span>
                );
              })()}
            </div>
            {/* Total Revenue - highlighted as key metric */}
            <div className="rounded-lg border-2 border-primary/20 bg-muted/30 p-5 shadow-[0_4px_6px_rgba(0,0,0,0.05)] min-w-0 overflow-hidden">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                Total Revenue
              </p>
              <p className="text-[30pt] font-bold text-foreground mt-2 leading-tight break-words">
                {formatCurrency(totals.totalRevenue)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2 break-words">
                {totalsLy?.totalRevenue != null ? `${formatCurrency(totalsLy.totalRevenue)} (Prev.)` : "—"}
              </p>
              {(() => {
                const trend = getTrendPct(totals.totalRevenue, totalsLy?.totalRevenue);
                if (!trend) return <p className="text-[10px] mt-0.5 text-muted-foreground">—</p>;
                const Icon = trend.isPositive ? ArrowUp : ArrowDown;
                return (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium mt-0.5 ${
                      trend.isPositive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400"
                    }`}
                  >
                    <Icon className="size-3" />
                    {trend.pct >= 0 ? "+" : ""}{trend.pct.toFixed(0)}%
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg bg-card overflow-hidden shadow-[0_4px_6px_rgba(0,0,0,0.05)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 font-medium text-foreground">
                      Contract Date
                    </th>
                    <th className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                      Lease
                    </th>
                    <th className="px-4 py-3 font-medium text-foreground">
                      Agent Name
                    </th>
                    <th className="px-4 py-3 font-medium text-foreground">
                      Address
                    </th>
                    <th className="px-4 py-3 font-medium text-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 font-medium text-foreground text-right">
                      Gross Rent
                    </th>
                    <th className="px-4 py-3 font-medium text-foreground text-right">
                      Commission
                    </th>
                    <th className="px-4 py-3 font-medium text-foreground text-right">
                      Company Split
                    </th>
                    <th className="px-4 py-3 font-medium text-foreground text-right">
                      Booking Fee
                    </th>
                    <th className="px-4 py-3 font-bold text-foreground text-right">
                      Total Revenue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        {rows.length === 0
                          ? "No lease activity. Set CONGDON_API_URL and CONGDON_API_KEY (or NRBE_API_URL) in .env.local."
                          : `No ${statusFilter === "all" ? "" : statusFilter + " "}leases in this period.`}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => (
                      <tr
                        key={row.booking_id}
                        className={`border-b border-border last:border-0 hover:bg-muted/40 transition-colors ${idx % 2 === 1 ? "bg-muted/20" : ""}`}
                      >
                        <td className="px-4 py-3 text-foreground">
                          {formatContractDate(row.contract_data)}
                        </td>
                        <td className="max-w-[120px] px-4 py-3 text-foreground truncate" title={row.lease_id ?? undefined}>
                          {row.lease_id ? (
                            <a
                              href={`${LEASE_BASE_URL}/${encodeURIComponent(row.lease_id)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline truncate block"
                            >
                              {row.lease_id}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="max-w-[140px] px-4 py-3 text-foreground truncate" title={row.agent_name}>
                          {row.agent_name}
                        </td>
                        <td className="max-w-[200px] px-4 py-3 text-foreground truncate" title={row.address}>
                          {row.address}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {row.status || "—"}
                        </td>
                        <td className="px-4 py-3 text-foreground text-right tabular-nums">
                          {formatCurrency(row.gross_rent)}
                        </td>
                        <td className="px-4 py-3 text-foreground text-right tabular-nums">
                          {formatCurrency(row.total_commission)}
                        </td>
                        <td className="px-4 py-3 text-foreground text-right tabular-nums">
                          {formatCurrency(row.office_commission)}
                        </td>
                        <td className="px-4 py-3 text-foreground text-right tabular-nums">
                          {formatCurrency(row.booking_fee)}
                        </td>
                        <td className="px-4 py-3 font-bold text-foreground text-right tabular-nums">
                          {formatCurrency(row.total_revenue)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
