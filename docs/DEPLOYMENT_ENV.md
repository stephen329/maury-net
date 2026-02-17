# Environment Variables for Production (maury.net)

The Rentals KPI and Rentals Charts pages need live data. Configure **one** of these options in your hosting provider (Vercel, etc.):

## Option A: Congdon & Coleman API

Set these in your project's **Environment Variables**:

| Variable | Description | Example |
|----------|-------------|---------|
| `CONGDON_API_URL` | Base URL of the Congdon API (no trailing slash) | `https://api.congdonandcoleman.com` |
| `CONGDON_API_KEY` | API key for `x-api-key` header | `your-secret-key` |

The app will call `{CONGDON_API_URL}/lease-activity` with date filters.

**Lead submission (get-in-touch):** Optional. To override the default backend URL for submitting leads (e.g. contact/PPC forms), set:

| Variable | Description | Default |
|----------|-------------|---------|
| `CONGDON_GET_IN_TOUCH_URL` | Backend get-in-touch endpoint (no auth) | `https://devapi.congdonandcoleman.com/get-in-touch` |

See [GET_IN_TOUCH_API.md](./GET_IN_TOUCH_API.md) for the preferred payload format.

## Option B: NRBE Backend

If you use the nrbe Django backend instead:

| Variable | Description | Example |
|----------|-------------|---------|
| `NRBE_API_URL` | Base URL of the nrbe API (no trailing slash) | `https://nrbe.example.com` |

The app will call `{NRBE_API_URL}/api/booking/rentals-kpi/` with `from_date` and `to_date`.

---

## Vercel Setup

1. Go to your project → **Settings** → **Environment Variables**
2. Add `CONGDON_API_URL` and `CONGDON_API_KEY` (Option A), **or** `NRBE_API_URL` (Option B)
3. **Redeploy** so the new variables take effect

---

## Troubleshooting

- **"Neither Congdon nor NRBE is set"** → Add at least one of the options above
- **"Congdon lease-activity returned 401"** → Invalid or missing `CONGDON_API_KEY`
- **"nrbe returned 404"** → NRBE may not have the `/api/booking/rentals-kpi/` endpoint yet; use Congdon or add the endpoint to nrbe
