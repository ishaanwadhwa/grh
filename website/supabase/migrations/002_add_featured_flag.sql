-- Add featured flag to properties and restaurants
ALTER TABLE properties ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;

-- Set Jaipur property as featured by default
UPDATE properties SET featured = TRUE WHERE slug = 'jaipur';

-- Set both restaurants as featured by default
UPDATE restaurants SET featured = TRUE;
