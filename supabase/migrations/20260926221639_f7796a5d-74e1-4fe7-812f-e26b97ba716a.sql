DROP POLICY "Anyone can view verified records" ON public.records;
CREATE POLICY "Anyone can view verified records" ON public.records FOR SELECT TO anon, authenticated USING (verified = true);