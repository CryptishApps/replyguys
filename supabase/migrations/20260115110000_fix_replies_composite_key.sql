-- Fix: Change replies primary key from tweet_id to composite (tweet_id, report_id)
-- This allows the same tweet to be tracked in multiple reports

-- Step 1: Drop existing primary key constraint
ALTER TABLE replies DROP CONSTRAINT replies_pkey;

-- Step 2: Add composite primary key
ALTER TABLE replies ADD PRIMARY KEY (id, report_id);

-- Note: The existing index on report_id (replies_report_id_idx) remains useful
-- The composite primary key will be used for lookups by (id, report_id)
