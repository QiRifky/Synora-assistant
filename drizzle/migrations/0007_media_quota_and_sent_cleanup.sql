CREATE FUNCTION public.media_usage_bytes(p_user_id uuid) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM((o.metadata->>'size')::bigint), 0)::bigint
  FROM storage.objects o
  WHERE o.bucket_id = 'post-media' AND split_part(o.name, '/', 1) = p_user_id::text;
$$;
REVOKE ALL ON FUNCTION public.media_usage_bytes(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.media_usage_bytes(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.protect_media_save(p_user_id uuid, p_paths text[], p_operation text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(842617);
  IF public.media_usage_bytes(p_user_id) > 104857600 THEN RAISE EXCEPTION 'Storage quota exceeded'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_paths) p WHERE split_part(p,'/',1) <> p_user_id::text OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='post-media' AND o.name=p) OR EXISTS (SELECT 1 FROM public.media_cleanup_claims c WHERE c.path=p)) THEN RAISE EXCEPTION 'Media unavailable'; END IF;
  INSERT INTO public.media_references(user_id,path,buffer_id,kind) SELECT p_user_id,p,p_operation,'pending' FROM unnest(p_paths) p ON CONFLICT DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.protect_media_save(uuid,text[],text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_media_save(uuid,text[],text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_unused_media() RETURNS TABLE(path text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(842617);
  RETURN QUERY WITH candidates AS (
    SELECT o.name FROM storage.objects o
    WHERE o.bucket_id='post-media' AND (
      (o.created_at < now()-interval '24 hours' AND NOT EXISTS (SELECT 1 FROM public.media_references r WHERE r.path=o.name))
      OR (EXISTS (SELECT 1 FROM public.media_references r WHERE r.path=o.name AND r.kind='publish' AND r.created_at < now()-interval '7 days')
          AND NOT EXISTS (SELECT 1 FROM public.media_references r WHERE r.path=o.name AND (r.kind<>'publish' OR r.created_at >= now()-interval '7 days')))
    )
    ORDER BY o.created_at LIMIT 100
  ), claimed AS (
    INSERT INTO public.media_cleanup_claims(path) SELECT name FROM candidates
    ON CONFLICT ON CONSTRAINT media_cleanup_claims_pkey DO UPDATE SET claimed_at=now()
    RETURNING media_cleanup_claims.path
  ) SELECT claimed.path FROM claimed;
END; $$;
REVOKE ALL ON FUNCTION public.claim_unused_media() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_unused_media() TO service_role;

CREATE FUNCTION public.release_media_references(p_buffer_id text) RETURNS TABLE(path text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(842617);
  RETURN QUERY WITH removed AS (
    DELETE FROM public.media_references r WHERE r.buffer_id = p_buffer_id RETURNING r.path
  ), orphan AS (
    SELECT DISTINCT removed.path FROM removed
    WHERE NOT EXISTS (SELECT 1 FROM public.media_references r WHERE r.path = removed.path)
  ), claimed AS (
    INSERT INTO public.media_cleanup_claims(path) SELECT orphan.path FROM orphan
    ON CONFLICT ON CONSTRAINT media_cleanup_claims_pkey DO UPDATE SET claimed_at=now()
    RETURNING media_cleanup_claims.path
  ) SELECT claimed.path FROM claimed;
END; $$;
REVOKE ALL ON FUNCTION public.release_media_references(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_media_references(text) TO service_role;