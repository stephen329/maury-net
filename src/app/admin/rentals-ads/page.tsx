"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

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
        params.set("debug", "1");
        const res = await fetch(`/api/rentals-ads?${params.toString()}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          const errMsg = json?.error ?? `Request failed: ${res.status}`;
          const debugInfo = json?.debug
            ? ` [Debug: loginCustomerIdSet=${json.debug.loginCustomerIdSet}, length=${json.debug.loginCustomerIdLength ?? "n/a"}]`
            : "";
          setError(errMsg + debugInfo);
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
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-[var(--odin-carolina-blue)] hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to Admin
        </Link>
      </div>

      <h1 className="text-xl md:text-[28px] font-bold tracking-[1.68px] text-[var(--odin-navy)] mb-2">
        Rentals Ad Performance
      </h1>
      <p className="text-[var(--odin-black-60)] text-sm mb-4">
        Track paid advertising spend and performance for rental listings.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label htmlFor="date-preset" className="text-sm font-medium text-[var(--odin-navy)]">
          Date range
        </label>
        <select
          id="date-preset"
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value as DatePreset)}
          className="rounded-none border border-[var(--odin-roman-silver)] bg-white px-3 py-2 text-sm text-[var(--odin-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--odin-carolina-blue)] focus:border-[var(--odin-carolina-blue)]"
        >
          <option value="this_month">{DATE_PRESET_LABELS.this_month}</option>
          <option value="last_month">{DATE_PRESET_LABELS.last_month}</option>
          <option value="this_year">{DATE_PRESET_LABELS.this_year}</option>
        </select>
        {(() => {
          const { from, to } = getDateRangeForPreset(datePreset);
          const label = formatDateRangeLabel(from, to);
          return label ? (
            <span className="text-sm text-[var(--odin-black-60)]">{label}</span>
          ) : null;
        })()}
      </div>

      {error && (
        <div className="mb-6 rounded-none border border-[var(--color-destructive)] bg-red-50 p-4 text-sm text-[var(--odin-navy)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12 gap-2 text-[var(--odin-roman-silver)]">
          <Loader2 className="size-5 animate-spin" />
          <span>Loading…</span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        <div className="rounded-[10px] bg-white p-4 shadow-[var(--odin-shadow-card)]">
          <p className="text-[10px] md:text-xs font-normal text-[var(--odin-black-60)] mb-1">
            Costs
          </p>
          <p className="text-lg font-bold text-[var(--odin-navy)]">
            {loading ? "…" : data ? formatCurrency(data.totalSpend, data.currencyCode) : "—"}
          </p>
        </div>
        <div className="rounded-[10px] bg-white p-4 shadow-[var(--odin-shadow-card)]">
          <p className="text-[10px] md:text-xs font-normal text-[var(--odin-black-60)] mb-1">
            Clicks
          </p>
          <p className="text-lg font-bold text-[var(--odin-navy)]">—</p>
        </div>
        <div className="rounded-[10px] bg-white p-4 shadow-[var(--odin-shadow-card)]">
          <p className="text-[10px] md:text-xs font-normal text-[var(--odin-black-60)] mb-1">
            Leads
          </p>
          <p className="text-lg font-bold text-[var(--odin-navy)]">
            {ppcLeadsLoading ? "…" : ppcLeads.length}
          </p>
        </div>
        <div className="rounded-[10px] bg-white p-4 shadow-[var(--odin-shadow-card)]">
          <p className="text-[10px] md:text-xs font-normal text-[var(--odin-black-60)] mb-1">
            Conversion Rate
          </p>
          <p className="text-lg font-bold text-[var(--odin-navy)]">—</p>
        </div>
        <div className="rounded-[10px] bg-white p-4 shadow-[var(--odin-shadow-card)]">
          <p className="text-[10px] md:text-xs font-normal text-[var(--odin-black-60)] mb-1">
            Revenue
          </p>
          <p className="text-lg font-bold text-[var(--odin-navy)]">
            {ppcLeadsLoading
              ? "…"
              : formatCurrency(
                  ppcLeads.reduce((sum, r) => sum + r.revenue, 0),
                  "USD",
                )}
          </p>
        </div>
        <div className="rounded-[10px] bg-white p-4 shadow-[var(--odin-shadow-card)]">
          <p className="text-[10px] md:text-xs font-normal text-[var(--odin-black-60)] mb-1">
            ROAS
          </p>
          <p className="text-lg font-bold text-[var(--odin-navy)]">
            {ppcLeadsLoading || loading
              ? "…"
              : data && data.totalSpend > 0
                ? `${(ppcLeads.reduce((sum, r) => sum + r.revenue, 0) / data.totalSpend).toFixed(2)}x`
                : "—"}
          </p>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-base md:text-[23px] font-bold tracking-[1.68px] text-[var(--odin-navy)] mb-2">
          PPC Leads
        </h2>
        <p className="text-xs text-[var(--odin-black-60)] mb-4">
          Rental opportunities from book.nantucketrentals.com
        </p>
        {ppcLeadsError && (
          <div className="mb-4 rounded-none border border-red-500 bg-red-50 p-4 text-sm text-[var(--odin-navy)]">
            {ppcLeadsError}
          </div>
        )}
        {ppcLeadsLoading ? (
          <div className="flex justify-center py-12 gap-2 text-[var(--odin-roman-silver)]">
            <Loader2 className="size-5 animate-spin" />
            <span>Loading…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] md:text-xs table-fixed text-left">
              <colgroup>
                <col style={{ width: "15%" }} />
                <col style={{ width: "25%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "12.5%" }} />
                <col style={{ width: "12.5%" }} />
              </colgroup>
              <thead className="bg-slate-50 border-t">
                <tr>
                  <th className="text-[var(--odin-black-60)] font-normal px-4 py-3">Date</th>
                  <th className="text-[var(--odin-black-60)] font-normal px-4 py-3">Email</th>
                  <th className="text-[var(--odin-black-60)] font-normal px-4 py-3">Agent</th>
                  <th className="text-[var(--odin-black-60)] font-normal px-4 py-3">Call Requested?</th>
                  <th className="text-[var(--odin-black-60)] font-normal px-4 py-3">Lease Status</th>
                  <th className="text-[var(--odin-black-60)] font-normal px-4 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {ppcLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--odin-roman-silver)]">
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
                          className={`border-b border-slate-200 last:border-b-0 cursor-pointer hover:bg-slate-50 ${isExpanded ? "bg-slate-50" : "bg-white"}`}
                        >
                          <td className="px-4 py-3 text-[var(--odin-navy)]">{formatDateDisplay(row.date)}</td>
                          <td className="px-4 py-3 min-w-0 truncate text-[var(--odin-navy)]" title={row.email}>
                            {row.email}
                          </td>
                          <td className="px-4 py-3 min-w-0 truncate text-[var(--odin-navy)]" title={row.agent}>
                            {row.agent}
                          </td>
                          <td className="px-4 py-3">
                            {row.callRequested ? (
                              <span className="text-[var(--odin-navy)] font-bold">Yes</span>
                            ) : (
                              <span className="text-[var(--odin-black-60)]">No</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                row.leaseStatus === "Booked"
                                  ? "font-bold text-[var(--odin-success)]"
                                  : "text-[var(--odin-black-60)]"
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
                                    className="text-[var(--odin-carolina-blue)] underline hover:no-underline"
                                    title="Open lease"
                                  >
                                    #{row.leaseId}
                                  </a>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[var(--odin-navy)]">
                            {row.revenue > 0
                              ? formatCurrency(row.revenue, "USD")
                              : "—"}
                            <span className="ml-2 text-[var(--odin-black-60)] font-normal">
                              {isExpanded ? "▼" : "▶"}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-slate-200 bg-slate-50/80">
                            <td className="w-32 px-4 py-2 align-top" />
                            <td className="px-4 py-2 align-top text-xs">
                              <div className="space-y-1">
                                <div>
                                  <span className="font-normal text-[var(--odin-black-60)]">
                                    Adults:{" "}
                                  </span>
                                  <span className="text-[var(--odin-navy)]">
                                    {row.adults != null ? String(row.adults) : "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-normal text-[var(--odin-black-60)]">
                                    Children:{" "}
                                  </span>
                                  <span className="text-[var(--odin-navy)]">
                                    {row.children != null ? String(row.children) : "—"}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2 align-top text-xs" colSpan={4}>
                              <div>
                                <span className="font-normal text-[var(--odin-black-60)]">
                                  Comment:{" "}
                                </span>
                                <span className="text-[var(--odin-navy)]">
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
