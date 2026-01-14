-- Enhanced Pipeline Migration
-- Adds support for original tweet fetching, threshold-based completion, and reply evaluation

-- Add new status value for initial setup phase
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'setting_up' BEFORE 'pending';

-- Reports: original tweet data + settings + threshold
ALTER TABLE reports ADD COLUMN IF NOT EXISTS original_tweet_text text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS original_author_username text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS original_author_avatar text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS min_length int DEFAULT 0;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS blue_only boolean DEFAULT false;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS min_followers int;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS last_reply_date timestamptz;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reply_threshold int DEFAULT 100;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS useful_count int DEFAULT 0;

-- Add constraint for reply_threshold max value
ALTER TABLE reports ADD CONSTRAINT reports_reply_threshold_max CHECK (reply_threshold <= 250);

-- Replies: evaluation status and author avatar
ALTER TABLE replies ADD COLUMN IF NOT EXISTS is_useful boolean;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS evaluation_status text DEFAULT 'pending';
ALTER TABLE replies ADD COLUMN IF NOT EXISTS author_avatar text;

-- Add check constraint for evaluation_status
ALTER TABLE replies ADD CONSTRAINT replies_evaluation_status_check
    CHECK (evaluation_status IN ('pending', 'evaluating', 'evaluated'));

-- Index for efficient recurring scrape queries (find active reports)
-- Note: Using text cast to avoid enum transaction limitation
CREATE INDEX IF NOT EXISTS reports_status_scraping_idx
    ON reports(status);

-- Index for finding pending replies to evaluate
CREATE INDEX IF NOT EXISTS replies_evaluation_pending_idx
    ON replies(evaluation_status)
    WHERE evaluation_status = 'pending';
