BEGIN;

CREATE TABLE IF NOT EXISTS public.security_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  incident_id uuid,
  event_type text NOT NULL,
  path text,
  method text,
  user_id uuid,
  ip text,
  detail jsonb
);

CREATE INDEX IF NOT EXISTS security_events_occurred_at_idx
  ON public.security_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_events_event_type_idx
  ON public.security_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_events_incident_id_idx
  ON public.security_events (incident_id);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security_events_select_admin" ON public.security_events;
CREATE POLICY "security_events_select_admin"
  ON public.security_events FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No INSERT / UPDATE / DELETE policies: only service_role can write.

COMMIT;
