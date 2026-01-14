-- AI-Powered Reply Evaluation System
-- Adds user context, evaluation metrics, and summary storage

-- Reports: user context + evaluation config + summary
ALTER TABLE reports ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS goal text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS persona text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS weights jsonb DEFAULT '{"actionability":25,"specificity":25,"originality":25,"constructiveness":25}';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS preset text DEFAULT 'balanced';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS qualified_count int DEFAULT 0;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS summary jsonb;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS summary_status text DEFAULT 'pending';

-- Add check constraint for summary_status
ALTER TABLE reports ADD CONSTRAINT reports_summary_status_check
    CHECK (summary_status IN ('pending', 'generating', 'completed', 'failed'));

-- Replies: detailed AI evaluation metrics
ALTER TABLE replies ADD COLUMN IF NOT EXISTS actionability int;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS specificity int;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS originality int;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS constructiveness int;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS weighted_score int;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE replies ADD COLUMN IF NOT EXISTS mini_summary text;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS to_be_included boolean DEFAULT false;

-- Index for finding qualified replies efficiently
CREATE INDEX IF NOT EXISTS replies_to_be_included_idx
    ON replies(report_id) WHERE to_be_included = true;

-- Index for finding reports ready for summary
CREATE INDEX IF NOT EXISTS reports_summary_pending_idx
    ON reports(summary_status) WHERE summary_status = 'pending';
