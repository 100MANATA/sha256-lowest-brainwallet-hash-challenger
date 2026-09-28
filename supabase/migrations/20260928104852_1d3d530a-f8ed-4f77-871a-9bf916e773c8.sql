CREATE TABLE public.heartbeats (
  session_id text PRIMARY KEY,
  username text NOT NULL DEFAULT 'Anonymous',
  hash_rate double precision NOT NULL DEFAULT 0,
  engine text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.heartbeats TO anon;
GRANT SELECT, INSERT, UPDATE ON public.heartbeats TO authenticated;
GRANT ALL ON public.heartbeats TO service_role;
ALTER TABLE public.heartbeats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view heartbeats" ON public.heartbeats FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can send a heartbeat" ON public.heartbeats FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update a heartbeat" ON public.heartbeats FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX heartbeats_updated_at_idx ON public.heartbeats (updated_at);