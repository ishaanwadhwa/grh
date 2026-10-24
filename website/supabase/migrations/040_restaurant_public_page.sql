-- 040: numbered clear of main (at 023) and the planned P1B migrations (024-030). Only ADD COLUMN IF NOT EXISTS, safe to re-run; renumber to the next free number at merge time if needed.
-- Everything the restaurant's public page shows that was hardcoded in src/app/experiment/content.ts,
-- plus what the booking research asked for (a number to call, a policy line, how far ahead guests can book).
-- Party size limits already live per service (restaurant_services.max_party_size), so they're not repeated here.
-- `cuisine` doubles as the one-line "what it is" ("Old Italian bistro & wine bar"), `description` as the story line.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS area TEXT NOT NULL DEFAULT '',            -- "Pink City, Jaipur"
  ADD COLUMN IF NOT EXISTS tagline TEXT NOT NULL DEFAULT '',         -- the big line under the name
  ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '',         -- one line per line, as printed on the postcard
  ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '',           -- "Call" on the confirmation and for big parties
  ADD COLUMN IF NOT EXISTS directions_url TEXT,
  ADD COLUMN IF NOT EXISTS google_rating NUMERIC(2,1) CHECK (google_rating BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS google_reviews INTEGER CHECK (google_reviews >= 0),
  ADD COLUMN IF NOT EXISTS google_url TEXT,
  ADD COLUMN IF NOT EXISTS booking_days_ahead SMALLINT NOT NULL DEFAULT 14 CHECK (booking_days_ahead BETWEEN 1 AND 90),
  ADD COLUMN IF NOT EXISTS booking_note TEXT NOT NULL DEFAULT '',    -- policy line on the review step
  ADD COLUMN IF NOT EXISTS host_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS host_role TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS host_quote TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS host_photo_url TEXT;
