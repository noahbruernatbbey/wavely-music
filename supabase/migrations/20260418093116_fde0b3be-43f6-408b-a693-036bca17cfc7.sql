-- Add is_public flag to tracks
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_tracks_public ON public.tracks(is_public) WHERE is_public = true;

-- Allow public to view public tracks (in addition to owner-only existing policy)
DROP POLICY IF EXISTS "Public tracks viewable by all" ON public.tracks;
CREATE POLICY "Public tracks viewable by all"
ON public.tracks FOR SELECT
USING (is_public = true OR auth.uid() = user_id);

-- Drop the old owner-only SELECT policy since the new one supersedes it
DROP POLICY IF EXISTS "Users view own tracks" ON public.tracks;

-- Playlists table
CREATE TABLE IF NOT EXISTS public.playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Playlists viewable by owner or if public"
ON public.playlists FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Users insert own playlists"
ON public.playlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own playlists"
ON public.playlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own playlists"
ON public.playlists FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_playlists_updated_at
BEFORE UPDATE ON public.playlists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Playlist tracks join table
CREATE TABLE IF NOT EXISTS public.playlist_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(playlist_id, track_id)
);
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON public.playlist_tracks(playlist_id);

-- Helper: is user owner of the playlist
CREATE OR REPLACE FUNCTION public.is_playlist_owner(_playlist_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.playlists WHERE id = _playlist_id AND user_id = _user_id)
$$;

-- Helper: is playlist public
CREATE OR REPLACE FUNCTION public.is_playlist_public(_playlist_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_public FROM public.playlists WHERE id = _playlist_id), false)
$$;

CREATE POLICY "Playlist tracks viewable if playlist viewable"
ON public.playlist_tracks FOR SELECT
USING (public.is_playlist_owner(playlist_id, auth.uid()) OR public.is_playlist_public(playlist_id));

CREATE POLICY "Owners add tracks to own playlists"
ON public.playlist_tracks FOR INSERT
WITH CHECK (public.is_playlist_owner(playlist_id, auth.uid()));

CREATE POLICY "Owners update own playlist tracks"
ON public.playlist_tracks FOR UPDATE
USING (public.is_playlist_owner(playlist_id, auth.uid()));

CREATE POLICY "Owners remove tracks from own playlists"
ON public.playlist_tracks FOR DELETE
USING (public.is_playlist_owner(playlist_id, auth.uid()));

-- Avatars storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar images publicly readable"
ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
