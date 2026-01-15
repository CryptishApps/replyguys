-- Atomically increment qualified_count and return the new value
-- This prevents race conditions when multiple evaluations complete simultaneously
CREATE OR REPLACE FUNCTION increment_qualified_count(report_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    new_count integer;
BEGIN
    UPDATE reports
    SET qualified_count = COALESCE(qualified_count, 0) + 1
    WHERE id = report_id
    RETURNING qualified_count INTO new_count;
    
    RETURN new_count;
END;
$$;
