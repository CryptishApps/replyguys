-- Enable REPLICA IDENTITY FULL for realtime updates
-- This ensures UPDATE and DELETE events include the full row data

ALTER TABLE reports REPLICA IDENTITY FULL;
ALTER TABLE replies REPLICA IDENTITY FULL;
