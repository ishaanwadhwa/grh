-- Tables configured before the draft/bookable toggle was added should remain bookable.
UPDATE public.restaurant_tables
SET is_active = TRUE,
    updated_at = NOW()
WHERE is_active = FALSE;
