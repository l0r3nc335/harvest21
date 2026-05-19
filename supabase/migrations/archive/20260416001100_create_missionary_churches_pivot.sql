-- ============================================================================
-- MISSIONARY_CHURCHES PIVOT TABLE
-- Many-to-many relationship: missionaries can have many churches,
-- churches can have many missionaries
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.missionary_churches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  missionary_id BIGINT NOT NULL,
  church_id BIGINT NOT NULL,

  -- Relationship type: supporting, sending, partner
  relationship_type text DEFAULT 'supporting'::text
    CHECK (relationship_type = ANY (ARRAY['sending'::text, 'supporting'::text, 'partner'::text])),

  -- Is this relationship active/visible?
  is_active boolean DEFAULT true,

  CONSTRAINT fk_missionary_churches_missionary
    FOREIGN KEY (missionary_id)
    REFERENCES public.missionaries(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_missionary_churches_church
    FOREIGN KEY (church_id)
    REFERENCES public.churches(id)
    ON DELETE CASCADE,

  CONSTRAINT unique_missionary_churches_pair
    UNIQUE (missionary_id, church_id)
);

-- Indexes for performance
CREATE INDEX idx_missionary_churches_missionary_id ON public.missionary_churches(missionary_id);
CREATE INDEX idx_missionary_churches_church_id ON public.missionary_churches(church_id);
CREATE INDEX idx_missionary_churches_relationship_type ON public.missionary_churches(relationship_type);

-- Enable RLS
ALTER TABLE public.missionary_churches ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Public read access (anyone can view relationships)
CREATE POLICY "Public read access for missionary churches"
  ON public.missionary_churches
  FOR SELECT
  TO public
  USING (true);

-- Missionaries can insert their own affiliations
CREATE POLICY "Missionaries can insert their own church affiliations"
  ON public.missionary_churches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.missionaries m
      WHERE m.id = missionary_id
        AND m.user_id = auth.uid()
    )
  );

-- Missionaries can delete their own affiliations
CREATE POLICY "Missionaries can delete their own church affiliations"
  ON public.missionary_churches
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.missionaries m
      WHERE m.id = missionary_id
        AND m.user_id = auth.uid()
    )
  );

-- Admins have full access
CREATE POLICY "Admins have full access to missionary churches"
  ON public.missionary_churches
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.user_id = auth.uid()
        AND u.role IN (1, 2)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.user_id = auth.uid()
        AND u.role IN (1, 2)
    )
  );

-- Migrate existing data from affiliated_churches (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'affiliated_churches'
  ) THEN
    INSERT INTO public.missionary_churches (missionary_id, church_id, relationship_type, is_active)
    SELECT missionary_id, church_id, 'supporting'::text, true
    FROM public.affiliated_churches
    ON CONFLICT (missionary_id, church_id) DO NOTHING;
  END IF;
END $$;

-- Migrate existing data from church_missionaries (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'church_missionaries'
  ) THEN
    INSERT INTO public.missionary_churches (missionary_id, church_id, relationship_type, is_active)
    SELECT missionary_id, church_id, COALESCE(relationship_type, 'supporting'), COALESCE(is_active, true)
    FROM public.church_missionaries
    ON CONFLICT (missionary_id, church_id) DO UPDATE SET
      relationship_type = EXCLUDED.relationship_type,
      is_active = EXCLUDED.is_active;
  END IF;
END $$;
