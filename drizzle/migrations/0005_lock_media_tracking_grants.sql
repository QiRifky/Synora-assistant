REVOKE ALL ON public.media_references FROM anon, authenticated;
REVOKE ALL ON public.media_cleanup_claims FROM anon, authenticated;
GRANT ALL ON public.media_references TO service_role;
GRANT ALL ON public.media_cleanup_claims TO service_role;