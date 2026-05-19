-- Create affiliated_churches junction table
CREATE TABLE IF NOT EXISTS public.affiliated_churches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  missionary_id BIGINT NOT NULL,
  church_id BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT fk_missionary
    FOREIGN KEY (missionary_id)
    REFERENCES public.missionaries(id)
    ON DELETE CASCADE,
    
  CONSTRAINT fk_church
    FOREIGN KEY (church_id)
    REFERENCES public.churches(id)
    ON DELETE CASCADE,
    
  CONSTRAINT unique_missionary_church
    UNIQUE (missionary_id, church_id)
);

-- Create indexes for performance
CREATE INDEX idx_affiliated_churches_missionary_id ON public.affiliated_churches(missionary_id);
CREATE INDEX idx_affiliated_churches_church_id ON public.affiliated_churches(church_id);
CREATE INDEX idx_affiliated_churches_created_at ON public.affiliated_churches(created_at);

-- Enable RLS
ALTER TABLE public.affiliated_churches ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public read access (anyone can view affiliations)
CREATE POLICY "Public read access for affiliated churches"
  ON public.affiliated_churches
  FOR SELECT
  TO public
  USING (true);

-- Missionaries can insert their own affiliations
CREATE POLICY "Missionaries can insert their own affiliations"
  ON public.affiliated_churches
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
CREATE POLICY "Missionaries can delete their own affiliations"
  ON public.affiliated_churches
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

-- Admins can do everything
CREATE POLICY "Admins have full access to affiliated churches"
  ON public.affiliated_churches
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

