-- Add oldest_reply_date to reports table for backwards pagination with until_time
-- (since_time doesn't work for conversation_id searches, but until_time does)

ALTER TABLE reports
ADD COLUMN oldest_reply_date timestamptz;

-- Drop last_reply_id since we're no longer using it for pagination
ALTER TABLE reports
DROP COLUMN IF EXISTS last_reply_id;

-- Drop the index if it exists
DROP INDEX IF EXISTS reports_last_reply_id_idx;
