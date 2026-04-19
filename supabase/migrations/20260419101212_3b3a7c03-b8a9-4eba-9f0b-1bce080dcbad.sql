
-- 1) Add bio column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;

-- 2) Make audio + covers buckets private (avatars stay public)
UPDATE storage.buckets SET public = false WHERE id IN ('audio', 'covers');
UPDATE storage.buckets SET public = true WHERE id = 'avatars';

-- 3) Helper: is a given storage path referenced by a public track?
CREATE OR REPLACE FUNCTION public.is_track_file_public(_bucket text, _path text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tracks
    WHERE is_public = true
      AND ((_bucket = 'audio' AND audio_path = _path)
        OR (_bucket = 'covers' AND cover_path = _path))
  )
$$;

-- 4) Drop any existing overly-broad storage policies for these buckets
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT polname FROM pg_policy WHERE polrelid = 'storage.objects'::regclass LOOP
    -- drop only ones we created previously to avoid touching unrelated policies
    IF p.polname IN (
      'Audio public read','Covers public read','Audio owner all','Covers owner all',
      'Avatars public read','Avatars owner all','Avatar images are publicly accessible',
      'Users can upload their own avatar','Users can update their own avatar',
      'Public read audio','Public read covers'
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.polname);
    END IF;
  END LOOP;
END $$;

-- 5) AUDIO bucket policies (owner-only, plus read for public tracks)
CREATE POLICY "audio_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "audio_public_track_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'audio' AND public.is_track_file_public('audio', name));

-- 6) COVERS bucket policies (owner-only, plus read for public tracks)
CREATE POLICY "covers_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "covers_public_track_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'covers' AND public.is_track_file_public('covers', name));

-- 7) AVATARS bucket policies (public read, owner write)
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
