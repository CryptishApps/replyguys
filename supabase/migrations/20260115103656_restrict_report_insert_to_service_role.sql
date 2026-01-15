-- Remove direct user INSERT policy for reports
-- Report creation is now only allowed via server actions using the service role
-- This enforces rate limiting that users cannot bypass

DROP POLICY IF EXISTS "Users can create own reports" ON reports;
