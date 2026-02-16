import { NextResponse } from "next/server";

export type PpcLeadRow = {
  date: string;
  email: string;
  agent: string;
  callRequested: boolean;
  leaseStatus: "Booked" | "None";
  revenue: number;
  /** Lease id from feed when status is Booked (links lead to lease for matching) */
  leaseId?: string;
  adults?: string | number;
  children?: string | number;
  comment?: string;
};

function str(val: unknown): string {
  if (val == null) return "";
  return String(val).trim();
}

function num(val: unknown): number {
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (typeof val === "string") return Number(val) || 0;
  return 0;
}

function get(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && v !== "") return v;
  }
  return undefined;
}

/** Extract tenant/contact email from lease-activity raw item. Tries all common API field names so we can match leases to leads. */
function getTenantEmail(raw: Record<string, unknown>): string {
  const v =
    get(raw, "tenant_email", "tenantEmail", "tenant_email1", "tenantEmail1") ??
    get(raw, "contact_email", "contactEmail", "renter_email", "renterEmail") ??
    get(raw, "guest_email", "guestEmail", "lessee_email", "lesseeEmail") ??
    get(raw, "email", "primary_email", "primaryEmail", "email1");
  if (typeof v === "string") return v.trim().toLowerCase();
  const contact = raw.tenant ?? raw.contact ?? raw.renter ?? raw.guest ?? raw.lessee;
  if (contact && typeof contact === "object") {
    const c = contact as Record<string, unknown>;
    const email = get(c, "email1", "email", "email_address", "primary_email");
    if (typeof email === "string") return email.trim().toLowerCase();
  }
  return "";
}

/** Extract contract/lease date as YYYY-MM-DD for comparison */
function getContractDate(raw: Record<string, unknown>): string {
  const v =
    get(raw, "contract_date", "contractDate", "created_date", "createdDate") ??
    get(raw, "contract_data", "contractData", "date", "signed_date", "signedDate") ??
    get(raw, "start_date", "startDate", "lease_date", "leaseDate") ??
    get(raw, "created_at", "createdAt", "created");
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return "";
}

/** Get lease identifier from raw lease-activity item for lookup */
function getLeaseId(raw: Record<string, unknown>): string {
  const v =
    get(raw, "lease_id", "leaseId") ??
    get(raw, "lease_number", "leaseNumber") ??
    get(raw, "id");
  return str(v);
}

export async function GET(request: Request) {
  const congdonUrl = process.env.CONGDON_API_URL?.replace(/\/$/, "");
  const congdonKey = process.env.CONGDON_API_KEY;
  const jwt = process.env.CONGDON_COLEMAN_JWT;

  if (!congdonUrl) {
    return NextResponse.json(
      { error: "CONGDON_API_URL not set", rows: [] },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const debug = searchParams.get("debug") === "1" || searchParams.get("debug") === "true";
  const leaseIdLookup = searchParams.get("lease_id");
  const fromParam = searchParams.get("from") ?? searchParams.get("from_date");
  const toParam = searchParams.get("to") ?? searchParams.get("to_date");
  const now = new Date();
  const toDate = toParam ? new Date(toParam) : now;
  const fromDate = fromParam ? new Date(fromParam) : new Date(now.getFullYear(), 0, 1);
  const fromStr = fromDate.toISOString().slice(0, 10);
  const toStr = toDate.toISOString().slice(0, 10);

  const apiHeaders: HeadersInit = (() => {
    const h: Record<string, string> = { Accept: "application/json" };
    if (jwt) h.Authorization = `JWT ${jwt}`;
    else if (congdonKey) h["x-api-key"] = congdonKey;
    return h;
  })();

  if (!jwt && !congdonKey) {
    return NextResponse.json(
      { error: "Set CONGDON_API_KEY or CONGDON_COLEMAN_JWT for rental-opportunity API", rows: [] },
      { status: 503 },
    );
  }

  try {
    // Debug: return lease-activity sample with lease_id → tenant_email so we can verify matching
    if (searchParams.get("debug") === "lease_feed") {
      const leaseUrl = new URL(`${congdonUrl}/lease-activity`);
      leaseUrl.searchParams.set("created_date_gte", fromStr);
      leaseUrl.searchParams.set("created_date_lte", toStr);
      leaseUrl.searchParams.set("limit", "2000");
      const leaseRes = await fetch(leaseUrl.toString(), {
        headers: apiHeaders,
        cache: "no-store",
      });
      if (!leaseRes.ok) {
        const text = await leaseRes.text();
        return NextResponse.json(
          { error: `lease-activity returned ${leaseRes.status}: ${text.slice(0, 200)}`, debug: "lease_feed" },
          { status: 502 },
        );
      }
      const leaseData = (await leaseRes.json()) as unknown;
      const leaseList = Array.isArray(leaseData)
        ? leaseData
        : (leaseData as { results?: unknown[] }).results ?? (leaseData as { data?: unknown[] }).data ?? [];
      const sample = leaseList.slice(0, 100).map((item: unknown) => {
        const raw = typeof item === "object" && item != null ? (item as Record<string, unknown>) : {};
        return {
          lease_id: getLeaseId(raw),
          tenant_email: getTenantEmail(raw) || null,
          contract_date: getContractDate(raw) || null,
        };
      });
      return NextResponse.json({
        debug: "lease_feed",
        fromDate: fromStr,
        toDate: toStr,
        total_leases: leaseList.length,
        sample_lease_emails: sample,
      });
    }

    // Lease lookup by id: fetch lease-activity and return renter email for the given lease_id
    if (leaseIdLookup) {
      const leaseUrl = new URL(`${congdonUrl}/lease-activity`);
      leaseUrl.searchParams.set("limit", "2000");
      // Wide date range so we can find the lease regardless of date
      leaseUrl.searchParams.set("created_date_gte", "2020-01-01");
      leaseUrl.searchParams.set("created_date_lte", toStr);
      const leaseRes = await fetch(leaseUrl.toString(), {
        headers: apiHeaders,
        cache: "no-store",
      });
      if (!leaseRes.ok) {
        const text = await leaseRes.text();
        return NextResponse.json(
          { error: `lease-activity returned ${leaseRes.status}: ${text.slice(0, 200)}`, lease_id: leaseIdLookup },
          { status: 502 },
        );
      }
      const leaseData = (await leaseRes.json()) as unknown;
      const leaseList = Array.isArray(leaseData)
        ? leaseData
        : (leaseData as { results?: unknown[] }).results ?? (leaseData as { data?: unknown[] }).data ?? [];
      const idStr = String(leaseIdLookup).trim();
      const match = leaseList.find((item: unknown) => {
        const raw = typeof item === "object" && item != null ? (item as Record<string, unknown>) : {};
        return getLeaseId(raw) === idStr;
      }) as Record<string, unknown> | undefined;
      if (!match) {
        return NextResponse.json({
          lease_id: leaseIdLookup,
          tenant_email: null,
          message: "Lease not found in lease-activity feed. It may be outside the date range or not yet synced.",
        });
      }
      const tenantEmail = getTenantEmail(match);
      const contractDate = getContractDate(match);
      return NextResponse.json({
        lease_id: leaseIdLookup,
        tenant_email: tenantEmail || null,
        contract_date: contractDate || null,
        raw_keys: Object.keys(match),
      });
    }

    // 1. Fetch rental opportunities (paginate; API does not filter by source, we filter in code)
    const oppList: unknown[] = [];
    let nextUrl: string | null = `${congdonUrl}/rental-opportunity?limit=500&ordering=-created_at`;
    let pageCount = 0;
    const maxPages = 10; // cap at 5000 items

    while (nextUrl && pageCount < maxPages) {
      const oppRes = await fetch(nextUrl, {
        headers: apiHeaders,
        cache: "no-store",
      });

      if (!oppRes.ok) {
        const text = await oppRes.text();
        let errorMsg = `Rental opportunity API: ${oppRes.status} ${text.slice(0, 200)}`;
        if (oppRes.status === 401) {
          errorMsg += ` Rental-opportunity requires JWT. Set CONGDON_COLEMAN_JWT. Obtain via: curl -X POST ${congdonUrl}/user-auth -H "Content-Type: application/json" -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD","user_type":"pm"}'`;
        }
        return NextResponse.json({ error: errorMsg, rows: [] }, { status: 502 });
      }

      const oppData = (await oppRes.json()) as unknown;
      const page =
        Array.isArray(oppData)
          ? oppData
          : (oppData as { results?: unknown[] }).results ?? (oppData as { data?: unknown[] }).data ?? [];
      oppList.push(...page);
      pageCount++;

      if (debug && pageCount === 1) {
        return NextResponse.json({
          debug: true,
          oppRawKeys: typeof oppData === "object" && oppData != null ? Object.keys(oppData as object) : [],
          oppListLength: oppList.length,
          firstItem: oppList[0] ?? null,
          nextUrl: (oppData as { next?: string })?.next ?? null,
          oppRaw: oppData,
        });
      }

      nextUrl = (oppData as { next?: string })?.next ?? null;
      if (page.length < 500) break;
    }

    // 2. Fetch lease-activity for Lease Status and Revenue
    const leaseUrl = new URL(`${congdonUrl}/lease-activity`);
    leaseUrl.searchParams.set("created_date_gte", fromStr);
    leaseUrl.searchParams.set("created_date_lte", toStr);
    leaseUrl.searchParams.set("limit", "2000");

    const leaseRes = await fetch(leaseUrl.toString(), {
      headers: apiHeaders,
      cache: "no-store",
    });

    type LeaseMatch = { contractDate: string; grossRent: number; leaseId: string };
    const leasesByEmail = new Map<string, LeaseMatch[]>();

    if (leaseRes.ok) {
      const leaseData = (await leaseRes.json()) as unknown;
      const leaseList = Array.isArray(leaseData)
        ? leaseData
        : (leaseData as { results?: unknown[] }).results ?? (leaseData as { data?: unknown[] }).data ?? [];

      for (const item of leaseList) {
        const raw = typeof item === "object" && item != null ? (item as Record<string, unknown>) : {};
        const email = getTenantEmail(raw);
        if (!email) continue;
        const contractDate = getContractDate(raw);
        if (!contractDate) continue;
        const grossRent = num(get(raw, "gross_rent", "grossRent") ?? get(raw, "rent"));
        const leaseId = getLeaseId(raw);

        const arr = leasesByEmail.get(email) ?? [];
        arr.push({ contractDate, grossRent, leaseId });
        leasesByEmail.set(email, arr);
      }
    }

    // 3. Build PPC leads rows
    const rows: PpcLeadRow[] = [];

    for (const item of oppList) {
      const raw = typeof item === "object" && item != null ? (item as Record<string, unknown>) : {};
      const contact = raw.contact as Record<string, unknown> | undefined;
      const email = str(contact?.email1 ?? contact?.email ?? raw.email ?? "");
      if (!email) continue;

      const createdAt = raw.created_at ?? raw.createdAt ?? raw.created;
      let dateStr = "";
      if (typeof createdAt === "string") dateStr = createdAt.slice(0, 10);
      else if (createdAt instanceof Date) dateStr = createdAt.toISOString().slice(0, 10);
      else if (createdAt != null) dateStr = String(createdAt).slice(0, 10);

      if (dateStr && (dateStr < fromStr || dateStr > toStr)) continue;

      const user = (raw.user ?? contact?.user) as Record<string, unknown> | undefined;
      let agent = str(user?.name ?? raw.agent_name ?? raw.agent);
      if (!agent && user) {
        const first = str(user.first_name ?? user.firstName);
        const last = str(user.last_name ?? user.lastName);
        agent = [first, last].filter(Boolean).join(" ") || "—";
      }
      if (!agent) agent = "—";

      const emailLower = email.toLowerCase();
      const leases = leasesByEmail.get(emailLower) ?? [];
      const oppDate = dateStr || "1970-01-01";
      const matchingLease = leases.find((l) => l.contractDate >= oppDate);
      const leaseStatus: "Booked" | "None" = matchingLease ? "Booked" : "None";
      const revenue = matchingLease?.grossRent ?? 0;
      const leaseId = matchingLease?.leaseId;

      const intentVal = get(raw, "intent", "request_type", "form_type", "campaign") ?? get(contact ?? {}, "intent", "request_type", "form_type");
      const intentStr = str(intentVal).toLowerCase();
      const callRequested =
        intentStr === "book_call" ||
        intentStr === "book-call" ||
        intentStr === "book call" ||
        intentStr === "call" ||
        intentStr === "call_request";

      const adultsVal =
        get(raw, "adults", "guest", "guests", "number_of_guests") ??
        get(contact ?? {}, "adults", "guest", "guests");
      const childrenVal =
        get(raw, "children", "kids", "number_of_children") ??
        get(contact ?? {}, "children", "kids");
      const comment = str(
        get(raw, "comment", "comments", "message", "notes", "description") ??
          get(contact ?? {}, "comment", "comments", "message", "notes"),
      );

      const adults =
        typeof adultsVal === "string" || typeof adultsVal === "number"
          ? adultsVal
          : undefined;
      const children =
        typeof childrenVal === "string" || typeof childrenVal === "number"
          ? childrenVal
          : undefined;

      rows.push({
        date: dateStr,
        email,
        agent: agent || "—",
        callRequested,
        leaseStatus,
        revenue,
        ...(leaseId && { leaseId }),
        ...(adults != null && adults !== "" && { adults }),
        ...(children != null && children !== "" && { children }),
        ...(comment !== "" && { comment }),
      });
    }

    rows.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      rows,
      fromDate: fromStr,
      toDate: toStr,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `PPC leads: ${msg}`, rows: [] },
      { status: 502 },
    );
  }
}
