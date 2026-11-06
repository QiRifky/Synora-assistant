CREATE TABLE public.magic_caption_usage (
  user_id uuid NOT NULL,
  usage_date date NOT NULL,
  uses integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

GRANT ALL ON public.magic_caption_usage TO service_role;

ALTER TABLE public.magic_caption_usage ENABLE ROW LEVEL SECURITY;

-- Reserve one daily use for a user. Returns 'ok', 'busy' (another request in flight), or 'out' (daily limit reached).
CREATE OR REPLACE FUNCTION public.try_magic_caption_use(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uses integer;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended(p_user_id::text, 77)) THEN
    RETURN 'busy';
  END IF;
  INSERT INTO public.magic_caption_usage (user_id, usage_date, uses)
  VALUES (p_user_id, (now() AT TIME ZONE 'UTC')::date, 0)
  ON CONFLICT (user_id, usage_date) DO NOTHING;
  SELECT uses INTO v_uses FROM public.magic_caption_usage
  WHERE user_id = p_user_id AND usage_date = (now() AT TIME ZONE 'UTC')::date;
  IF v_uses >= 50 THEN
    RETURN 'out';
  END IF;
  UPDATE public.magic_caption_usage SET uses = uses + 1
  WHERE user_id = p_user_id AND usage_date = (now() AT TIME ZONE 'UTC')::date;
  RETURN 'ok';
END;
$$;

-- Give back a reserved use when the AI call fails, so only successful calls count.
CREATE OR REPLACE FUNCTION public.refund_magic_caption_use(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.magic_caption_usage SET uses = GREATEST(uses - 1, 0)
  WHERE user_id = p_user_id AND usage_date = (now() AT TIME ZONE 'UTC')::date;
END;
$$;

-- Remaining uses today (0..50).
CREATE OR REPLACE FUNCTION public.magic_caption_left(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 50 - COALESCE((
    SELECT uses FROM public.magic_caption_usage
    WHERE user_id = p_user_id AND usage_date = (now() AT TIME ZONE 'UTC')::date
  ), 0);
$$;

REVOKE ALL ON FUNCTION public.try_magic_caption_use(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_magic_caption_use(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.magic_caption_left(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_magic_caption_use(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_magic_caption_use(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.magic_caption_left(uuid) TO service_role;