"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
  ReferenceArea,
  ReferenceLine,
} from "recharts";

type KpiRow = {
  agent_name: string;
  total_revenue: number;
  total_commission: number;
  office_commission: number;
};

/** YTD range for a given year: Jan 1 through "today" (same month/day) in that year. */
function getYtdRange(year: number): { gte: string; lte: string } {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(day, lastDayOfMonth);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    gte: `${year}-01-01`,
    lte: `${year}-${pad(month + 1)}-${pad(clampedDay)}`,
  };
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 4, CURRENT_YEAR - 3, CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR];

const ALL_AGENTS_VALUE = "All Agents";
const PREFERRED_AGENT_ORDER = ["Liam", "Joyce", "Suzi", "Ann"];
const AGENT_DISPLAY_NAMES: Record<string, string> = { Ann: "Ann M" };
function agentDisplayName(name: string): string {
  if (name === ALL_AGENTS_VALUE) return name;
  return AGENT_DISPLAY_NAMES[name] ?? name;
}

type YearCount = {
  year: number;
  leases: number;
  totalRevenue: number;
  totalCommission: number;
  officeCommission: number;
  officePct: number;
  label: string;
};

function formatRevenue(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10_000) {
    const sign = n < 0 ? "-" : "";
    const value = abs / 1000;
    const k = value % 1 === 0 ? String(value) : value.toFixed(1);
    return `${sign}$${k}k`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

type YearWithRows = { year: number; rows: KpiRow[] };

export default function RentalsChartsPage() {
  const [resultsByYear, setResultsByYear] = useState<YearWithRows[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>(ALL_AGENTS_VALUE);

  const data = useMemo(() => {
    return resultsByYear.map(({ year, rows }) => {
      const count = rows.length;
      const totalRevenue = rows.reduce((s, r) => s + (r.total_revenue || 0), 0);
      const totalCommission = rows.reduce((s, r) => s + (r.total_commission || 0), 0);
      const officeCommission = rows.reduce((s, r) => s + (r.office_commission || 0), 0);
      const officePct = totalCommission > 0 ? (officeCommission / totalCommission) * 100 : 0;
      return {
        year,
        leases: count,
        totalRevenue,
        totalCommission,
        officeCommission,
        officePct: Math.round(officePct * 10) / 10,
        label: `${year}`,
      };
    });
  }, [resultsByYear]);

  const agentOptions = useMemo(() => {
    const names = new Set<string>();
    resultsByYear.forEach(({ rows }) =>
      rows.forEach((r) => {
        if (r.agent_name?.trim()) names.add(r.agent_name.trim());
      })
    );
    const list = Array.from(names);
    list.sort((a, b) => {
      const i = PREFERRED_AGENT_ORDER.indexOf(a);
      const j = PREFERRED_AGENT_ORDER.indexOf(b);
      if (i !== -1 && j !== -1) return i - j;
      if (i !== -1) return -1;
      if (j !== -1) return 1;
      return a.localeCompare(b);
    });
    return [ALL_AGENTS_VALUE, ...list];
  }, [resultsByYear]);

  const agentChartData = useMemo(() => {
    if (!selectedAgent) return [];
    return resultsByYear.map(({ year, rows }) => {
      const agentRows =
        selectedAgent === ALL_AGENTS_VALUE ? rows : rows.filter((r) => (r.agent_name || "").trim() === selectedAgent);
      const totalRevenue = agentRows.reduce((s, r) => s + (r.total_revenue || 0), 0);
      const agentCommission = agentRows.reduce(
        (s, r) => s + (Math.max(0, (r.total_commission || 0) - (r.office_commission || 0))),
        0
      );
      return {
        year,
        label: `${year}`,
        totalRevenue,
        agentCommission,
      };
    });
  }, [resultsByYear, selectedAgent]);

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const yearResults = await Promise.all(
          YEARS.map(async (year) => {
            const { gte, lte } = getYtdRange(year);
            const res = await fetch(
              `/api/rentals-kpi?${new URLSearchParams({ created_date_gte: gte, created_date_lte: lte }).toString()}`
            );
            const json = await res.json();
            const rows: KpiRow[] = (Array.isArray(json?.results) ? json.results : []).map(
              (r: { agent_name?: string; total_revenue?: number; total_commission?: number; office_commission?: number }) => ({
                agent_name: String(r?.agent_name ?? "").trim(),
                total_revenue: Number(r?.total_revenue) || 0,
                total_commission: Number(r?.total_commission) || 0,
                office_commission: Number(r?.office_commission) || 0,
              })
            );
            return { year, rows };
          })
        );
        if (!cancelled) {
          setResultsByYear(yearResults);
          if (yearResults.length > 0) {
            const allNames = new Set<string>();
            yearResults.forEach(({ rows }) => rows.forEach((r) => r.agent_name && allNames.add(r.agent_name)));
            setSelectedAgent((prev) =>
              prev === ALL_AGENTS_VALUE || (prev && allNames.has(prev)) ? prev : ALL_AGENTS_VALUE
            );
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load data");
          setResultsByYear([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center gap-4">
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
          Rentals Charts
        </h1>
        <p className="text-muted-foreground mb-6">
          Leases YTD for the past 5 years (through today's date in each year).
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
        ) : (
          <>
          <div className="rounded-lg bg-card p-6 shadow-[0_4px_6px_rgba(0,0,0,0.05)]">
            <h2 className="text-lg font-medium text-foreground mb-4">
              Leases & Total Revenue YTD by year
            </h2>
            {data.length > 0 && (
              <div className="rounded-md border border-border bg-muted/30 px-4 py-3 mb-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                  Summary — {CURRENT_YEAR} YTD (Current Year)
                </p>
                <p className="text-sm text-foreground">
                  <span className="font-medium">{data[data.length - 1]?.leases ?? 0} leases</span>
                  {" · "}
                  <span className="font-medium">{formatRevenue(data[data.length - 1]?.totalRevenue ?? 0)} revenue</span>
                </p>
              </div>
            )}
            <div className="h-[360px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={data}
                  margin={{ top: 36, right: 56, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  {data.length > 0 && (
                    <ReferenceArea
                      x1={data.length - 1}
                      x2={data.length}
                      fill="hsl(var(--muted))"
                      fillOpacity={0.6}
                      label={{
                        value: "Current Year",
                        position: "top",
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                      }}
                    />
                  )}
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    fontSize={12}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    fontSize={12}
                    allowDecimals={false}
                    label={{ value: "Leases", angle: -90, position: "insideLeft", style: { fill: "hsl(var(--muted-foreground))" } }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    fontSize={12}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                    label={{ value: "Total Revenue", angle: 90, position: "insideRight", style: { fill: "hsl(var(--muted-foreground))" } }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                      boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 500 }}
                    formatter={(value: number, name: string) =>
                      [name === "Total Revenue" ? formatRevenue(value) : value, name]
                    }
                    labelFormatter={(label) => `${label} YTD`}
                  />
                  <Bar
                    dataKey="leases"
                    yAxisId="left"
                    fill="var(--primary)"
                    radius={[4, 4, 0, 0]}
                    name="Leases"
                    maxBarSize={48}
                  >
                    <LabelList
                      dataKey="leases"
                      position="top"
                      fill="hsl(var(--foreground))"
                      fontSize={12}
                      fontWeight={500}
                    />
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="totalRevenue"
                    yAxisId="right"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={{ fill: "var(--accent)", strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                    name="Total Revenue"
                  >
                    <LabelList
                      dataKey="totalRevenue"
                      position="top"
                      formatter={(v: number) => formatRevenue(v)}
                      fill="hsl(var(--muted-foreground))"
                      fontSize={11}
                      fontWeight={500}
                    />
                  </Line>
                  <Legend
                    layout="horizontal"
                    align="right"
                    verticalAlign="top"
                    wrapperStyle={{ paddingBottom: 8 }}
                    iconType="square"
                    iconSize={10}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg bg-card p-6 shadow-[0_4px_6px_rgba(0,0,0,0.05)] mt-8">
            <h2 className="text-lg font-medium text-foreground mb-4">
              Total Commission & Office % of Total Commission
            </h2>
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={data}
                  margin={{ top: 36, right: 56, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  {data.map((d) => (
                    <ReferenceLine
                      key={d.label}
                      x={d.label}
                      yAxisId="left"
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                      strokeOpacity={0.5}
                    />
                  ))}
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "hsl(var(--muted-foreground))", opacity: 0.7 }}
                    fontSize={12}
                  />
                  <YAxis
                    yAxisId="left"
                    domain={[0, 200000]}
                    tick={{ fill: "hsl(var(--muted-foreground))", opacity: 0.65 }}
                    fontSize={12}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                    label={{ value: "Total Commission", angle: -90, position: "insideLeft", style: { fill: "hsl(var(--muted-foreground))", opacity: 0.8 } }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    tick={{ fill: "hsl(var(--muted-foreground))", opacity: 0.65 }}
                    fontSize={12}
                    tickFormatter={(v) => `${v}%`}
                    label={{ value: "Office % of Total", angle: 90, position: "insideRight", style: { fill: "hsl(var(--muted-foreground))", opacity: 0.8 } }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                      boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 500 }}
                    formatter={(value: number, name: string) =>
                      [name === "Total Commission" ? formatRevenue(value) : `${value}%`, name]
                    }
                    labelFormatter={(label) => `${label} YTD`}
                    cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "3 3", opacity: 0.7 }}
                  />
                  <Bar
                    dataKey="totalCommission"
                    yAxisId="left"
                    fill="var(--primary)"
                    radius={[4, 4, 0, 0]}
                    name="Total Commission"
                    maxBarSize={48}
                  >
                    <LabelList
                      dataKey="totalCommission"
                      position="top"
                      formatter={(v: number) => formatRevenue(v)}
                      fill="hsl(var(--foreground))"
                      fontSize={11}
                      fontWeight={500}
                    />
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="officePct"
                    yAxisId="right"
                    stroke="var(--accent)"
                    strokeWidth={3}
                    dot={{ fill: "var(--accent)", strokeWidth: 0, r: 5 }}
                    activeDot={{ r: 7, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                    name="Office % of Total Commission"
                  >
                    <LabelList
                      dataKey="officePct"
                      position="top"
                      formatter={(v: number) => `${v}%`}
                      fill="hsl(var(--muted-foreground))"
                      fontSize={11}
                      fontWeight={500}
                    />
                  </Line>
                  <Legend
                    layout="horizontal"
                    align="right"
                    verticalAlign="top"
                    wrapperStyle={{ paddingBottom: 8 }}
                    iconType="square"
                    iconSize={10}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg bg-card p-6 shadow-[0_4px_6px_rgba(0,0,0,0.05)] mt-8">
            <h2 className="text-lg font-medium text-foreground mb-4">
              By agent — Total Revenue & Agent Commission (YTD, last 5 years)
            </h2>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <label htmlFor="agent-filter" className="text-sm font-medium text-foreground">
                Agent
              </label>
              <select
                id="agent-filter"
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-w-[180px]"
              >
                {agentOptions.map((name) => (
                  <option key={name} value={name}>
                    {agentDisplayName(name)}
                  </option>
                ))}
              </select>
            </div>
            {selectedAgent && agentChartData.length > 0 && (
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={agentChartData}
                    margin={{ top: 36, right: 56, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      fontSize={12}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      fontSize={12}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                      label={{ value: "Total Revenue", angle: -90, position: "insideLeft", style: { fill: "hsl(var(--muted-foreground))" } }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      fontSize={12}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                      label={{ value: "Agent Commission", angle: 90, position: "insideRight", style: { fill: "hsl(var(--muted-foreground))" } }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                        boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 500 }}
                      formatter={(value: number, name: string) => [name === "Total Revenue" ? formatRevenue(value) : formatRevenue(value), name]}
                      labelFormatter={(label) => `${label} YTD`}
                    />
                    <Bar
                      dataKey="totalRevenue"
                      yAxisId="left"
                      fill="var(--primary)"
                      radius={[4, 4, 0, 0]}
                      name="Total Revenue"
                      maxBarSize={48}
                    >
                      <LabelList
                        dataKey="totalRevenue"
                        position="top"
                        formatter={(v: number) => formatRevenue(v)}
                        fill="hsl(var(--foreground))"
                        fontSize={11}
                        fontWeight={500}
                      />
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="agentCommission"
                      yAxisId="right"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={{ fill: "var(--accent)", strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                      name="Agent Commission"
                    >
                      <LabelList
                        dataKey="agentCommission"
                        position="top"
                        formatter={(v: number) => formatRevenue(v)}
                        fill="hsl(var(--muted-foreground))"
                        fontSize={11}
                        fontWeight={500}
                      />
                    </Line>
                    <Legend
                      layout="horizontal"
                      align="right"
                      verticalAlign="top"
                      wrapperStyle={{ paddingBottom: 8 }}
                      iconType="square"
                      iconSize={10}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            {selectedAgent && agentChartData.length > 0 && agentChartData.every((d) => d.totalRevenue === 0 && d.agentCommission === 0) && (
              <p className="text-sm text-muted-foreground py-6">No YTD data for this agent in the last 5 years.</p>
            )}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
