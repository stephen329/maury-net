"use client";

import React from "react";
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

type PpcLeadRow = {
  date: string;
  email: string;
  agent: string;
  callRequested: boolean;
  leaseStatus: "Booked" | "None";
  revenue: number;
  leaseId?: string;
  adults?: string | number;
  children?: string | number;
  comment?: string;
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

function formatDateDisplay(isoDate: string): string {
  if (!isoDate || isoDate.length < 10) return isoDate;
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
  const [ppcLeads, setPpcLeads] = useState<PpcLeadRow[]>([]);
  const [ppcLeadsLoading, setPpcLeadsLoading] = useState(true);
  const [ppcLeadsError, setPpcLeadsError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("this_year");
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    const { from, to } = getDateRangeForPreset(datePreset);
    async function fetchPpcLeads() {
      setPpcLeadsLoading(true);
      setPpcLeadsError(null);
      try {
        const params = new URLSearchParams({ from, to });
        const res = await fetch(`/api/ppc-leads?${params.toString()}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setPpcLeadsError(json?.error ?? `Request failed: ${res.status}`);
          setPpcLeads([]);
          return;
        }
        setPpcLeads(json.rows ?? []);
      } catch (e) {
        if (!cancelled) {
          setPpcLeadsError(e instanceof Error ? e.message : "Failed to load PPC leads");
          setPpcLeads([]);
        }
      } finally {
        if (!cancelled) setPpcLeadsLoading(false);
      }
    }
    fetchPpcLeads();
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
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Costs
          </p>
          <p className="text-xl font-semibold text-foreground">
            {loading ? "…" : data ? formatCurrency(data.totalSpend, data.currencyCode) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Clicks
          </p>
          <p className="text-xl font-semibold text-foreground">—</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Leads
          </p>
          <p className="text-xl font-semibold text-foreground">
            {ppcLeadsLoading ? "…" : ppcLeads.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Conversion Rate
          </p>
          <p className="text-xl font-semibold text-foreground">—</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Revenue
          </p>
          <p className="text-xl font-semibold text-foreground">
            {ppcLeadsLoading
              ? "…"
              : formatCurrency(
                  ppcLeads.reduce((sum, r) => sum + r.revenue, 0),
                  "USD",
                )}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            ROAS
          </p>
          <p className="text-xl font-semibold text-foreground">
            {ppcLeadsLoading || loading
              ? "…"
              : data && data.totalSpend > 0
                ? `${(ppcLeads.reduce((sum, r) => sum + r.revenue, 0) / data.totalSpend).toFixed(2)}x`
                : "—"}
          </p>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-medium text-foreground mb-4">
          PPC Leads
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Rental opportunities from book.nantucketrentals.com
        </p>
        {ppcLeadsError && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-foreground">
            {ppcLeadsError}
          </div>
        )}
        {ppcLeadsLoading ? (
          <div className="flex justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span>Loading…</span>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: "15%" }} />
                <col style={{ width: "25%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "12.5%" }} />
                <col style={{ width: "12.5%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left font-medium px-4 py-3">Date</th>
                  <th className="text-left font-medium px-4 py-3">Email</th>
                  <th className="text-left font-medium px-4 py-3">Agent</th>
                  <th className="text-left font-medium px-4 py-3">Call Requested?</th>
                  <th className="text-left font-medium px-4 py-3">Lease Status</th>
                  <th className="text-right font-medium px-4 py-3">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {ppcLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No PPC leads in this date range
                    </td>
                  </tr>
                ) : (
                  ppcLeads.map((row, i) => {
                    const isExpanded = expandedRowIndex === i;
                    return (
                      <React.Fragment key={i}>
                        <tr
                          role="button"
                          tabIndex={0}
                          onClick={() => setExpandedRowIndex(isExpanded ? null : i)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setExpandedRowIndex(isExpanded ? null : i);
                            }
                          }}
                          className={`border-b border-border last:border-b-0 cursor-pointer hover:bg-muted/30 ${isExpanded ? "bg-muted/20" : ""}`}
                        >
                          <td className="px-4 py-3">{formatDateDisplay(row.date)}</td>
                          <td className="px-4 py-3 min-w-0 truncate" title={row.email}>
                            {row.email}
                          </td>
                          <td className="px-4 py-3 min-w-0 truncate" title={row.agent}>
                            {row.agent}
                          </td>
                          <td className="px-4 py-3">
                            {row.callRequested ? (
                              <span className="text-foreground font-medium">Yes</span>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                row.leaseStatus === "Booked"
                                  ? "text-green-700 font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              {row.leaseStatus}
                              {row.leaseStatus === "Booked" && row.leaseId && (
                                <>
                                  {" "}
                                  <a
                                    href={`https://cloud.congdonandcoleman.com/lease/${row.leaseId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary underline hover:no-underline"
                                    title="Open lease"
                                  >
                                    #{row.leaseId}
                                  </a>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {row.revenue > 0
                              ? formatCurrency(row.revenue, "USD")
                              : "—"}
                            <span className="ml-2 text-muted-foreground">
                              {isExpanded ? "▼" : "▶"}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-border bg-muted/10">
                            <td className="w-32 px-4 py-2 align-top" />
                            <td className="px-4 py-2 align-top text-sm">
                              <div className="space-y-1">
                                <div>
                                  <span className="font-medium text-muted-foreground">
                                    Adults:{" "}
                                  </span>
                                  <span className="text-foreground">
                                    {row.adults != null ? String(row.adults) : "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium text-muted-foreground">
                                    Children:{" "}
                                  </span>
                                  <span className="text-foreground">
                                    {row.children != null ? String(row.children) : "—"}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2 align-top text-sm" colSpan={4}>
                              <div>
                                <span className="font-medium text-muted-foreground">
                                  Comment:{" "}
                                </span>
                                <span className="text-foreground">
                                  {row.comment != null && row.comment !== ""
                                    ? row.comment
                                    : "—"}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
