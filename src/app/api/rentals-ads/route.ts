import { NextResponse } from "next/server";

/** cost_micros / 1_000_000 = dollars */
const MICROS_TO_DOLLARS = 1_000_000;
const API_VERSION = "19";

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth token refresh failed: ${err}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("No access_token in response");
  return data.access_token;
}

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

  if (!clientId || !clientSecret || !developerToken || !refreshToken || !customerId) {
    return NextResponse.json(
      {
        error: "Google Ads API not configured. Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_CUSTOMER_ID.",
        totalSpend: 0,
        currencyCode: "USD",
        fromDate: null,
        toDate: null,
      },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const now = new Date();
  const toDate = toParam ? new Date(toParam) : now;
  const fromDate = fromParam
    ? new Date(fromParam)
    : new Date(now.getFullYear(), 0, 1);

  const fromStr = fromDate.toISOString().slice(0, 10);
  const toStr = toDate.toISOString().slice(0, 10);

  const customerIdClean = customerId.replace(/-/g, "");

  try {
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

    const url = `https://googleads.googleapis.com/v${API_VERSION}/customers/${customerIdClean}/googleAds:search`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "developer-token": developerToken,
      Authorization: `Bearer ${accessToken}`,
    };
    if (loginCustomerId) {
      headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");
    }

    const query = `SELECT metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${fromStr}' AND '${toStr}'`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        searchSettings: { returnSummaryRow: true },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      let hint = "";
      if (res.status === 403 && err.includes("USER_PERMISSION_DENIED")) {
        hint =
          " If your account is under a Manager (MCC), set GOOGLE_ADS_LOGIN_CUSTOMER_ID to your Manager account ID. See docs/GOOGLE_ADS_SETUP.md.";
      }
      throw new Error(`Google Ads API error: ${err}${hint}`);
    }

    const body = (await res.json()) as {
      results?: Array<{ metrics?: { costMicros?: string; cost_micros?: string } }>;
      summaryRow?: { metrics?: { costMicros?: string; cost_micros?: string } };
    };

    let totalMicros = 0;
    const summary = body?.summaryRow?.metrics;
    if (summary) {
      const m = summary.costMicros ?? summary.cost_micros ?? 0;
      totalMicros = Number(m);
    } else {
      const rows = body?.results ?? [];
      for (const row of rows) {
        const m = row?.metrics;
        const micros = m?.costMicros ?? m?.cost_micros ?? 0;
        totalMicros += Number(micros);
      }
    }

    const totalSpend = totalMicros / MICROS_TO_DOLLARS;

    return NextResponse.json({
      totalSpend: Math.round(totalSpend * 100) / 100,
      currencyCode: "USD",
      fromDate: fromStr,
      toDate: toStr,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        error: `Google Ads API error: ${message}`,
        totalSpend: 0,
        currencyCode: "USD",
        fromDate: fromStr,
        toDate: toStr,
      },
      { status: 502 }
    );
  }
}
