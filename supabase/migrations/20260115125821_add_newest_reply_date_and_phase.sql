-- Add newest_reply_date for forward pagination (Phase 2)
-- and scrape_phase to track which phase we're in

ALTER TABLE reports
ADD COLUMN newest_reply_date timestamptz;

-- Phase can be 'backwards' (paginating through history) or 'forward' (monitoring new replies)
ALTER TABLE reports
ADD COLUMN scrape_phase text DEFAULT 'backwards';
