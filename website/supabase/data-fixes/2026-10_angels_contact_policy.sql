-- Angels & Searchers: phone required, email optional (owner decision, 2026-10;
-- matches the new booking UI). ONE-OFF DATA FIX applied to production at the
-- P1B + wave-1.0 go-live. Not a migration, so later admin edits aren't overwritten.
UPDATE public.restaurant_booking_policies p
SET require_phone = TRUE, require_email = FALSE
FROM public.restaurants r
WHERE r.id = p.restaurant_id AND r.slug = 'angels-and-searchers';
