-- Angels & Searchers: real table capacities from the owner (2026-10).
-- ONE-OFF DATA FIX, applied manually to production on 2026-10 (not a migration,
-- so it never re-runs and overwrites later edits made in the admin UI).
-- Data-only and idempotent. Matches by restaurant slug + table label on the
-- active floor plan, so it does nothing on databases without this restaurant.
--
-- Decisions recorded in docs/RESERVATIONS-PLAN.md (P3 notes):
--   * T4, T5, T6, T11 are "4/5": stored as 4 (online max); staff seating 5 needs P3 staff max.
--   * T8, T9 are booked whole (3-4); splitting into a/b halves (1-2) is a P3 item.
--   * T13 was not on the owner's list; treated as a twin of T12 (2-4).
--   * T15 becomes a wine store and is removed from availability.
--   * Joined T1+T2 (8-14) and T6+T11 (7-9) need table combinations (P3).

WITH caps(label, min_capacity, max_capacity, is_active) AS (
  VALUES
    ('T1',  4, 6, TRUE),
    ('T2',  4, 6, TRUE),
    ('T3',  4, 4, TRUE),
    ('T4',  3, 4, TRUE),
    ('T5',  3, 4, TRUE),
    ('T6',  3, 4, TRUE),
    ('T7',  1, 2, TRUE),
    ('T8',  3, 4, TRUE),
    ('T9',  3, 4, TRUE),
    ('T10', 1, 2, TRUE),
    ('T11', 3, 4, TRUE),
    ('T12', 2, 4, TRUE),
    ('T13', 2, 4, TRUE),
    ('T14', 2, 4, TRUE),
    ('T15', 1, 2, FALSE),
    ('T16', 1, 2, TRUE)
)
UPDATE public.restaurant_tables t
SET min_capacity = caps.min_capacity,
    max_capacity = caps.max_capacity,
    is_active    = caps.is_active,
    zone         = CASE WHEN caps.label = 'T15' THEN 'Wine store' ELSE t.zone END,
    updated_at   = NOW()
FROM caps,
     public.restaurants r,
     public.restaurant_floorplans f
WHERE r.slug = 'angels-and-searchers'
  AND f.restaurant_id = r.id
  AND f.is_active = TRUE
  AND t.floorplan_id = f.id
  AND t.label = caps.label;
