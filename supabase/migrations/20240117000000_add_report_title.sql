-- Add title column for AI-generated report titles
ALTER TABLE reports ADD COLUMN IF NOT EXISTS title text;
