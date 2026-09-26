ALTER TABLE public.records ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX records_user_id_idx ON public.records(user_id);