import { NextResponse } from "next/server";

function hasStrPermitNumber(item: Record<string, unknown>): boolean {
  const getVal = (obj: Record<string, unknown>, snake: string, camel: string) => obj[snake] ?? obj[camel];
  const val = getVal(item, "short_term_rental_permit_number", "shortTermRentalPermitNumber");
  if (val == null) return false;
  if (typeof val === "string") return val.trim().toLowerCase() !== "null" && val.trim().length > 0;
  return true;
}

/** Active in Rentals United = rental_united_exclude does not equal "true" */
function isActiveInRentalsUnited(item: Record<string, unknown>): boolean {
  const getVal = (obj: Record<string, unknown>, snake: string, camel: string) => obj[snake] ?? obj[camel];
  let val = getVal(item, "rental_united_exclude", "rentalUnitedExclude");
  if (val == null) {
    const ru = getVal(item, "rental_united", "rentalUnited");
    if (ru && typeof ru === "object" && ru !== null) {
      val = getVal(ru as Record<string, unknown>, "exclude", "exclude");
    }
  }
  if (val == null) return true;
  if (typeof val === "string") return val.trim().toLowerCase() !== "true";
  if (typeof val === "boolean") return !val;
  return true;
}

function toListingsArray(val: unknown): Record<string, unknown>[] {
  if (Array.isArray(val)) {
    return val.map((i) => (typeof i === "object" && i != null ? (i as Record<string, unknown>) : {}));
  }
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return Object.values(val as Record<string, unknown>).map((i) =>
      typeof i === "object" && i != null ? (i as Record<string, unknown>) : {}
    );
  }
  return [];
}

function collectAllListingCandidates(obj: Record<string, unknown>, targetCount: number): Record<string, unknown>[] {
  const candidates: Record<string, unknown>[][] = [];
  const seen = new Set<unknown>();

  function scan(v: unknown): void {
    if (v == null || seen.has(v)) return;
    seen.add(v);
    const arr = toListingsArray(v);
    if (arr.length > 0) candidates.push(arr);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const child of Object.values(v as Record<string, unknown>)) scan(child);
    }
  }

  for (const v of Object.values(obj)) scan(v);
  const best = candidates.reduce((a, b) => (a.length >= b.length ? a : b), [] as Record<string, unknown>[]);
  if (targetCount > 0 && best.length < targetCount * 0.9) {
    const byTarget = candidates.find((c) => c.length >= targetCount * 0.9);
    return byTarget ?? best;
  }
  return best;
}

function normalizeToListings(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return toListingsArray(data);
  if (!data || typeof data !== "object") return [];

  const obj = data as Record<string, unknown>;
  const apiCount = typeof obj.count === "number" ? obj.count : typeof obj.total === "number" ? obj.total : 0;

  for (const key of ["results", "data", "listings", "items", "list", "records"]) {
    if (key in obj) {
      const arr = toListingsArray(obj[key]);
      if (arr.length > 0 && (apiCount === 0 || arr.length >= apiCount * 0.9)) return arr;
    }
  }

  const fromScan = collectAllListingCandidates(obj, apiCount);
  if (fromScan.length > 0) return fromScan;

  const values = Object.values(obj).filter((v) => v && typeof v === "object");
  if (values.length > 0) return values.map((i) => (i as Record<string, unknown>));
  return [];
}

function getNextPageUrl(obj: Record<string, unknown>, baseUrl: string): string | null {
  const get = (k: string) => obj[k];
  let next = get("next") ?? get("next_page") ?? get("nextPage");
  if (typeof next === "string" && next.trim()) {
    return next.startsWith("http") ? next : `${baseUrl.replace(/\/$/, "")}${next.startsWith("/") ? "" : "/"}${next}`;
  }
  const links = get("links") ?? get("pagination");
  if (links && typeof links === "object" && links !== null) {
    const l = links as Record<string, unknown>;
    next = l.next ?? l.next_page;
    if (typeof next === "string" && next.trim()) {
      return next.startsWith("http") ? next : `${baseUrl.replace(/\/$/, "")}${next.startsWith("/") ? "" : "/"}${next}`;
    }
  }
  return null;
}

export async function GET(request: Request) {
  const baseUrl = process.env.CONGDON_API_URL?.replace(/\/$/, "");
  const { searchParams } = new URL(request.url);
  const debug = searchParams.get("debug") === "1" || searchParams.get("debug") === "true";
  const apiKey = process.env.CONGDON_API_KEY;

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      {
        error: "CONGDON_API_URL and CONGDON_API_KEY must be set. See env.example.",
        ccRentalListings: 0,
        activeInRentalsUnited: 0,
        excluded: 0,
        withStrPermit: 0,
        strPermitPercent: 0,
      },
      { status: 503 }
    );
  }

  const baseListingsUrl = `${baseUrl}/listings-rentals-united`;
  const headers = { Accept: "application/json", "x-api-key": apiKey };

  try {
    const allListings: Record<string, unknown>[] = [];
    let fetchUrl: string | null = baseListingsUrl;
    let totalFromApi: number | null = null;
    let pageSize = 30;
    let pagesFetched = 0;
    let lastObj: Record<string, unknown> = {};

    while (fetchUrl) {
      pagesFetched++;
      const res = await fetch(fetchUrl, { headers, cache: "no-store" });

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          {
            error: `Congdon listings-rentals-united returned ${res.status}: ${text}`,
            ccRentalListings: 0,
            activeInRentalsUnited: 0,
            excluded: 0,
            withStrPermit: 0,
            strPermitPercent: 0,
          },
          { status: 502 }
        );
      }

      const data = await res.json();
      lastObj = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
      const obj = lastObj;
      const pageListings = normalizeToListings(data);

      if (totalFromApi == null) {
        totalFromApi = typeof obj.count === "number" ? obj.count : typeof obj.total === "number" ? obj.total : null;
      }
      if (pageListings.length > 0 && allListings.length === 0) {
        pageSize = pageListings.length;
      }

      allListings.push(...pageListings);

      const nextUrl = getNextPageUrl(obj, baseUrl);
      if (nextUrl) {
        fetchUrl = nextUrl;
      } else if (
        totalFromApi != null &&
        allListings.length < totalFromApi &&
        pageListings.length > 0 &&
        pagesFetched < 50
      ) {
        const sep = baseListingsUrl.includes("?") ? "&" : "?";
        const pageNum = Math.floor(allListings.length / pageSize) + 1;
        fetchUrl = `${baseListingsUrl}${sep}page=${pageNum}&per_page=${pageSize}`;
      } else if (pageListings.length === 0) {
        fetchUrl = null;
      } else {
        fetchUrl = null;
      }
    }

    const listings = allListings;
    const ccRentalListings = totalFromApi ?? listings.length;
    const activeInRentalsUnited = listings.filter(isActiveInRentalsUnited).length;
    const excluded = listings.length - activeInRentalsUnited;
    const withStrPermit = listings.filter(hasStrPermitNumber).length;
    const strPermitPercent =
      ccRentalListings > 0 ? Math.round((withStrPermit / ccRentalListings) * 1000) / 10 : 0;

    const body: {
      ccRentalListings: number;
      activeInRentalsUnited: number;
      excluded: number;
      withStrPermit: number;
      strPermitPercent: number;
      listings: Record<string, unknown>[];
      debug?: {
        topLevelKeys: string[];
        structureSummary: Record<string, string>;
        firstListingKeys: string[];
        sample: Record<string, unknown>;
        parsedCount: number;
        pagesFetched?: number;
      };
    } = { ccRentalListings, activeInRentalsUnited, excluded, withStrPermit, strPermitPercent, listings };

    if (debug) {
      const topLevelKeys = Object.keys(lastObj);
      const structureSummary: Record<string, string> = {};
      for (const k of topLevelKeys) {
        const v = lastObj[k];
        if (Array.isArray(v)) structureSummary[k] = `array[${v.length}]`;
        else if (v && typeof v === "object" && !Array.isArray(v)) structureSummary[k] = `object{${Object.keys(v as object).length} keys}`;
        else structureSummary[k] = String(typeof v);
      }
      const first = listings[0];
      body.debug = {
        topLevelKeys,
        structureSummary,
        firstListingKeys: first ? Object.keys(first) : [],
        sample: first ?? {},
        parsedCount: listings.length,
        pagesFetched,
      };
    }

    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        error: `Failed to fetch listings: ${message}`,
        ccRentalListings: 0,
        activeInRentalsUnited: 0,
        excluded: 0,
        withStrPermit: 0,
        strPermitPercent: 0,
      },
      { status: 502 }
    );
  }
}
