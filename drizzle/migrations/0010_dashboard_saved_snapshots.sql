CREATE TABLE public.dashboard_snapshots (
 user_id uuid PRIMARY KEY,
 buffer_account_id text NOT NULL,
 snapshot jsonb,
 updated_at timestamptz,
 cooldown_until timestamptz,
 refresh_id uuid,
 lock_until timestamptz
);
GRANT SELECT ON public.dashboard_snapshots TO authenticated;
GRANT ALL ON public.dashboard_snapshots TO service_role;
ALTER TABLE public.dashboard_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own dashboard snapshot" ON public.dashboard_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE FUNCTION public.claim_dashboard_refresh(p_user_id uuid, p_account_id text, p_refresh_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 INSERT INTO public.dashboard_snapshots(user_id, buffer_account_id) VALUES(p_user_id,p_account_id) ON CONFLICT(user_id) DO NOTHING;
 UPDATE public.dashboard_snapshots SET buffer_account_id=p_account_id, snapshot=NULL, updated_at=NULL, cooldown_until=NULL, refresh_id=NULL, lock_until=NULL WHERE user_id=p_user_id AND buffer_account_id<>p_account_id;
 UPDATE public.dashboard_snapshots SET refresh_id=p_refresh_id, lock_until=now()+interval '2 minutes' WHERE user_id=p_user_id AND (cooldown_until IS NULL OR cooldown_until<=now()) AND (lock_until IS NULL OR lock_until<=now());
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.claim_dashboard_refresh(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_dashboard_refresh(uuid,text,uuid) TO service_role;