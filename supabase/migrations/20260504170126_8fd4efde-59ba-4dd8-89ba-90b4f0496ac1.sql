-- Custom radio stations
CREATE TABLE public.custom_stations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  hls boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stations viewable by owner or if public"
ON public.custom_stations FOR SELECT
USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users insert own stations"
ON public.custom_stations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own stations"
ON public.custom_stations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own stations"
ON public.custom_stations FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_custom_stations_updated_at
BEFORE UPDATE ON public.custom_stations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_custom_stations_user ON public.custom_stations(user_id);
CREATE INDEX idx_custom_stations_public ON public.custom_stations(is_public) WHERE is_public = true;

-- Profile discoverability
ALTER TABLE public.profiles ADD COLUMN is_public boolean NOT NULL DEFAULT false;

-- Replace the existing public-read policy with one that respects is_public
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;

CREATE POLICY "Public profiles viewable by everyone"
ON public.profiles FOR SELECT
USING (is_public = true OR auth.uid() = user_id);
