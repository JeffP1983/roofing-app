ALTER TABLE takeoffs
  ADD COLUMN IF NOT EXISTS facet_count INTEGER,
  ADD COLUMN IF NOT EXISTS structure_complexity TEXT
    CHECK (structure_complexity IN ('simple', 'normal', 'complex'));
