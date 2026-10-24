-- Small P0 fixes carried into P1A (docs/agent-briefs/P0-questions.md "Carried
-- into P1A"): phone normalisation edge cases, and double-counted guest visits.

-- 1. normalize_phone_e164: strip a single leading trunk '0' from the local
-- number, and don't prepend the country code again if the guest typed it
-- directly into the phone field (digits already start with the code and are
-- longer than a plain 10-digit local number).
CREATE OR REPLACE FUNCTION public.normalize_phone_e164(p_code TEXT, p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits TEXT;
  v_code_digits TEXT;
BEGIN
  v_digits := REGEXP_REPLACE(COALESCE(p_phone, ''), '\D', '', 'g');
  -- A single leading 0 is a trunk-prefix typo ("098765 43210"), not part of
  -- the number. Only strip one -- a number that's genuinely all zeros isn't
  -- a real phone number anyway.
  IF v_digits LIKE '0%' THEN
    v_digits := SUBSTRING(v_digits FROM 2);
  END IF;
  IF v_digits = '' THEN
    RETURN NULL;
  END IF;

  v_code_digits := REGEXP_REPLACE(COALESCE(NULLIF(BTRIM(p_code), ''), '91'), '\D', '', 'g');
  IF v_code_digits = '' THEN
    v_code_digits := '91';
  END IF;

  -- The guest sometimes types the country code straight into the phone field
  -- ("+91 98765 43210"). If the digits already start with the code and are
  -- longer than a plain local number, it's already complete -- don't double it up.
  IF LENGTH(v_digits) > 10 AND v_digits LIKE (v_code_digits || '%') THEN
    RETURN '+' || v_digits;
  END IF;

  RETURN '+' || v_code_digits || v_digits;
END;
$$;

-- Re-normalise every existing guest and merge any duplicates this exposes.
-- Guests don't store the raw (code, phone) pair, only the derived
-- phone_e164, so we go back to the earliest reservation that linked each
-- guest to recompute it. Guests with no linked reservation (shouldn't exist
-- in practice -- there's no admin UI that creates one directly) are left
-- untouched since there's no raw source to recompute from.
DO $$
DECLARE
  v_group RECORD;
  v_member_id UUID;
  v_canonical_id UUID;
BEGIN
  CREATE TEMP TABLE guest_renormalized ON COMMIT DROP AS
  SELECT g.id AS guest_id, g.created_at,
         public.normalize_phone_e164(earliest.guest_phone_code, earliest.guest_phone) AS new_phone_e164
  FROM public.guests g
  JOIN LATERAL (
    SELECT r.guest_phone_code, r.guest_phone
    FROM public.reservations r
    WHERE r.guest_id = g.id
    ORDER BY r.created_at ASC
    LIMIT 1
  ) earliest ON TRUE;

  FOR v_group IN
    SELECT new_phone_e164,
           (ARRAY_AGG(guest_id ORDER BY created_at ASC, guest_id ASC))[1] AS canonical_id,
           ARRAY_AGG(guest_id ORDER BY created_at ASC, guest_id ASC) AS member_ids
    FROM guest_renormalized
    WHERE new_phone_e164 IS NOT NULL
    GROUP BY new_phone_e164
    HAVING COUNT(*) > 1
  LOOP
    v_canonical_id := v_group.canonical_id;

    FOREACH v_member_id IN ARRAY v_group.member_ids LOOP
      CONTINUE WHEN v_member_id = v_canonical_id;

      UPDATE public.reservations SET guest_id = v_canonical_id WHERE guest_id = v_member_id;

      UPDATE public.guests c SET
        visit_count = c.visit_count + d.visit_count,
        no_show_count = c.no_show_count + d.no_show_count,
        tags = ARRAY(SELECT DISTINCT UNNEST(c.tags || d.tags)),
        whatsapp_opt_in = c.whatsapp_opt_in OR d.whatsapp_opt_in,
        name = COALESCE(NULLIF(BTRIM(c.name), ''), d.name),
        email = COALESCE(c.email, d.email),
        notes = NULLIF(BTRIM(CONCAT_WS(E'\n', NULLIF(c.notes, ''), NULLIF(d.notes, ''))), '')
      FROM public.guests d
      WHERE c.id = v_canonical_id AND d.id = v_member_id;

      DELETE FROM public.guests WHERE id = v_member_id;
    END LOOP;
  END LOOP;

  -- Apply the renormalised value to every surviving guest, including ones
  -- with no duplicates (e.g. just the leading-zero fix).
  UPDATE public.guests g
  SET phone_e164 = gr.new_phone_e164
  FROM guest_renormalized gr
  WHERE g.id = gr.guest_id
    AND gr.new_phone_e164 IS NOT NULL
    AND g.phone_e164 IS DISTINCT FROM gr.new_phone_e164;
END;
$$;

-- 2. track_guest_visit_counters: only count the FIRST time a reservation
-- reaches completed/no_show (e.g. completed -> seated -> completed, after an
-- admin correction, must not double-count). reservation_events is the
-- source of truth: 0 or 1 existing status_changed rows for this
-- (reservation_id, to_status) mean "first time" (this doesn't depend on
-- whether log_reservation_update_event's trigger has already inserted the
-- row for *this* transition when this trigger runs); 2+ means a repeat.
CREATE OR REPLACE FUNCTION public.track_guest_visit_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prior_count INTEGER;
BEGIN
  IF NEW.guest_id IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('completed', 'no_show') THEN
    SELECT COUNT(*) INTO v_prior_count
      FROM public.reservation_events
      WHERE reservation_id = NEW.id AND event_type = 'status_changed' AND to_status = NEW.status;

    IF v_prior_count <= 1 THEN
      IF NEW.status = 'completed' THEN
        UPDATE public.guests SET visit_count = visit_count + 1 WHERE id = NEW.guest_id;
      ELSE
        UPDATE public.guests SET no_show_count = no_show_count + 1 WHERE id = NEW.guest_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
