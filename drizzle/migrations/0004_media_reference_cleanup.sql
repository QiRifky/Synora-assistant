CREATE TABLE public.media_references (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 path text NOT NULL,
 buffer_id text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('draft','idea','queue','schedule','pending','legacy')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(path, buffer_id, kind)
);
GRANT ALL ON public.media_references TO service_role;
ALTER TABLE public.media_references ENABLE ROW LEVEL SECURITY;
CREATE INDEX media_references_path_idx ON public.media_references(path);
CREATE TABLE public.media_cleanup_claims (
 path text PRIMARY KEY,
 claimed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.media_cleanup_claims TO service_role;
ALTER TABLE public.media_cleanup_claims ENABLE ROW LEVEL SECURITY;
-- Existing uploads have unknown prior use: retain them rather than risk deleting saved media.
INSERT INTO public.media_references(user_id,path,buffer_id,kind)
SELECT split_part(name,'/',1)::uuid,name,'pre-cleanup','legacy'
FROM storage.objects WHERE bucket_id='post-media' AND split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
CREATE FUNCTION public.protect_media_save(p_user_id uuid, p_paths text[], p_operation text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(842617);
 IF EXISTS (SELECT 1 FROM unnest(p_paths) p WHERE split_part(p,'/',1) <> p_user_id::text OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='post-media' AND o.name=p) OR EXISTS (SELECT 1 FROM public.media_cleanup_claims c WHERE c.path=p)) THEN RAISE EXCEPTION 'Media unavailable'; END IF;
 INSERT INTO public.media_references(user_id,path,buffer_id,kind) SELECT p_user_id,p,p_operation,'pending' FROM unnest(p_paths) p ON CONFLICT DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.protect_media_save(uuid,text[],text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.protect_media_save(uuid,text[],text) TO service_role;
CREATE FUNCTION public.claim_unused_media() RETURNS TABLE(path text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(842617);
 RETURN QUERY WITH candidates AS (
 SELECT o.name FROM storage.objects o
 WHERE o.bucket_id='post-media' AND o.created_at < now()-interval '24 hours'
 AND NOT EXISTS (SELECT 1 FROM public.media_references r WHERE r.path=o.name)
 ORDER BY o.created_at LIMIT 100
 ), claimed AS (
 INSERT INTO public.media_cleanup_claims(path) SELECT name FROM candidates
 ON CONFLICT ON CONSTRAINT media_cleanup_claims_pkey DO UPDATE SET claimed_at=now()
 RETURNING media_cleanup_claims.path
 ) SELECT claimed.path FROM claimed;
END; $$;
REVOKE ALL ON FUNCTION public.claim_unused_media() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_unused_media() TO service_role;