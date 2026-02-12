"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
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

function formatCurrency(n: number) {
  const abs = Math.abs(n);
  if (abs >= 10_000) {
    const sign = n < 0 ? "-" : "";
    const value = abs / 1000;
    const k = value % 1 === 0 ? String(value) : value.toFixed(1);
    return `${sign}$${k}k`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Format comparison vs last year: "+$1,234" / "-$500" / "—" */
function formatVsLy(current: number, ly: number | null | undefined): string {
  if (ly == null || (current === 0 && ly === 0)) return "—";
  const diff = current - ly;
  if (diff === 0) return "vs LY: no change";
  const sign = diff > 0 ? "+" : "";
  return `vs LY: ${sign}${formatCurrency(diff)}`;
}

/** Format "vs: $xxx (##%)" or "vs: +3 (25%)" for counts. */
function formatVsWithPercent(
  current: number,
  ly: number | null | undefined,
  formatDiff: (n: number) => string
): string {
  if (ly == null) return "vs: —";
  const diff = current - ly;
  const pct = ly !== 0 ? (diff / ly) * 100 : (current !== 0 ? 100 : 0);
  const pctStr = pct >= 0 ? `+${pct.toFixed(0)}%` : `${pct.toFixed(0)}%`;
  const sign = diff > 0 ? "+" : "";
  return `vs: ${sign}${formatDiff(diff)} (${pctStr})`;
}

/** Format ISO date string (or timestamp) for display, or return as-is. */
function formatContractDate(value: string): string {
  const s = value?.trim();
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Format YYYY-MM-DD range as "MMM d – MMM d, yyyy" for comparison period label. */
function formatComparisonPeriodLabel(gte: string, lte: string): string {
  const d1 = new Date(gte + "T00:00:00");
  const d2 = new Date(lte + "T00:00:00");
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return "";
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let cancelled = false;
    const { gte, lte } = getDateRangeForPreset(datePreset);
    const { gte: gteLy, lte: lteLy } = getDateRangeForPreset(datePreset, -1);
    async function fetchData() {
      setLoading(true);
      setError(null);
      setRowsLy(null);
      try {
        const [res, resLy] = await Promise.all([
          fetch(`/api/rentals-kpi?${new URLSearchParams({ created_date_gte: gte, created_date_lte: lte }).toString()}`),
          fetch(`/api/rentals-kpi?${new URLSearchParams({ created_date_gte: gteLy, created_date_lte: lteLy }).toString()}`),
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
  }, [datePreset]);

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
  const comparisonRange = getDateRangeForPreset(datePreset, -1);
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
      <p className="text-muted-foreground mb-4">
        Contract data, agent performance, and revenue metrics.
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
        <label htmlFor="status-filter" className="text-sm font-medium text-foreground ml-2">
          Status
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="all">All</option>
          <option value="signed">Signed</option>
          <option value="unsigned">Unsigned</option>
        </select>
        {currentPeriodLabel && (
          <span className="text-sm text-muted-foreground">
            {currentPeriodLabel}
          </span>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-foreground">Compare</span>
        {comparisonPeriodLabel && (
          <span className="text-sm text-muted-foreground">
            {comparisonPeriodLabel}
          </span>
        )}
        <span className="text-xs text-muted-foreground/80">
          Same-period comparison
        </span>
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
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            <div className="rounded-lg bg-card p-5 shadow-[0_4px_6px_rgba(0,0,0,0.05)]">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Leases
              </p>
              <p className="text-[28pt] font-bold text-foreground mt-2 leading-tight">
                {filteredRows.length}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2">
                LY: {lyLeaseCount != null ? lyLeaseCount : "—"}
              </p>
              <p className={`text-[10px] mt-0.5 ${lyLeaseCount != null && filteredRows.length - lyLeaseCount < 0 ? "text-destructive" : lyLeaseCount != null && filteredRows.length - lyLeaseCount > 0 ? "text-[#28a745]" : "text-muted-foreground"}`}>
                {formatVsWithPercent(filteredRows.length, lyLeaseCount, (n) => String(n))}
              </p>
            </div>
            <div className="rounded-lg bg-card p-5 shadow-[0_4px_6px_rgba(0,0,0,0.05)]">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Gross Rent
              </p>
              <p className="text-[28pt] font-bold text-foreground mt-2 leading-tight">
                {formatCurrency(totals.grossRent)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2">
                LY: {totalsLy?.grossRent != null ? formatCurrency(totalsLy.grossRent) : "—"}
              </p>
              <p className={`text-[10px] mt-0.5 ${totalsLy?.grossRent != null && totals.grossRent - totalsLy.grossRent < 0 ? "text-destructive" : totalsLy?.grossRent != null && totals.grossRent - totalsLy.grossRent > 0 ? "text-[#28a745]" : "text-muted-foreground"}`}>
                {formatVsWithPercent(totals.grossRent, totalsLy?.grossRent, formatCurrency)}
              </p>
            </div>
            <div className="rounded-lg bg-card p-5 shadow-[0_4px_6px_rgba(0,0,0,0.05)]">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total Commission
              </p>
              <p className="text-[28pt] font-bold text-foreground mt-2 leading-tight">
                {formatCurrency(totals.totalCommission)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2">
                LY: {totalsLy?.totalCommission != null ? formatCurrency(totalsLy.totalCommission) : "—"}
              </p>
              <p className={`text-[10px] mt-0.5 ${totalsLy?.totalCommission != null && totals.totalCommission - totalsLy.totalCommission < 0 ? "text-destructive" : totalsLy?.totalCommission != null && totals.totalCommission - totalsLy.totalCommission > 0 ? "text-[#28a745]" : "text-muted-foreground"}`}>
                {formatVsWithPercent(totals.totalCommission, totalsLy?.totalCommission, formatCurrency)}
              </p>
            </div>
            <div className="rounded-lg bg-card p-5 shadow-[0_4px_6px_rgba(0,0,0,0.05)]">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Office Comm.
              </p>
              <p className="text-[28pt] font-bold text-foreground mt-2 leading-tight">
                {formatCurrency(totals.officeCommission)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2">
                LY: {totalsLy?.officeCommission != null ? formatCurrency(totalsLy.officeCommission) : "—"}
              </p>
              <p className={`text-[10px] mt-0.5 ${totalsLy?.officeCommission != null && totals.officeCommission - totalsLy.officeCommission < 0 ? "text-destructive" : totalsLy?.officeCommission != null && totals.officeCommission - totalsLy.officeCommission > 0 ? "text-[#28a745]" : "text-muted-foreground"}`}>
                {formatVsWithPercent(totals.officeCommission, totalsLy?.officeCommission, formatCurrency)}
              </p>
            </div>
            <div className="rounded-lg bg-card p-5 shadow-[0_4px_6px_rgba(0,0,0,0.05)]">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Booking Fee
              </p>
              <p className="text-[28pt] font-bold text-foreground mt-2 leading-tight">
                {formatCurrency(totals.bookingFee)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2">
                LY: {totalsLy?.bookingFee != null ? formatCurrency(totalsLy.bookingFee) : "—"}
              </p>
              <p className={`text-[10px] mt-0.5 ${totalsLy?.bookingFee != null && totals.bookingFee - totalsLy.bookingFee < 0 ? "text-destructive" : totalsLy?.bookingFee != null && totals.bookingFee - totalsLy.bookingFee > 0 ? "text-[#28a745]" : "text-muted-foreground"}`}>
                {formatVsWithPercent(totals.bookingFee, totalsLy?.bookingFee, formatCurrency)}
              </p>
            </div>
            <div className="rounded-lg bg-card p-5 shadow-[0_4px_6px_rgba(0,0,0,0.05)]">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total Revenue
              </p>
              <p className="text-[28pt] font-bold text-foreground mt-2 leading-tight">
                {formatCurrency(totals.totalRevenue)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2">
                LY: {totalsLy?.totalRevenue != null ? formatCurrency(totalsLy.totalRevenue) : "—"}
              </p>
              <p className={`text-[10px] mt-0.5 ${totalsLy?.totalRevenue != null && totals.totalRevenue - totalsLy.totalRevenue < 0 ? "text-destructive" : totalsLy?.totalRevenue != null && totals.totalRevenue - totalsLy.totalRevenue > 0 ? "text-[#28a745]" : "text-muted-foreground"}`}>
                {formatVsWithPercent(totals.totalRevenue, totalsLy?.totalRevenue, formatCurrency)}
              </p>
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
                    <th className="px-4 py-3 font-medium text-foreground">
                      Lease #
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
                      Total Commission
                    </th>
                    <th className="px-4 py-3 font-medium text-foreground text-right">
                      Office Comm.
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
                    filteredRows.map((row) => (
                      <tr
                        key={row.booking_id}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-foreground">
                          {formatContractDate(row.contract_data)}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {row.lease_id ? (
                            <a
                              href={`${LEASE_BASE_URL}/${encodeURIComponent(row.lease_id)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {row.lease_id}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {row.agent_name}
                        </td>
                        <td className="px-4 py-3 text-foreground">
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
