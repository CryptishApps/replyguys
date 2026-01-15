-- Add last_reply_id for precise pagination using since_id
-- Keep last_reply_date for 24-hour timeout logic
ALTER TABLE reports ADD COLUMN IF NOT EXISTS last_reply_id text;

-- Index for efficient lookup
CREATE INDEX IF NOT EXISTS reports_last_reply_id_idx ON reports(last_reply_id) WHERE last_reply_id IS NOT NULL;
