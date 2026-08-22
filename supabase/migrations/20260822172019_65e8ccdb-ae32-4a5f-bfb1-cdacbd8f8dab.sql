
CREATE TYPE public.app_role AS ENUM ('tourist','police');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  safety_score integer NOT NULL DEFAULT 85,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'police'));
CREATE POLICY "profiles select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'police'));
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'role',''),'tourist')::public.app_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.digital_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digital_id text NOT NULL UNIQUE,
  id_number text NOT NULL,
  destination text NOT NULL,
  trip_start date NOT NULL,
  trip_end date NOT NULL,
  emergency_contact text NOT NULL,
  qr_payload text NOT NULL,
  hash text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digital_ids TO authenticated;
GRANT ALL ON public.digital_ids TO service_role;
ALTER TABLE public.digital_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "digital_ids select" ON public.digital_ids FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'police'));
CREATE POLICY "digital_ids insert own" ON public.digital_ids FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.id_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digital_id text NOT NULL,
  action text NOT NULL,
  hash text NOT NULL,
  prev_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.id_ledger TO authenticated;
GRANT ALL ON public.id_ledger TO service_role;
ALTER TABLE public.id_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger select" ON public.id_ledger FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.digital_ids d WHERE d.digital_id = id_ledger.digital_id AND (d.user_id = auth.uid() OR public.has_role(auth.uid(),'police')))
);
CREATE POLICY "ledger insert" ON public.id_ledger FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.digital_ids d WHERE d.digital_id = id_ledger.digital_id AND d.user_id = auth.uid())
);

CREATE TABLE public.geofence_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  risk_level text NOT NULL DEFAULT 'low',
  description text,
  polygon jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.geofence_zones TO authenticated;
GRANT SELECT ON public.geofence_zones TO anon;
GRANT ALL ON public.geofence_zones TO service_role;
ALTER TABLE public.geofence_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones readable" ON public.geofence_zones FOR SELECT USING (true);

CREATE TABLE public.location_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.location_pings TO authenticated;
GRANT ALL ON public.location_pings TO service_role;
ALTER TABLE public.location_pings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pings select" ON public.location_pings FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'police'));
CREATE POLICY "pings insert own" ON public.location_pings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'sos',
  message text,
  lat double precision,
  lng double precision,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts select" ON public.alerts FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'police'));
CREATE POLICY "alerts insert own" ON public.alerts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alerts update police" ON public.alerts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'police')) WITH CHECK (public.has_role(auth.uid(),'police'));

CREATE TABLE public.efir_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid REFERENCES public.alerts(id) ON DELETE SET NULL,
  officer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tourist_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fir_number text NOT NULL UNIQUE,
  details text,
  status text NOT NULL DEFAULT 'filed',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.efir_records TO authenticated;
GRANT ALL ON public.efir_records TO service_role;
ALTER TABLE public.efir_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "efir select" ON public.efir_records FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'police') OR auth.uid() = tourist_id);
CREATE POLICY "efir insert police" ON public.efir_records FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'police'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.location_pings;

INSERT INTO public.geofence_zones (name, risk_level, description, polygon) VALUES
('Cherrapunji Falls Trail','high','Steep cliffs and flash flood risk','[[25.30,91.68],[25.30,91.75],[25.25,91.75],[25.25,91.68]]'::jsonb),
('Shillong City Centre','low','Well patrolled tourist area','[[25.59,91.86],[25.59,91.92],[25.55,91.92],[25.55,91.86]]'::jsonb),
('Umiam Lake North Bank','medium','Limited network coverage after dusk','[[25.68,91.88],[25.68,91.94],[25.64,91.94],[25.64,91.88]]'::jsonb);
