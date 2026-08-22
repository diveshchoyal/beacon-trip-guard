-- 1. Circular geofence zones
ALTER TABLE public.geofence_zones
  ADD COLUMN IF NOT EXISTS center_lat double precision,
  ADD COLUMN IF NOT EXISTS center_lng double precision,
  ADD COLUMN IF NOT EXISTS radius_m integer;

DELETE FROM public.geofence_zones;
ALTER TABLE public.geofence_zones DROP COLUMN IF EXISTS polygon;
ALTER TABLE public.geofence_zones ALTER COLUMN risk_level SET DEFAULT 'safe';

INSERT INTO public.geofence_zones (name, risk_level, description, center_lat, center_lng, radius_m) VALUES
  ('Koyambedu', 'caution', 'Reports of public intoxication and loitering at night', 13.0694, 80.1958, 1200),
  ('Marina Beach', 'safe', 'Well-patrolled promenade with regular police presence', 13.0500, 80.2824, 1500),
  ('T Nagar', 'caution', 'Heavy crowding and pickpocketing during shopping hours', 13.0418, 80.2340, 1000);

ALTER TABLE public.geofence_zones
  ALTER COLUMN center_lat SET NOT NULL,
  ALTER COLUMN center_lng SET NOT NULL,
  ALTER COLUMN radius_m SET NOT NULL;

-- 2. Police stations (public reference data)
CREATE TABLE IF NOT EXISTS public.police_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.police_stations TO authenticated;
GRANT ALL ON public.police_stations TO service_role;
ALTER TABLE public.police_stations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "police stations readable" ON public.police_stations;
CREATE POLICY "police stations readable" ON public.police_stations
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.police_stations (name, lat, lng) VALUES
  ('Koyambedu Police Station', 13.0703, 80.1943),
  ('Marina / Anna Square Police Station', 13.0576, 80.2830),
  ('T Nagar Police Station', 13.0405, 80.2337),
  ('Egmore Police Station', 13.0781, 80.2609),
  ('Adyar Police Station', 13.0067, 80.2570),
  ('Guindy Police Station', 13.0067, 80.2206);

-- 3. Public signup always creates a tourist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.raw_user_meta_data ->> 'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'tourist')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;