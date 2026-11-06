CREATE TABLE public.oauth_states (
  state text PRIMARY KEY,
  code_verifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);
GRANT ALL ON public.oauth_states TO service_role;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.buffer_connections (
  buffer_account_id text PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.buffer_connections TO service_role;
ALTER TABLE public.buffer_connections ENABLE ROW LEVEL SECURITY;