-- normalize_phone_e164 edge cases and the guest visit/no-show double-count
-- fix (020_guest_fixes.sql).
BEGIN;
SELECT plan(9);

SELECT is(
  public.normalize_phone_e164('+91', '098765 43210'),
  '+919876543210',
  'a single leading trunk 0 is stripped'
);

SELECT is(
  public.normalize_phone_e164('+91', '+91 98765 43210'),
  '+919876543210',
  'a country code typed into the phone field is not doubled up'
);

SELECT is(
  public.normalize_phone_e164('+91', '98765 43210'),
  '+919876543210',
  'a plain 10-digit number is unaffected'
);

-- Fixture for the double-count regression test.
INSERT INTO public.properties (id, name, slug, location, description)
VALUES ('80000000-0000-0000-0000-000000000001', 'Test Property', 'test-property-008', 'Here', 'Desc');
INSERT INTO public.restaurants (id, property_id, name, slug, description)
VALUES ('80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 'Test Resto', 'test-resto-008', 'Desc');
INSERT INTO public.guests (id, phone_e164, name)
VALUES ('80000000-0000-0000-0000-00000000000a', '+910000000008', 'Eve');
INSERT INTO public.reservations (id, restaurant_id, guest_name, date, time, party_size, status, source, guest_id)
VALUES ('80000000-0000-0000-0000-00000000000b', '80000000-0000-0000-0000-000000000002', 'Eve', CURRENT_DATE, '19:00', 2, 'confirmed', 'website', '80000000-0000-0000-0000-00000000000a');

UPDATE public.reservations SET status = 'seated' WHERE id = '80000000-0000-0000-0000-00000000000b';
UPDATE public.reservations SET status = 'completed' WHERE id = '80000000-0000-0000-0000-00000000000b';

SELECT is(
  (SELECT visit_count FROM public.guests WHERE id = '80000000-0000-0000-0000-00000000000a'),
  1,
  'the first transition into completed is counted'
);

-- Cycle back through seated and complete again (e.g. an admin correction).
UPDATE public.reservations SET status = 'seated' WHERE id = '80000000-0000-0000-0000-00000000000b';
UPDATE public.reservations SET status = 'completed' WHERE id = '80000000-0000-0000-0000-00000000000b';

SELECT is(
  (SELECT visit_count FROM public.guests WHERE id = '80000000-0000-0000-0000-00000000000a'),
  1,
  'completed -> seated -> completed again does not double-count'
);

-- A genuinely different reservation for the same guest still counts once more.
INSERT INTO public.reservations (id, restaurant_id, guest_name, date, time, party_size, status, source, guest_id)
VALUES ('80000000-0000-0000-0000-00000000000c', '80000000-0000-0000-0000-000000000002', 'Eve', CURRENT_DATE + 1, '19:00', 2, 'confirmed', 'website', '80000000-0000-0000-0000-00000000000a');
UPDATE public.reservations SET status = 'completed' WHERE id = '80000000-0000-0000-0000-00000000000c';

SELECT is(
  (SELECT visit_count FROM public.guests WHERE id = '80000000-0000-0000-0000-00000000000a'),
  2,
  'a different reservation reaching completed counts as a new visit'
);

-- The one-off merge step from 020 (re-run here against freshly-seeded
-- "pre-fix" data, since the real migration already ran once against an
-- empty database and has nothing left to merge).
INSERT INTO public.guests (id, phone_e164, name, visit_count, no_show_count, tags, created_at)
VALUES
  ('80000000-0000-0000-0000-0000000000d1', '+919876543211', 'Fay', 2, 0, ARRAY['vip'], NOW() - INTERVAL '2 days'),
  ('80000000-0000-0000-0000-0000000000d2', '+91919876543211', 'Fay D', 0, 1, ARRAY['loud'], NOW() - INTERVAL '1 day');
INSERT INTO public.reservations (id, restaurant_id, guest_name, date, time, party_size, status, source, guest_phone, guest_phone_code, guest_id, created_at)
VALUES
  ('80000000-0000-0000-0000-0000000000e1', '80000000-0000-0000-0000-000000000002', 'Fay', CURRENT_DATE, '19:00', 2, 'confirmed', 'website', '98765 43211', '+91', '80000000-0000-0000-0000-0000000000d1', NOW() - INTERVAL '2 days'),
  ('80000000-0000-0000-0000-0000000000e2', '80000000-0000-0000-0000-000000000002', 'Fay D', CURRENT_DATE, '20:00', 2, 'confirmed', 'website', '+91 98765 43211', '+91', '80000000-0000-0000-0000-0000000000d2', NOW() - INTERVAL '1 day');

DO $$
DECLARE
  v_group RECORD;
  v_member_id UUID;
  v_canonical_id UUID;
BEGIN
  CREATE TEMP TABLE guest_renormalized_test ON COMMIT DROP AS
  SELECT g.id AS guest_id, g.created_at,
         public.normalize_phone_e164(earliest.guest_phone_code, earliest.guest_phone) AS new_phone_e164
  FROM public.guests g
  JOIN LATERAL (
    SELECT r.guest_phone_code, r.guest_phone
    FROM public.reservations r
    WHERE r.guest_id = g.id
    ORDER BY r.created_at ASC
    LIMIT 1
  ) earliest ON TRUE
  WHERE g.id IN ('80000000-0000-0000-0000-0000000000d1', '80000000-0000-0000-0000-0000000000d2');

  FOR v_group IN
    SELECT new_phone_e164,
           (ARRAY_AGG(guest_id ORDER BY created_at ASC, guest_id ASC))[1] AS canonical_id,
           ARRAY_AGG(guest_id ORDER BY created_at ASC, guest_id ASC) AS member_ids
    FROM guest_renormalized_test
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
        tags = ARRAY(SELECT DISTINCT UNNEST(c.tags || d.tags))
      FROM public.guests d
      WHERE c.id = v_canonical_id AND d.id = v_member_id;
      DELETE FROM public.guests WHERE id = v_member_id;
    END LOOP;
  END LOOP;

  UPDATE public.guests g
  SET phone_e164 = gr.new_phone_e164
  FROM guest_renormalized_test gr
  WHERE g.id = gr.guest_id AND gr.new_phone_e164 IS NOT NULL AND g.phone_e164 IS DISTINCT FROM gr.new_phone_e164;
END;
$$;

SELECT is(
  (SELECT COUNT(*)::int FROM public.guests WHERE id IN ('80000000-0000-0000-0000-0000000000d1', '80000000-0000-0000-0000-0000000000d2')),
  1,
  'two guests that renormalise to the same phone are merged into one'
);

SELECT is(
  (SELECT visit_count + no_show_count FROM public.guests WHERE id = '80000000-0000-0000-0000-0000000000d1'),
  3,
  'merged guest counters are summed (2 visits + 1 no-show)'
);

SELECT is(
  (SELECT COUNT(DISTINCT guest_id)::int FROM public.reservations WHERE id IN ('80000000-0000-0000-0000-0000000000e1', '80000000-0000-0000-0000-0000000000e2')),
  1,
  'both reservations now point at the surviving (canonical) guest'
);

SELECT * FROM finish();
ROLLBACK;
