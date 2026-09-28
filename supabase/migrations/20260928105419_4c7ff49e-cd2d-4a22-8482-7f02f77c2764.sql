DROP POLICY IF EXISTS "Anyone can view heartbeats" ON public.heartbeats;
DROP POLICY IF EXISTS "Anyone can send a heartbeat" ON public.heartbeats;
DROP POLICY IF EXISTS "Anyone can update a heartbeat" ON public.heartbeats;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.heartbeats FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.heartbeats FROM authenticated;