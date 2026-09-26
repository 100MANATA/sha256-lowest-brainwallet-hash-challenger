CREATE TABLE public.records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id text NOT NULL,
  input text NOT NULL,
  hash text NOT NULL,
  leading_zero_bits integer NOT NULL,
  attempts bigint NOT NULL DEFAULT 0,
  hash_rate double precision NOT NULL DEFAULT 0,
  username text NOT NULL DEFAULT 'Anonymous',
  verified boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT records_hash_format CHECK (hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT records_input_len CHECK (char_length(input) BETWEEN 1 AND 512),
  CONSTRAINT records_username_len CHECK (char_length(username) BETWEEN 1 AND 32),
  CONSTRAINT records_unique_entry UNIQUE (challenge_id, hash)
);

CREATE INDEX records_challenge_hash_idx ON public.records (challenge_id, hash ASC);
CREATE INDEX records_created_at_idx ON public.records (created_at DESC);

GRANT SELECT ON public.records TO anon;
GRANT SELECT ON public.records TO authenticated;
GRANT ALL ON public.records TO service_role;

ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view verified records"
  ON public.records FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.records;