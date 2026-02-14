"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";

type PieData = { name: string; value: number; percentage: number };

type FeedDebug = {
  topLevelKeys: string[];
  structureSummary?: Record<string, string>;
  firstListingKeys: string[];
  sample: Record<string, unknown>;
  parsedCount?: number;
  pagesFetched?: number;
};

export default function RentalsStatusPage() {
  const [data, setData] = useState<{
    ccRentalListings: number;
    activeInRentalsUnited: number;
    excluded: number;
    withStrPermit: number;
    strPermitPercent: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedFields, setFeedFields] = useState<FeedDebug | null>(null);
  const [loadingFields, setLoadingFields] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/rentals-status");
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json?.error ?? `Request failed: ${res.status}`);
          setData(null);
          return;
        }
        setData({
          ccRentalListings: json.ccRentalListings ?? 0,
          activeInRentalsUnited: json.activeInRentalsUnited ?? 0,
          excluded: json.excluded ?? 0,
          withStrPermit: json.withStrPermit ?? 0,
          strPermitPercent: json.strPermitPercent ?? 0,
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
  }, []);

  async function showFeedFields() {
    setLoadingFields(true);
    setFeedFields(null);
    try {
      const res = await fetch("/api/rentals-status?debug=1");
      const json = await res.json();
      if (json?.debug) setFeedFields(json.debug);
      else setFeedFields({ topLevelKeys: [], sample: {}, firstListingKeys: [] });
    } catch {
      setFeedFields({ topLevelKeys: [], sample: {}, firstListingKeys: [] });
    } finally {
      setLoadingFields(false);
    }
  }

  const pieData: PieData[] =
    data && data.ccRentalListings > 0
      ? [
          {
            name: "Active in Rentals United",
            value: data.activeInRentalsUnited,
            percentage: Math.round((data.activeInRentalsUnited / data.ccRentalListings) * 1000) / 10,
          },
          {
            name: "Excluded",
            value: data.excluded,
            percentage: Math.round((data.excluded / data.ccRentalListings) * 1000) / 10,
          },
        ].filter((d) => d.value > 0)
      : [];

  const COLORS = ["var(--primary)", "var(--accent)"];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
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
          Rentals Listing Status
        </h1>
        <p className="text-muted-foreground mb-6">
          Listings and their status in Rentals United.
        </p>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-foreground">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span>Loading…</span>
          </div>
        ) : data ? (
          <div className="rounded-lg bg-card p-6 shadow-[0_4px_6px_rgba(0,0,0,0.05)]">
            <h2 className="text-lg font-medium text-foreground mb-4">
              C&C Rental Listings vs. Active in Rentals United
            </h2>
            <div className="rounded-md border border-border bg-muted/30 px-4 py-3 mb-6">
              <p className="text-sm text-foreground">
                <span className="font-medium">{data.ccRentalListings}</span> C&C Rental Listings ·{" "}
                <span className="font-medium">{data.activeInRentalsUnited}</span> active in Rentals United (
                {data.ccRentalListings > 0 ? Math.round((data.activeInRentalsUnited / data.ccRentalListings) * 1000) / 10 : 0}%)
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-4 py-3 mb-6">
              <p className="text-sm font-medium text-foreground mb-1">% of listings with STR Permit Number</p>
              <p className="text-2xl font-semibold text-foreground">
                {data.strPermitPercent}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.withStrPermit} of {data.ccRentalListings} listings
              </p>
            </div>
            {pieData.length > 0 ? (
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                      formatter={(value: number, name: string, props) => {
                        const pct = (props?.payload as PieData | undefined)?.percentage;
                        return [
                          pct != null ? `${value} (${pct}%)` : String(value),
                          name,
                        ];
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No listing data to display.
              </p>
            )}
          </div>
        ) : null}

        {feedFields && (
          <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <p className="mb-2 font-medium text-foreground">Feed structure (debug)</p>
            {(feedFields.parsedCount != null || feedFields.pagesFetched != null) && (
              <p className="mb-2 text-muted-foreground">
                Parsed: {feedFields.parsedCount ?? "—"} listings
                {feedFields.pagesFetched != null && ` · ${feedFields.pagesFetched} page(s) fetched`}
              </p>
            )}
            <p className="mb-2 text-muted-foreground">
              Top-level: {feedFields.topLevelKeys.length ? feedFields.topLevelKeys.join(", ") : "(none)"}
            </p>
            {feedFields.structureSummary && Object.keys(feedFields.structureSummary).length > 0 && (
              <p className="mb-2 text-muted-foreground">
                Structure: {Object.entries(feedFields.structureSummary).map(([k, v]) => `${k}=${v}`).join(", ")}
              </p>
            )}
            <p className="mb-2 text-muted-foreground">
              First listing keys: {feedFields.firstListingKeys.length ? feedFields.firstListingKeys.join(", ") : "(none)"}
            </p>
            <pre className="max-h-96 overflow-auto rounded bg-background p-3 text-xs">
              {JSON.stringify(feedFields.sample, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
