-- Play counts table
CREATE TABLE public.play_counts (
  track_id uuid PRIMARY KEY,
  count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.play_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Play counts viewable by everyone"
ON public.play_counts FOR SELECT
USING (true);

-- Secure increment function (SECURITY DEFINER bypasses RLS for the upsert)
CREATE OR REPLACE FUNCTION public.increment_play_count(_track_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only count plays for tracks that exist and are public (or owned by caller)
  IF NOT EXISTS (
    SELECT 1 FROM public.tracks
    WHERE id = _track_id
      AND (is_public = true OR user_id = auth.uid())
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.play_counts (track_id, count, updated_at)
  VALUES (_track_id, 1, now())
  ON CONFLICT (track_id)
  DO UPDATE SET count = play_counts.count + 1, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_play_count(uuid) TO anon, authenticated;