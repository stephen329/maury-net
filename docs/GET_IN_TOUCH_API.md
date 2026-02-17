# Get-in-touch API (backend preferred lead data sourcing)

The backend expects lead/contact submissions via **POST** to the get-in-touch endpoint. No auth is required.

## Endpoint

- **URL:** `https://devapi.congdonandcoleman.com/get-in-touch`  
  (Override with `CONGDON_GET_IN_TOUCH_URL` in env if needed.)
- **Method:** POST  
- **Content-Type:** application/json  

## Payload (backend preferred)

| Field             | Type   | Example / notes                          |
|-------------------|--------|------------------------------------------|
| `phone`           | string | `"555-987-6543"`                         |
| `first_name`      | string | `"John"`                                 |
| `last_name`       | string | `"Doe"`                                  |
| `email`           | string | `"john.doe@example.com"`                 |
| `comment`         | string | `"Looking forward to our stay!"`         |
| `arrival_date`    | string | `"2026-03-15"` (YYYY-MM-DD)              |
| `departure_date`  | string | `"2026-03-20"` (YYYY-MM-DD)              |
| `guest`           | string | `"2"` (number of adults as string)       |
| `children`        | string | `"1"` (number of children as string)     |
| `contact_method`  | string | `"email"` \| `"phone"` \| `"text"`       |
| `source`          | string | e.g. `"unbounce"`, `"book.nantucketrentals.com"`, `"maury.net"` |

## Example (correct URL; no double `https://`)

```bash
curl -X POST "https://devapi.congdonandcoleman.com/get-in-touch" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "555-987-6543",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "comment": "Looking forward to our stay!",
    "arrival_date": "2026-03-15",
    "departure_date": "2026-03-20",
    "guest": "2",
    "children": "1",
    "contact_method": "email",
    "source": "unbounce"
  }'
```

## maury.net usage

- **Reading leads:** The admin PPC leads dashboard uses `CONGDON_API_URL` + `CONGDON_API_KEY` or `CONGDON_COLEMAN_JWT` to read from `rental-opportunity` and `lease-activity` (no get-in-touch involved).
- **Sending leads:** Optional. Set `CONGDON_GET_IN_TOUCH_URL` in Vercel if you want to override the default. The app’s `POST /api/get-in-touch` route forwards to this URL with the same payload shape so any form (e.g. contact or PPC) can use the backend’s preferred data sourcing.

## Vercel credentials summary

| Purpose              | Env vars                                      | Notes                                      |
|----------------------|-----------------------------------------------|--------------------------------------------|
| PPC leads dashboard  | `CONGDON_API_URL`, `CONGDON_API_KEY` or `CONGDON_COLEMAN_JWT` | Required for rental-opportunity (JWT) and lease-activity. |
| Submitting leads     | `CONGDON_GET_IN_TOUCH_URL` (optional)         | Default: `https://devapi.congdonandcoleman.com/get-in-touch`; no auth. |
