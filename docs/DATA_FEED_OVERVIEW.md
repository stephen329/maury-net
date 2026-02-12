# How the Congdon & Coleman (CNC) Data Feed Operates

This document summarizes how the data feed works between **Congdon & Coleman (CNC)**, **nrbe** (Nantucket Rentals backend), and **cnc-odin** (property/calendar management UI), based on the code in those projects.

---

## 1. High-level flow

- **CNC → nrbe (inbound):** CNC pushes property data, availability (calendar), and rental rates into nrbe. nrbe is the system of record for listings and calendar.
- **nrbe → CNC (outbound):** When calendar or rates change in nrbe (e.g. from cnc-odin or from a booking), nrbe pushes those changes to CNC. When a CNC-managed booking is confirmed, nrbe pushes lease and payment data to CNC.

**cnc-odin** talks to **nrbe** only (via `NEXT_PUBLIC_API_BASE_URL`). It does not talk to CNC directly. So the “data feed” in practice is:

1. **CNC → nrbe** (import/sync into nrbe)
2. **nrbe ↔ cnc-odin** (users manage properties/calendar in Odin; changes go to nrbe)
3. **nrbe → CNC** (sync changes and lease/payment data back to CNC)

---

## 2. CNC → nrbe (inbound)

### 2.1 Property and calendar import (one-time or batch)

- **Endpoint:** `POST /api/admin/cnc-property-import/` (nrbe)
- **View:** `nrAdminDataSetup.views_dir.cnc_property_import.CNCPropertyImportViewSet.create`
- **Auth:** API key (`HasAPIKey`).
- **Payload:** A single JSON body with:
  - `listing_data`, `area_data`, `availability_data`, `rental_rate_data`
  - `images_data`, `requirement_data`, `bathroom_data`, `bedroom_data`, `bed_data`
  - Optional: `owner_data`, `custom_rules_data`, `seasonal_policy_data`, `agreement_addenda_data`
- **Behavior:** `import_cnc_property_data()` in `nrAdminDataSetup.helpers`:
  - Creates or skips `NrProperty` (with `listingId` like `cnc_{listing_id}`).
  - Creates `NrPropAvailableCalendar` rows from `availability_data` (from_date, to_date, type e.g. leased, renter name, rent amount, etc.).
  - Creates `NrPropRentalRate` from `rental_rate_data`.
  - If an availability row has `type == "leased"`, it enqueues `update_calendar_lease_task` to pull lease/sign file info later.
- **Source of this payload:** CNC (or a CNC-side job) sends this to nrbe; the exact CNC component that builds and POSTs it is not in the nrbe/cnc-odin repos.

### 2.2 Ongoing calendar and rate updates (sync from CNC into nrbe)

- **Calendar (availability):**  
  `POST /api/property/...` calendar import – handled by `NrPropAvailableCalendarImportViewSet` in `nrPropertyListing.views_dir.import_calendar_rate`.  
  Expects `action` (create/update or delete), and payload with listing/date/type etc. Protected by `HasAPIKey`. Creates/updates/deletes `NrPropAvailableCalendar` and can set `_skip_sync` to avoid re-pushing to CNC.

- **Rates:**  
  Rate import view in the same module uses `NrPropRentalRateImportViewSet`. Bulk rate data can be processed via `process_rates_imported_from_cnc()` in `core.cnc_sync_helpers` (updates `NrPropRentalRate` for a listing).

So: **inbound data feed** = CNC (or CNC pipeline) calling these nrbe admin/property APIs with API key; nrbe writes to `NrProperty`, `NrPropAvailableCalendar`, `NrPropRentalRate`, etc.

---

## 3. nrbe → CNC (outbound)

nrbe uses **settings** for CNC URLs and key (e.g. `CNC_LISTING_DATA_SYNC_URL`, `CNC_IMPORT_LEASE_URL`, `CNC_PAYMENT_PAYOUT_URL`, `CNC_API_KEY`). Outbound calls are made with `X-API-KEY` and JSON bodies.

### 3.1 Calendar and rate sync (nrbe → CNC)

- **Trigger:** When calendar or rate records are saved in nrbe (e.g. from cnc-odin or from an import), signal/task code calls helpers in `core.cnc_sync_helpers`:
  - **Calendar:** `trigger_calendar_sync(instance)`  
    Builds a payload (listing_id, from_date, to_date, type, renter_name, rent_amount, agreement_url, etc.) and enqueues `sync_changes_to_cnc_task` with `CNC_LISTING_DATA_SYNC_URL`.
  - **Rates:** `trigger_rental_rate_sync(instance)` or `sync_multiple_rates_to_cnc()`  
    Same idea: build rate payload, enqueue `sync_changes_to_cnc_task` to POST to `CNC_LISTING_DATA_SYNC_URL`.
- **Task:** `bookings.tasks.sync_changes_to_cnc_task(url, data, headers, log_id)`  
  Does a `requests.post` to the given URL; response is stored in `CncLogs`.

So: any **create/update of calendar or rates** in nrbe (from Odin or elsewhere) can trigger an outbound POST to CNC’s sync URL. DRAFT calendar entries and `_skip_sync` are skipped.

### 3.2 Lease data (booking confirmed) nrbe → CNC

- **Trigger:** When a **booking** is confirmed (DocuSign “completed”) and the booking’s PMO is the CNC PMO (`settings.CNC_PMO_EMAIL`), nrbe enqueues `send_lease_data_task(booking_id)` (see `bookings.tasks`).
- **Task:** `send_lease_data_task`:
  - Builds payload via `create_cnc_lease_data(booking_id)` in `bookings.helpers`: listing id, check-in/out, rent, tax, other_fee, tenant_data, payment_data, other_fees_data, agreement_url, etc.
  - POSTs to `settings.CNC_IMPORT_LEASE_URL` with `X-API-KEY`.
  - Logs request/response in `CncLogs`.

So: **lease data feed** = nrbe sends confirmed booking (lease) details to CNC’s lease import URL.

### 3.3 Payment / payout status nrbe → CNC

- **Trigger:** When a Stripe payment webhook is processed for a booking whose PMO is the CNC PMO, and `settings.SYNC_CNC_BOOKINGS` is True, nrbe enqueues `send_payment_payout_data_task` with payment/booking and status (e.g. Paid, Current, Past Due).
- **Task:** POSTs to `settings.CNC_PAYMENT_PAYOUT_URL` with the same API key; logs in `CncLogs`.

So: **payment/payout feed** = nrbe notifies CNC of payment status changes for CNC-managed bookings.

---

## 4. cnc-odin’s role

- **API:** cnc-odin uses `NEXT_PUBLIC_API_BASE_URL` (nrbe). It does **not** call any CNC URL directly.
- **Calendar:** `src/app/actions/calendar.ts` (and related UI) call nrbe endpoints such as:
  - `GET /property/rentalrate/...` for rates
  - `PATCH /listings/{propertyId}` to add/update/delete calendar availability and rental rates.
- So: users edit calendar and rates **in Odin**; Odin sends changes to **nrbe**; nrbe then syncs those changes **to CNC** via the outbound sync above. Odin does not “operate” the CNC feed itself—it operates nrbe, and nrbe operates the feed to CNC.

---

## 5. Where “live” booking/lease data for the Rentals KPI comes from

- **Lease/contract data** in nrbe comes from:
  1. **Bookings** created and confirmed in nrbe (DocuSign flow, etc.): `Booking` model, with `NrPropAvailableCalendar` rows linked via `bookingId` for the blocked dates.
  2. **CNC-sourced leases:** When CNC sends availability with `type == "leased"`, nrbe creates `NrPropAvailableCalendar` with that type and enqueues `update_calendar_lease_task` to attach lease/sign info; that does **not** create a `Booking` in nrbe. So:
     - **Rentals KPI “live data”** in the current maury-net dashboard is from **nrbe’s `Booking` table** (and related agent, property, fees).
     - Leases that exist **only** in CNC and are only reflected as “leased” calendar blocks in nrbe are **not** in the Booking table; they would need a separate report or an API from CNC to show as “contracts” in a KPI view.

So the **data feed** that populates the **Rentals KPI** dashboard (contract date, agent, address, gross rent, booking fee, total revenue) is **nrbe’s own booking and fee data**, not a separate “CNC feed” into the dashboard. The CNC feed (inbound) fills **properties and calendar/rates**; the **outbound** feed sends lease and payment data **to** CNC. The dashboard reads from nrbe’s bookings API (e.g. `/api/booking/rentals-kpi/`).

---

## 6. Summary table

| Direction   | What flows           | Where in nrbe / odin |
|------------|----------------------|-----------------------|
| CNC → nrbe | Property + calendar + rates (batch) | `POST /api/admin/cnc-property-import/`, `import_cnc_property_data` |
| CNC → nrbe | Calendar/rate updates (ongoing)     | `NrPropAvailableCalendarImportViewSet`, `NrPropRentalRateImportViewSet` (HasAPIKey) |
| nrbe → CNC | Calendar & rate changes             | `trigger_calendar_sync`, `trigger_rental_rate_sync` → `sync_changes_to_cnc_task` → `CNC_LISTING_DATA_SYNC_URL` |
| nrbe → CNC | Lease data (confirmed booking)      | `send_lease_data_task` → `CNC_IMPORT_LEASE_URL` |
| nrbe → CNC | Payment/payout status               | `send_payment_payout_data_task` → `CNC_PAYMENT_PAYOUT_URL` |
| cnc-odin   | All operations                       | Calls nrbe only (`NEXT_PUBLIC_API_BASE_URL`); no direct CNC calls |
