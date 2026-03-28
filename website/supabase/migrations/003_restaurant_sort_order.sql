-- Add sort_order to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- Set initial order based on creation time
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn FROM restaurants
)
UPDATE restaurants SET sort_order = ordered.rn FROM ordered WHERE restaurants.id = ordered.id;
