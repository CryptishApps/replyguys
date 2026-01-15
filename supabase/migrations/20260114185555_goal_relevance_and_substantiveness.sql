-- Replace originality with substantiveness, add goal_relevance
-- These changes support goal-anchored evaluation

-- Replies: Rename originality to substantiveness, add goal_relevance
ALTER TABLE replies RENAME COLUMN originality TO substantiveness;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS goal_relevance int;

-- Reports: Update default weights to use substantiveness instead of originality
ALTER TABLE reports 
    ALTER COLUMN weights SET DEFAULT '{"actionability":25,"specificity":25,"substantiveness":25,"constructiveness":25}';
