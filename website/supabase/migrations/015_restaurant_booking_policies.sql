-- Per-restaurant booking policy configuration (docs/RESERVATIONS-PLAN.md P0 task 3).
-- Schema only in P0: the booking RPCs do not read this table yet (P1). Defaults
-- here reproduce today's behaviour exactly (auto-confirm, no lead/advance limits,
-- no hold-back) so nothing changes for the current public flow.

CREATE TABLE public.restaurant_booking_policies (
  restaurant_id UUID PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  auto_confirm BOOLEAN NOT NULL DEFAULT TRUE,
  require_phone BOOLEAN NOT NULL DEFAULT FALSE,
  require_email BOOLEAN NOT NULL DEFAULT TRUE,
  large_party_threshold SMALLINT NULL CHECK (large_party_threshold IS NULL OR large_party_threshold BETWEEN 1 AND 50),
  min_lead_minutes INTEGER NOT NULL DEFAULT 0 CHECK (min_lead_minutes >= 0),
  max_advance_days INTEGER NULL CHECK (max_advance_days IS NULL OR max_advance_days >= 0),
  last_seating_offset_minutes INTEGER NULL CHECK (last_seating_offset_minutes IS NULL OR last_seating_offset_minutes >= 0),
  online_holdback_pct SMALLINT NOT NULL DEFAULT 0 CHECK (online_holdback_pct BETWEEN 0 AND 100),
  cancellation_cutoff_minutes INTEGER NOT NULL DEFAULT 0 CHECK (cancellation_cutoff_minutes >= 0),
  reminder_offsets_minutes INTEGER[] NOT NULL DEFAULT '{1440,180}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER restaurant_booking_policies_updated_at
  BEFORE UPDATE ON public.restaurant_booking_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- One policy row per existing restaurant, all defaults (= current behaviour).
INSERT INTO public.restaurant_booking_policies (restaurant_id)
SELECT r.id FROM public.restaurants r
ON CONFLICT (restaurant_id) DO NOTHING;

-- New restaurants get a default policy row automatically.
CREATE OR REPLACE FUNCTION public.create_default_booking_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.restaurant_booking_policies (restaurant_id)
  VALUES (NEW.id)
  ON CONFLICT (restaurant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER restaurants_create_booking_policy
  AFTER INSERT ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.create_default_booking_policy();

-- Per-service cap on total covers booked into one slot. NULL = unlimited
-- (today's behaviour). Not enforced by any RPC yet (P1/P3).
ALTER TABLE public.restaurant_services
  ADD COLUMN IF NOT EXISTS max_covers_per_slot SMALLINT NULL
  CHECK (max_covers_per_slot IS NULL OR max_covers_per_slot > 0);

ALTER TABLE public.restaurant_booking_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage booking policies" ON public.restaurant_booking_policies
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()));
