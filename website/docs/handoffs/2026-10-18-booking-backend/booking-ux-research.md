# Guest booking: research and decisions

Handoff from the backend/admin session to the UI session (design lead). 2026-10-18.

## Decisions the user has made

- **Ownership.** The UI session owns design direction and all public UI. The backend session owns `api/`, `admin/`, `lib/supabase/` and migrations.
- **Front page.**
  - Restaurant-first.
  - Restaurant switcher top-right: Angels & Searchers by default, Good Room the other choice.
  - Main CTAs are **Book a table** and **See menu**.
  - Social (Instagram) up front.
- **Simple booking.** No payment, no offers, no "booking options" (no "Regular table reservation" choice), no cover charge. Just book a table.
- **No seating or table choice.** Guests can mention preferences in the note. Staff assign tables in the floor view.
- **Feel.** As smooth as District's (Zomato) booking sheet. The user's screenshots aren't in the repo; they're described below.
- **Guest details.**
  - Name and phone (+91) are needed; email is optional.
  - **OTP on the phone number is optional**: built behind a switch, possibly off for v1.
- **Success page.** It tells the guest their booking details were sent on **WhatsApp or SMS**. The backend for sending does not exist yet. The copy must follow what was actually sent (see the contract below).
- **Still open with the user:**
  1. Whether name, phone and OTP come *before* guests/date/time (the user's first description) or *after* the time is picked (District/Zomato). Asked; will relay.
  2. Which messaging provider sends OTPs and confirmations.
  3. Menu format (structured dishes or uploaded menu pages).

## The District flow in the user's screenshots (BLR Brewing Co.)

1. **Guests.** The restaurant page opens a bottom sheet titled "Booking at {restaurant}", headed "Number of guests". Chips 1, 2, 3, 4, 5… scroll sideways. A tap moves straight on; there is no Next button.
2. **Date and time.** The same sheet grows.
   - The answered step collapses into a **"2 guests ▾" pill** at the top.
   - Under "Choose date and time", date tabs read Today/Sun, Tomorrow/Mon, 20 Oct/Tue and so on, with the active tab underlined.
   - Below the tabs is a 3-column grid of time chips. Only free times are shown.
3. **Chosen.**
   - A row of **pills, "2 guests ▾ · Today ▾ · Dinner ▾"**, sits on top. Each pill reopens its own picker, so the pills are the progress indicator.
   - The chosen time is highlighted in a sideways-scrolling row of slots.
   - A sticky **"Proceed to book"** button sits at the bottom.
   - *(Skip District's "Select an option" offer card and its cover charge.)*
4. **Review.** Date and time, location, guests, "Add a special request", and a policy row. *(Skip District's payment bar.)*

**What makes it feel smooth:**
- one sheet with no page loads
- each answer collapses into a pill
- only free times are shown
- big tap targets
- a single sticky main button

## What the research found

### Foodiv

- The phone screens on its reservation page ("Tables" with Indoor/Outdoor/Meeting/Smoking tabs, tables drawn with chairs, then "Cart") are a **dine-in ordering** concept: pick your table, then order food. They are not a reservation flow, and they look like a stock concept.
- Foodiv's Play Store and App Store apps are for **staff**: order accept/reject and table cards. The restaurant assigns tables; guests never pick one.
- From Foodiv on the guest side, take the clean, chunky, easy-to-tap look, not a table-picking step.

### Patterns across Zomato/District, Swiggy Dineout, OpenTable (Google Maps), Grab, Deliveroo, Tock, Beli and Resy

- **Order:** guests → date → time (free times only, grouped by service) → contact details → confirmed.
- **Party size first**, because it decides which slots are free.
- The first three choices **share one screen or sheet**, so free times update live.
- **Email** is optional or not asked at all (Cruet, True Flavor and Salt on Dribbble skip it).
- **Progress** is shown one of three ways:
  - collapsed answer pills (District)
  - a segmented bar with "Step 1 of 2" next to the back arrow (Ronas IT)
  - a "1/3" pill in the header (Bella Vista)
- **Large parties:** "9+? Call us" (Cruet) instead of a stepper going to 50.
- **Confirmation:** big date and time, booking reference, then Add to calendar, Directions, Call, See menu, Cancel. Also design a failure state ("That time just went. Pick another" and "Call us").
- **No mainstream consumer app lets guests choose an exact table on a map.** At most they offer an area (Resy's Indoor/Outdoor; OpenTable slots tagged SEAT/OUTDOOR).

### References

- District/Zomato booking flow: https://mobbin.com/flows/786683de-379e-4460-8e0f-994f73d34a7e
- Swiggy Dineout (guests chips, date strip, Breakfast/Lunch/Dinner slots on one screen): https://mobbin.com/screens/58b42b84-0995-4f65-b5c8-9eaa0534689f
- Google Maps × OpenTable (contact plus optional request, confirmation with Call/Directions): https://mobbin.com/flows/0d96c444-c82b-4655-984e-a1cc9ad5f4a8
- Grab review screen with name, phone and email (shows what *not* to require): https://mobbin.com/flows/781fe4f1-a471-4688-b940-36d532d2e822
- Resy seating sheet: https://mobbin.com/screens/7677aa85-4c6b-4c5d-ace9-b67e6e88efff
- Monte (minimal header, "Book a table" top-right): https://mobbin.com/sites/sections/664a16ca-816d-495d-b577-e08ce5c6f1a5
- re_ (Instagram handle as a pill): https://mobbin.com/sites/sections/d4fde753-6092-46be-b2e4-42a823db6181
- Cruet. Burgundy on warm off-white, the closest to the brand. Date strip with availability dots, "9+? call", sticky summary over Continue: https://dribbble.com/shots/27762583-Cruet-Restaurant-Table-Booking-App-for-Android
- Ronas IT. Segmented 3-bar progress plus "Step 1/3", serif headings: https://dribbble.com/shots/26153921-Restaurant-Reservation-Mobile-App-UI-Design
- Ronas IT "True Flavor". Mobile web: menu tabs, gallery, one-page form without email: https://dribbble.com/shots/26299880-Restaurant-Mobile-Website-Design-Concept
- Salt. "Find a table" pill top-right; Dinner/Lunch/Drinks menu tabs: https://dribbble.com/shots/27794741-Salt-Coastal-Kitchen-Menu-and-Table-Notes
- Bella Vista case study ("1/3" header, the button names the next step, copyable reference): https://www.behance.net/gallery/244339881/Restaurant-Booking-Form-UI-Design-UX-Case-Study
- Tablea case study (one-screen booking, failure state): https://www.behance.net/gallery/256803953/Tablea-Restaurant-Booking-App-UXUI-Case-Study

## Issues on today's site (the UI session said it will fix these)

- `/reserve` is one long dark form with very low-contrast placeholders (`text-inverse/20`).
- The guest limit is 12 in `InlineReservation` but 20 on `/reserve`.
- `/reserve` without `?restaurant=` dead-ends on "Please select a restaurant first."
- There is no menu data anywhere, so "See menu" needs a backend decision (open question 3).

## Backend contract

### Available now

- `GET /api/reservations/availability?restaurant=<slug>&date=YYYY-MM-DD&partySize=N`
  - Returns `{ slots: [{ service_id, service_name, slot_time }] }`.
  - `service_name` (for example "Lunch" or "Dinner") is enough to build the District-style "Dinner ▾" pill.
- `POST /api/reservations` with the body `{ restaurantSlug, serviceId, date, time, partySize, guestName, guestEmail?, guestPhone, guestPhoneCode = "+91", isWhatsApp, specialRequests? }`
  - Returns `201 { reservation: { id } }`.
  - `409` means that time was just taken. `404` means an unknown restaurant. `400` means invalid input.

### Optional-email patch (ready, not applied anywhere)

- **File:** `optional-email.patch`, next to this file (superseded by `main`'s `016`).
- **Apply** from the repo root:

  ```bash
  git apply website/docs/handoffs/2026-10-18-booking-backend/optional-email.patch
  ```

- **What changes:**
  - Email is optional. If one is given it must look like an email.
  - **A phone number or an email is required**, so every booking keeps a way to reach the guest.
  - An empty email is stored as `NULL`.
  - Nothing else in the contract changes.
- **Database:** `guest_email` has been nullable since migration 013. The patch only redefines `create_restaurant_reservation` in a new `014_optional_reservation_email.sql`. The function is copied from 005 with exactly two lines changed, and it keeps the same signature and grants.
- **Checked:**
  - `git apply --check` passes against the UI session's working copy.
  - `route.ts` type-checks.
  - The SQL has not been run (there is no local Postgres).
- **Must not** be applied to the live Supabase without the user's OK.

### Planned, pending the user's approval

- **OTP (behind a switch, default off).**
  - Endpoints to send and check a code.
  - When the switch is on, `POST /api/reservations` also needs proof the phone was verified.
- **Confirmation message.** After a booking succeeds, the backend sends WhatsApp first and falls back to SMS.
  - The response will gain `notified: "whatsapp" | "sms" | null`.
  - The success page should say "sent on WhatsApp/SMS" **only** when `notified` is set.
  - With `null`, use neutral copy ("You're booked. See you Saturday, 8:30").
- **What the user has to set up first:**
  - an account with the chosen provider
  - Indian **DLT** registration for SMS (sender ID plus templates)
  - an approved **WhatsApp Business** utility template

  Both approvals take days, which is why sending stays switchable.
