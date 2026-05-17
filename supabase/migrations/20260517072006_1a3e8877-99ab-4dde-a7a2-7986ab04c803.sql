CREATE TABLE IF NOT EXISTS public.user_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select" ON public.user_state FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert" ON public.user_state FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update" ON public.user_state FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_delete" ON public.user_state FOR DELETE USING (auth.uid() = user_id);