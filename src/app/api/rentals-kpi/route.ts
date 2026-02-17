import { NextResponse } from "next/server";

export type RentalsKpiRow = {
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

function num(val: unknown): number {
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (typeof val === "string") return Number(val) || 0;
  return 0;
}

function str(val: unknown): string {
  if (val == null) return "";
  return String(val);
}

/** Return only the first name (first word) from a full name string. */
function firstNameOnly(full: string): string {
  const word = full.trim().split(/\s+/)[0];
  return word ?? "";
}

/** Resolve agent first name from string or nested object. Returns first name only. */
function resolveAgentName(raw: Record<string, unknown>): string {
  const get = (snake: string, camel: string) => raw[snake] ?? raw[camel];
  // Direct string fields (Congdon and common variants)
  const direct =
    get("agent_name", "agentName") ??
    get("listing_agent_name", "listingAgentName") ??
    get("agent", "agent") ??
    get("listing_agent", "listingAgent") ??
    get("primary_agent", "primaryAgent") ??
    get("agent_name_display", "agentNameDisplay") ??
    get("assigned_agent", "assignedAgent") ??
    get("assigned_to", "assignedTo") ??
    get("contact_name", "contactName") ??
    get("contact", "contact") ??
    get("broker_name", "brokerName") ??
    get("salesperson", "salesperson") ??
    get("user_name", "userName") ??
    get("user", "user") ??
    get("primary_contact", "primaryContact");
  if (typeof direct === "string" && direct.trim()) return firstNameOnly(direct);
  // Nested object: prefer first_name when present, else first word of name
  const obj = direct && typeof direct === "object" && direct !== null ? (direct as Record<string, unknown>) : null;
  if (obj) {
    const first = str(obj["first_name"] ?? obj["firstName"]);
    if (first) return first.trim();
    const name = obj["name"] ?? obj["full_name"] ?? obj["fullName"] ?? obj["display_name"] ?? obj["displayName"];
    if (typeof name === "string" && name.trim()) return firstNameOnly(name);
  }
  // Root-level nested keys (e.g. raw.agent is object)
  for (const key of ["agent", "listing_agent", "listingAgent", "primary_agent", "primaryAgent", "assigned_agent", "assignedAgent", "contact", "user"]) {
    const val = raw[key];
    if (val && typeof val === "object" && val !== null) {
      const o = val as Record<string, unknown>;
      const first = str(o["first_name"] ?? o["firstName"]);
      if (first) return first.trim();
      const n = o["name"] ?? o["full_name"] ?? o["fullName"] ?? o["display_name"] ?? o["displayName"];
      if (typeof n === "string" && n.trim()) return firstNameOnly(n);
    }
  }
  // Fallback: any key containing agent/contact/broker/user (string or nested object)
  for (const key of Object.keys(raw)) {
    const k = key.toLowerCase();
    if (
      (k.includes("agent") || k.includes("contact") || k.includes("broker") || k === "user" || k === "user_name" || k === "username") &&
      !k.includes("id") &&
      !k.includes("email")
    ) {
      const val = raw[key];
      if (typeof val === "string" && val.trim()) return firstNameOnly(val);
      if (val && typeof val === "object" && val !== null) {
        const o = val as Record<string, unknown>;
        const first = str(o["first_name"] ?? o["firstName"]);
        if (first) return first.trim();
        const n = o["name"] ?? o["full_name"] ?? o["fullName"];
        if (typeof n === "string" && n.trim()) return firstNameOnly(n);
      }
    }
  }
  return "";
}

/** Resolve address from feed; prefer listing_address (Congdon). */
function resolvePropertyAddress(raw: Record<string, unknown>): string {
  const get = (snake: string, camel: string) => raw[snake] ?? raw[camel];
  const direct =
    get("listing_address", "listingAddress") ??
    get("street_address", "streetAddress") ??
    get("property_street_address", "propertyStreetAddress") ??
    get("address", "Address") ??
    get("property_address", "propertyAddress") ??
    get("street", "street") ??
    get("line1", "line1") ??
    get("line_1", "line_1") ??
    get("address_line_1", "addressLine1");
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const prop = get("property", "property") ?? get("listing", "listing") ?? get("unit", "unit");
  if (prop && typeof prop === "object" && prop !== null) {
    const o = prop as Record<string, unknown>;
    const s =
      o["listing_address"] ?? o["listingAddress"] ??
      o["street_address"] ?? o["streetAddress"] ?? o["property_street_address"] ?? o["propertyStreetAddress"] ??
      o["address"] ?? o["Address"] ?? o["street"] ?? o["Street"] ?? o["line1"] ?? o["line_1"];
    if (typeof s === "string" && s.trim()) return s.trim();
  }
  return "";
}

/** Return the actual status value from the feed (no normalization). */
function rawStatus(raw: Record<string, unknown>): string {
  const get = (snake: string, camel: string) => raw[snake] ?? raw[camel];
  const val = get("status", "status") ?? get("signed", "signed") ?? get("contract_status", "contractStatus") ?? get("lease_status", "leaseStatus");
  if (val == null) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return String(val);
  return String(val);
}

/** Map Congdon lease-activity (or similar) item to RentalsKpiRow. Supports snake_case and camelCase. */
function mapToKpiRow(raw: Record<string, unknown>, index: number): RentalsKpiRow {
  const get = (snake: string, camel: string) => raw[snake] ?? raw[camel];
  // Contract Date: try common API field names (Congdon uses created_date_* for filters)
  const contractDate =
    get("contract_date", "contractDate") ??
    get("created_date", "createdDate") ??
    get("contract_data", "contractData") ??
    get("date", "date") ??
    get("signed_date", "signedDate") ??
    get("start_date", "startDate") ??
    get("lease_date", "leaseDate") ??
    get("effective_date", "effectiveDate") ??
    get("created_at", "createdAt") ??
    get("created", "created");
  // Lease # for link to cloud.congdonandcoleman.com/leases/[id]
  const leaseId =
    str(get("lease_id", "leaseId")) ||
    str(get("lease_number", "leaseNumber")) ||
    str(get("id", "id")) ||
    (num(get("booking_id", "bookingId")) || index + 1).toString();
  const agentCommission = num(get("agent_commission", "agentCommission"));
  const officeCommission = num(get("office_commission", "officeCommission"));
  const processingFee = num(get("processing_fee", "processingFee"));
  const nrBookingFee = num(get("nr_booking_fee", "nrBookingFee"));
  const bookingFee = processingFee + nrBookingFee;
  const totalRevenue = officeCommission + bookingFee;
  return {
    booking_id: num(get("booking_id", "bookingId")) || index + 1,
    lease_id: leaseId,
    contract_data: str(contractDate),
    agent_name: resolveAgentName(raw),
    address: resolvePropertyAddress(raw),
    status: rawStatus(raw),
    gross_rent: num(get("gross_rent", "grossRent") || get("rent", "rent")),
    total_commission: agentCommission + officeCommission,
    office_commission: officeCommission,
    booking_fee: bookingFee,
    total_revenue: totalRevenue,
  };
}

function normalizeResults(data: unknown): RentalsKpiRow[] {
  if (Array.isArray(data)) {
    return data.map((item, i) => mapToKpiRow(typeof item === "object" && item != null ? (item as Record<string, unknown>) : {}, i));
  }
  if (data && typeof data === "object" && "results" in data && Array.isArray((data as { results: unknown[] }).results)) {
    return (data as { results: unknown[] }).results.map((item, i) =>
      mapToKpiRow(typeof item === "object" && item != null ? (item as Record<string, unknown>) : {}, i)
    );
  }
  if (data && typeof data === "object" && "data" in data && Array.isArray((data as { data: unknown[] }).data)) {
    return (data as { data: unknown[] }).data.map((item, i) =>
      mapToKpiRow(typeof item === "object" && item != null ? (item as Record<string, unknown>) : {}, i)
    );
  }
  return [];
}

export async function GET(request: Request) {
  const congdonUrl = process.env.CONGDON_API_URL?.replace(/\/$/, "");
  const congdonKey = process.env.CONGDON_API_KEY;
  const jwt = process.env.CONGDON_COLEMAN_JWT?.trim();
  const baseUrl = process.env.NRBE_API_URL;

  const { searchParams } = new URL(request.url);
  const debugLeaseId = searchParams.get("debug_lease_id");

  // Try Congdon when URL is set, with whatever auth is available (JWT > API key > none)
  if (congdonUrl) {
    const apiHeaders: HeadersInit = (() => {
      const h: Record<string, string> = { Accept: "application/json" };
      if (jwt) h.Authorization = `JWT ${jwt}`;
      else if (congdonKey) h["x-api-key"] = congdonKey;
      return h;
    })();
    const url = `${congdonUrl}/lease-activity`;
    // When debugging a specific lease, use wide date range to find it
    const createdDateGte =
      debugLeaseId ? "2020-01-01" : (searchParams.get("created_date_gte") ?? searchParams.get("from_date"));
    const createdDateLte =
      debugLeaseId ? new Date().toISOString().slice(0, 10) : (searchParams.get("created_date_lte") ?? searchParams.get("to_date"));
    const status = searchParams.get("status");
    const fullUrl = new URL(url);
    if (createdDateGte) fullUrl.searchParams.set("created_date_gte", createdDateGte);
    if (createdDateLte) fullUrl.searchParams.set("created_date_lte", createdDateLte);
    if (status) fullUrl.searchParams.set("status", status);
    fullUrl.searchParams.set("limit", "2000");

    try {
      const res = await fetch(fullUrl.toString(), {
        headers: apiHeaders,
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        const rawItems = Array.isArray(data)
          ? data
          : (data && typeof data === "object" && "results" in data && Array.isArray((data as { results: unknown[] }).results))
            ? (data as { results: unknown[] }).results
            : (data && typeof data === "object" && "data" in data && Array.isArray((data as { data: unknown[] }).data))
              ? (data as { data: unknown[] }).data
              : [];
        const results = normalizeResults(data);
        const debug = searchParams.get("debug");
        const body: {
          results: RentalsKpiRow[];
          debug?: { keys: string[]; sample: Record<string, unknown> };
          debug_lease?: { lease_id: string; raw: Record<string, unknown>; mapped_status: string };
        } = { results };
        if (debug === "1" || debug === "true") {
          const first = rawItems[0];
          const sample = first && typeof first === "object" && first !== null ? (first as Record<string, unknown>) : {};
          body.debug = { keys: Object.keys(sample), sample };
        }
        if (debugLeaseId) {
          const idStr = String(debugLeaseId).trim();
          const getLeaseId = (raw: Record<string, unknown>) => {
            const get = (a: string, b: string) => raw[a] ?? raw[b];
            return String(get("lease_id", "leaseId") ?? get("lease_number", "leaseNumber") ?? get("id", "id") ?? "").trim();
          };
          const rawMatch = rawItems.find(
            (item: unknown) =>
              typeof item === "object" && item != null && getLeaseId(item as Record<string, unknown>) === idStr
          ) as Record<string, unknown> | undefined;
          const mappedRow = results.find((r) => r.lease_id === idStr);
          body.debug_lease = {
            lease_id: idStr,
            raw: rawMatch ?? {},
            mapped_status: mappedRow?.status ?? "(not found)",
          };
        }
        return NextResponse.json(body);
      }
      // Congdon returned non-2xx (e.g. 401 without JWT); fall through to NRBE
    } catch {
      // Congdon fetch failed; fall through to NRBE
    }
  }

  if (!baseUrl) {
    return NextResponse.json(
      {
        error: congdonUrl
          ? "Congdon lease-activity unavailable (may require JWT). Set NRBE_API_URL as fallback, or CONGDON_COLEMAN_JWT."
          : "Neither Congdon (CONGDON_API_URL) nor NRBE (NRBE_API_URL) is set. See .env.example.",
        results: [],
      },
      { status: 503 }
    );
  }

  const fromDate = searchParams.get("from_date") ?? searchParams.get("created_date_gte") ?? "";
  const toDate = searchParams.get("to_date") ?? searchParams.get("created_date_lte") ?? "";
  const url = new URL("/api/booking/rentals-kpi/", baseUrl);
  if (fromDate) url.searchParams.set("from_date", fromDate);
  if (toDate) url.searchParams.set("to_date", toDate);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `nrbe returned ${res.status}: ${text}`, results: [] },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch from nrbe: ${message}`, results: [] },
      { status: 502 }
    );
  }
}
