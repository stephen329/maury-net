# Rentals KPI – Live Data Source (nrbe)

The Rentals KPI dashboard fields map to the **nrbe** Django backend as follows.

## API base

- **Booking API:** `https://<nrbe-host>/api/booking/`
- Current booking list: `GET /api/booking/booking/` — returns only bookings for the **logged-in user** (renter or PMO). Not suitable for an admin KPI view.

To support the Rentals KPI dashboard, nrbe should expose a dedicated endpoint (e.g. admin or internal) that returns booking-level KPI rows with the fields below.

---

## Field mapping (nrbe → Rentals KPI)

| Dashboard field      | nrbe source |
|----------------------|-------------|
| **Contract Data**    | `Booking.created` (or `checkInDateTime` / `checkOutDateTime`). Use for “contract date” or date range. |
| **Agent Name**       | `Booking.nrAgentId` → `NrAgent.firstname`, `NrAgent.lastname`. Display as `f"{firstname} {lastname}"`. |
| **Address**          | `Booking.nrPropertyId` → `NrProperty.streetAddress`. Optionally append `Neighborhood.neighborhood` (via `nrPropertyId.neighborhoodId`) for “Address, Nantucket”. |
| **Gross Rent**       | `Booking.rent` — “Rent after discount” (Decimal). |
| **Total Commission** | Not a single field. Derive from **booking_fees** where the fee type is commission (see below), or from payout/commission logic if nrbe adds one. |
| **Office Commission**| Same as total commission unless nrbe has a separate “office” vs “agent” split (e.g. in `PayoutParties` or fee types). |
| **Booking Fee**       | Sum of `Booking.booking_fees`: `BookingFee` rows linked to this booking. Each has `amount` and `propertyFeeId` → `PropertyFee.fee` (fee name, e.g. “Booking Fee”). Sum `BookingFee.amount` for fees that represent “booking fee”. |
| **Total Revenue**    | `Booking.totalAmount` — total booking amount (Decimal). |

---

## Relevant nrbe models

- **`bookings.Booking`**  
  - `checkInDateTime`, `checkOutDateTime`, `created`, `modified`  
  - `totalAmount`, `rent`, `serviceFee`, `otherFeesTotal`, `occupancyTax`  
  - `nrPropertyId` (FK → NrProperty), `nrAgentId` (FK → NrAgent), `nrPmoId`, `nrRenterId`

- **`bookings.BookingFee`**  
  - `bookingId` (FK → Booking), `propertyFeeId` (FK → PropertyFee), `amount`

- **`core.PropertyFee`**  
  - `propertyFeeId`, `fee` (name, e.g. “Booking Fee”, “Commission”)

- **`core.NrAgent`**  
  - `firstname`, `lastname`

- **`core.NrProperty`**  
  - `streetAddress`, `neighborhoodId` (FK → Neighborhood), `headline`

- **`core.NrPropertyFee`**  
  - Defines which fees apply to a property (method, value). Booking-level amounts are in `BookingFee`.

---

## Suggested nrbe endpoint for Rentals KPI

Add an endpoint that only **admin or internal** callers can use, for example:

- **URL:** `GET /api/booking/rentals-kpi/` or `GET /api/admin/rentals-kpi/`
- **Query params (optional):** `from_date`, `to_date` (filter by `Booking.checkInDateTime` or `Booking.created`)
- **Response:** List of objects with:
  - `contract_data` (date or range)
  - `agent_name`
  - `address`
  - `gross_rent`
  - `total_commission`
  - `office_commission`
  - `booking_fee`
  - `total_revenue`

Implementation outline in nrbe:

1. Filter `Booking` (e.g. exclude `DRAFT`, optional date filter).
2. `select_related("nrPropertyId", "nrPropertyId__neighborhoodId", "nrAgentId")`, `prefetch_related("booking_fees", "booking_fees__propertyFeeId")`.
3. For each booking, compute:
   - **Booking fee:** sum of `booking_fees` where `propertyFeeId.fee` indicates booking fee (or sum all if only one type).
   - **Commission:** if fee types distinguish “commission” vs “office commission”, sum by type; otherwise use a single commission field or leave as 0 until business rules are defined.
4. Return serialized list; protect with `IsAdminUser` or an API key used by maury-net.

---

## Summary

- **Contract Data, Agent Name, Address, Gross Rent, Total Revenue** map directly to `Booking` and related `NrAgent` / `NrProperty` (and optionally `Neighborhood`).
- **Booking Fee** = sum of `Booking.booking_fees` amounts (fee type names in `PropertyFee.fee`).
- **Total Commission / Office Commission** require business rules (which `PropertyFee` or payout logic represents agent vs office); once defined, they can be computed from the same booking and fee data.

Once the nrbe endpoint exists, point the maury-net Rentals KPI dashboard at it (e.g. `NEXT_PUBLIC_NRBE_API_URL` or an server-side env) and replace the placeholder data with the API response.
