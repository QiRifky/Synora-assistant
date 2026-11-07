CREATE TABLE public.user_preferences (
  user_id uuid PRIMARY KEY,
  magic_style text NOT NULL DEFAULT 'auto' CHECK (magic_style IN ('auto','punchier','friendly','professional','funny','inspiring','storytelling','emojis')),
  default_channel_id text CHECK (default_channel_id IS NULL OR length(default_channel_id) <= 100),
  time_zone text CHECK (time_zone IS NULL OR length(time_zone) <= 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own preferences select" ON public.user_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own preferences insert" ON public.user_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own preferences update" ON public.user_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own preferences delete" ON public.user_preferences FOR DELETE TO authenticated USING (auth.uid() = user_id);