COMMENT ON TABLE public.magic_caption_usage IS 'DEPRECATED: Magic Caption daily usage limit removed; table no longer read or written.';
COMMENT ON FUNCTION public.try_magic_caption_use(uuid) IS 'DEPRECATED: Magic Caption daily usage limit removed.';
COMMENT ON FUNCTION public.refund_magic_caption_use(uuid) IS 'DEPRECATED: Magic Caption daily usage limit removed.';
COMMENT ON FUNCTION public.magic_caption_left(uuid) IS 'DEPRECATED: Magic Caption daily usage limit removed.';
REVOKE ALL ON public.magic_caption_usage FROM service_role;
REVOKE EXECUTE ON FUNCTION public.try_magic_caption_use(uuid) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.refund_magic_caption_use(uuid) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.magic_caption_left(uuid) FROM service_role;