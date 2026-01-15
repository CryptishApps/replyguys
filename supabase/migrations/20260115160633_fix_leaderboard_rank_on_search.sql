-- Fix leaderboard functions to maintain correct rank when searching
-- Rank should be calculated globally, THEN filtered by search

-- Drop functions first to ensure clean updates
DROP FUNCTION IF EXISTS get_top_repliers_total(int, int, text);
DROP FUNCTION IF EXISTS get_top_repliers_avg(int, int, text);
DROP FUNCTION IF EXISTS get_top_audiences(int, int, text);

-- 1. Top repliers by total score
CREATE OR REPLACE FUNCTION get_top_repliers_total(
    p_limit int DEFAULT 100,
    p_offset int DEFAULT 0,
    p_search text DEFAULT NULL
)
RETURNS TABLE (
    x_user_id text,
    username text,
    author_avatar text,
    is_premium boolean,
    follower_count int,
    total_score bigint,
    reply_count bigint,
    rank bigint
) AS $$
BEGIN
    RETURN QUERY
    WITH aggregated AS (
        SELECT
            r.x_user_id,
            (ARRAY_AGG(r.username ORDER BY r.created_at DESC))[1] AS username,
            (ARRAY_AGG(r.author_avatar ORDER BY r.created_at DESC))[1] AS author_avatar,
            MAX(r.is_premium::int)::boolean AS is_premium,
            MAX(r.follower_count) AS follower_count,
            SUM(r.weighted_score)::bigint AS total_score,
            COUNT(*)::bigint AS reply_count
        FROM replies r
        WHERE r.to_be_included = true
          AND r.weighted_score IS NOT NULL
          AND r.x_user_id IS NOT NULL
        GROUP BY r.x_user_id
    ),
    ranked AS (
        -- Calculate rank globally BEFORE any filtering
        SELECT
            aggregated.*,
            ROW_NUMBER() OVER (ORDER BY aggregated.total_score DESC)::bigint AS rank
        FROM aggregated
    )
    SELECT
        ranked.x_user_id,
        ranked.username,
        ranked.author_avatar,
        ranked.is_premium,
        ranked.follower_count,
        ranked.total_score,
        ranked.reply_count,
        ranked.rank
    FROM ranked
    WHERE (p_search IS NULL OR ranked.username ILIKE '%' || p_search || '%')
    ORDER BY ranked.rank
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Top repliers by average score
CREATE OR REPLACE FUNCTION get_top_repliers_avg(
    p_limit int DEFAULT 100,
    p_offset int DEFAULT 0,
    p_search text DEFAULT NULL
)
RETURNS TABLE (
    x_user_id text,
    username text,
    author_avatar text,
    is_premium boolean,
    follower_count int,
    avg_score numeric,
    reply_count bigint,
    rank bigint
) AS $$
BEGIN
    RETURN QUERY
    WITH aggregated AS (
        SELECT
            r.x_user_id,
            (ARRAY_AGG(r.username ORDER BY r.created_at DESC))[1] AS username,
            (ARRAY_AGG(r.author_avatar ORDER BY r.created_at DESC))[1] AS author_avatar,
            MAX(r.is_premium::int)::boolean AS is_premium,
            MAX(r.follower_count) AS follower_count,
            ROUND(AVG(r.weighted_score)::numeric, 1) AS avg_score,
            COUNT(*)::bigint AS reply_count
        FROM replies r
        WHERE r.to_be_included = true
          AND r.weighted_score IS NOT NULL
          AND r.x_user_id IS NOT NULL
        GROUP BY r.x_user_id
        HAVING COUNT(*) >= 1
    ),
    ranked AS (
        -- Calculate rank globally BEFORE any filtering
        SELECT
            aggregated.*,
            ROW_NUMBER() OVER (ORDER BY aggregated.avg_score DESC, aggregated.reply_count DESC)::bigint AS rank
        FROM aggregated
    )
    SELECT
        ranked.x_user_id,
        ranked.username,
        ranked.author_avatar,
        ranked.is_premium,
        ranked.follower_count,
        ranked.avg_score,
        ranked.reply_count,
        ranked.rank
    FROM ranked
    WHERE (p_search IS NULL OR ranked.username ILIKE '%' || p_search || '%')
    ORDER BY ranked.rank
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Top audiences by original poster
CREATE OR REPLACE FUNCTION get_top_audiences(
    p_limit int DEFAULT 100,
    p_offset int DEFAULT 0,
    p_search text DEFAULT NULL
)
RETURNS TABLE (
    op_username text,
    op_avatar text,
    avg_reply_score numeric,
    total_replies bigint,
    report_count bigint,
    rank bigint
) AS $$
BEGIN
    RETURN QUERY
    WITH op_stats AS (
        SELECT
            LOWER(rep.original_author_username) AS op_username_key,
            (ARRAY_AGG(rep.original_author_username ORDER BY rep.created_at DESC))[1] AS op_username,
            (ARRAY_AGG(rep.original_author_avatar ORDER BY rep.created_at DESC))[1] AS op_avatar,
            ROUND(AVG(r.weighted_score)::numeric, 1) AS avg_reply_score,
            COUNT(r.id)::bigint AS total_replies
        FROM reports rep
        INNER JOIN replies r ON r.report_id = rep.id
        WHERE r.to_be_included = true
          AND r.weighted_score IS NOT NULL
          AND rep.original_author_username IS NOT NULL
        GROUP BY LOWER(rep.original_author_username)
        HAVING COUNT(r.id) >= 1
    ),
    report_counts AS (
        SELECT
            LOWER(original_author_username) AS op_username_key,
            COUNT(id)::bigint AS report_count
        FROM reports
        WHERE original_author_username IS NOT NULL
          AND status = 'completed'
        GROUP BY LOWER(original_author_username)
    ),
    combined AS (
        SELECT
            s.op_username,
            s.op_avatar,
            s.avg_reply_score,
            s.total_replies,
            c.report_count
        FROM op_stats s
        JOIN report_counts c ON c.op_username_key = s.op_username_key
    ),
    ranked AS (
        -- Calculate rank globally BEFORE any filtering
        SELECT
            combined.*,
            ROW_NUMBER() OVER (ORDER BY combined.avg_reply_score DESC, combined.total_replies DESC)::bigint AS rank
        FROM combined
    )
    SELECT
        ranked.op_username,
        ranked.op_avatar,
        ranked.avg_reply_score,
        ranked.total_replies,
        ranked.report_count,
        ranked.rank
    FROM ranked
    WHERE (p_search IS NULL OR ranked.op_username ILIKE '%' || p_search || '%')
    ORDER BY ranked.rank
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_top_repliers_total TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_repliers_avg TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_audiences TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_repliers_total TO anon;
GRANT EXECUTE ON FUNCTION get_top_repliers_avg TO anon;
GRANT EXECUTE ON FUNCTION get_top_audiences TO anon;
