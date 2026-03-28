-- ============================================
-- GOOD ROOM HOUSE — Initial Database Schema
-- ============================================

-- Properties
CREATE TABLE properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  location TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  amenities TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  coordinates JSONB,
  map_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms
CREATE TABLE rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL,
  personality TEXT NOT NULL DEFAULT '',
  capacity INT NOT NULL DEFAULT 2,
  bed_type TEXT NOT NULL DEFAULT 'King',
  size TEXT NOT NULL DEFAULT '',
  amenities TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  base_price_per_night INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, slug)
);

-- Restaurants
CREATE TABLE restaurants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  cuisine TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  vibe TEXT NOT NULL DEFAULT '',
  hours TEXT NOT NULL DEFAULT '',
  images TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  date DATE,
  time TEXT,
  tag TEXT DEFAULT '',
  images TEXT[] DEFAULT '{}',
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id),
  property_id UUID REFERENCES properties(id),
  user_id UUID,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT DEFAULT '',
  guest_phone_code TEXT DEFAULT '+91',
  is_whatsapp BOOLEAN DEFAULT TRUE,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INT NOT NULL DEFAULT 1,
  total_amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'website',
  special_requests TEXT,
  payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reservations
CREATE TABLE reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  user_id UUID,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT DEFAULT '',
  guest_phone_code TEXT DEFAULT '+91',
  is_whatsapp BOOLEAN DEFAULT TRUE,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  party_size INT NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'confirmed',
  special_requests TEXT,
  source TEXT NOT NULL DEFAULT 'website',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin profiles
CREATE TABLE admin_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER restaurants_updated_at BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Row Level Security
-- ============================================

-- Properties: public read, admin write
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read properties" ON properties FOR SELECT USING (true);
CREATE POLICY "Admin insert properties" ON properties FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);
CREATE POLICY "Admin update properties" ON properties FOR UPDATE USING (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);
CREATE POLICY "Admin delete properties" ON properties FOR DELETE USING (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);

-- Rooms: public read active, admin write
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Admin insert rooms" ON rooms FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);
CREATE POLICY "Admin update rooms" ON rooms FOR UPDATE USING (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);
CREATE POLICY "Admin delete rooms" ON rooms FOR DELETE USING (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);

-- Restaurants: public read active, admin write
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active restaurants" ON restaurants FOR SELECT USING (true);
CREATE POLICY "Admin insert restaurants" ON restaurants FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);
CREATE POLICY "Admin update restaurants" ON restaurants FOR UPDATE USING (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);
CREATE POLICY "Admin delete restaurants" ON restaurants FOR DELETE USING (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);

-- Events: public read published, admin write
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published events" ON events FOR SELECT USING (true);
CREATE POLICY "Admin insert events" ON events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);
CREATE POLICY "Admin update events" ON events FOR UPDATE USING (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);
CREATE POLICY "Admin delete events" ON events FOR DELETE USING (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);

-- Bookings: anyone can insert (for public booking), admin can read all
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert bookings" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Users read own bookings" ON bookings FOR SELECT USING (true);
CREATE POLICY "Admin update bookings" ON bookings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);

-- Reservations: anyone can insert, admin can read all
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert reservations" ON reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "Users read reservations" ON reservations FOR SELECT USING (true);
CREATE POLICY "Admin update reservations" ON reservations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);

-- Admin profiles: only admins can read
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read profiles" ON admin_profiles FOR SELECT USING (
  id = auth.uid()
);
