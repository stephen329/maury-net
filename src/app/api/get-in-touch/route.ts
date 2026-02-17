import { NextRequest, NextResponse } from "next/server";

/** Backend preferred lead submission: POST to Congdon get-in-touch (no auth). */
const GET_IN_TOUCH_URL =
  process.env.CONGDON_GET_IN_TOUCH_URL || "https://devapi.congdonandcoleman.com/get-in-touch";

/** Payload shape expected by backend (see docs/GET_IN_TOUCH_API.md). */
type GetInTouchBody = {
  phone?: string;
  first_name: string;
  last_name: string;
  email: string;
  comment?: string;
  arrival_date?: string;
  departure_date?: string;
  guest?: string | number;
  children?: string | number;
  contact_method?: "email" | "phone" | "text";
  source?: string;
};

function str(val: unknown): string {
  if (val == null) return "";
  return String(val).trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const first_name = str(body.first_name);
    const last_name = str(body.last_name);
    const email = str(body.email);

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const payload: GetInTouchBody = {
      first_name: first_name || "—",
      last_name: last_name || "—",
      email,
      phone: str(body.phone),
      comment: str(body.comment),
      arrival_date: str(body.arrival_date) || undefined,
      departure_date: str(body.departure_date) || undefined,
      guest: body.guest != null ? String(body.guest) : undefined,
      children: body.children != null ? String(body.children) : undefined,
      contact_method: (body.contact_method === "phone" ? "phone" : body.contact_method === "text" ? "text" : "email") as GetInTouchBody["contact_method"],
      source: str(body.source) || "maury.net",
    };

    const res = await fetch(GET_IN_TOUCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("get-in-touch failed:", res.status, text);
      return NextResponse.json(
        { error: "Lead submission failed", details: text.slice(0, 200) },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("get-in-touch error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
