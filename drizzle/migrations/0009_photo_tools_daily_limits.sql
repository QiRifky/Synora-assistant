CREATE TABLE public.photo_usage (
  user_id uuid NOT NULL,
  usage_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('caption', 'edit')),
  uses integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date, kind)
);

GRANT ALL ON public.photo_usage TO service_role;

ALTER TABLE public.photo_usage ENABLE ROW LEVEL SECURITY;

-- Reserve one daily use. Returns 'ok', 'busy' (request in flight), or 'out' (daily limit reached).
-- Limits: 'caption' (Photo to Post) 10 per day, 'edit' (Magic Photo) 5 per day.
CREATE OR REPLACE FUNCTION public.try_photo_use(p_user_id uuid, p_kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uses integer;
  v_limit integer;
BEGIN
  IF p_kind NOT IN ('caption', 'edit') THEN
    RETURN 'out';
  END IF;
  v_limit := CASE p_kind WHEN 'caption' THEN 10 ELSE 5 END;
  IF NOT pg_try_advisory_xact_lock(hashtextextended(p_user_id::text || p_kind, 78)) THEN
    RETURN 'busy';
  END IF;
  INSERT INTO public.photo_usage (user_id, usage_date, kind, uses)
  VALUES (p_user_id, (now() AT TIME ZONE 'UTC')::date, p_kind, 0)
  ON CONFLICT (user_id, usage_date, kind) DO NOTHING;
  SELECT uses INTO v_uses FROM public.photo_usage
  WHERE user_id = p_user_id AND usage_date = (now() AT TIME ZONE 'UTC')::date AND kind = p_kind;
  IF v_uses >= v_limit THEN
    RETURN 'out';
  END IF;
  UPDATE public.photo_usage SET uses = uses + 1
  WHERE user_id = p_user_id AND usage_date = (now() AT TIME ZONE 'UTC')::date AND kind = p_kind;
  RETURN 'ok';
END;
$$;

-- Give back a reserved use when the AI call fails, so only successful calls count.
CREATE OR REPLACE FUNCTION public.refund_photo_use(p_user_id uuid, p_kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.photo_usage SET uses = GREATEST(uses - 1, 0)
  WHERE user_id = p_user_id AND usage_date = (now() AT TIME ZONE 'UTC')::date AND kind = p_kind;
END;
$$;

-- Remaining uses today for a kind ('caption' out of 10, 'edit' out of 5).
CREATE OR REPLACE FUNCTION public.photo_usage_left(p_user_id uuid, p_kind text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (CASE p_kind WHEN 'caption' THEN 10 WHEN 'edit' THEN 5 ELSE 0 END) - COALESCE((
    SELECT uses FROM public.photo_usage
    WHERE user_id = p_user_id AND usage_date = (now() AT TIME ZONE 'UTC')::date AND kind = p_kind
  ), 0);
$$;

REVOKE ALL ON FUNCTION public.try_photo_use(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_photo_use(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.photo_usage_left(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_photo_use(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_photo_use(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.photo_usage_left(uuid, text) TO service_role;