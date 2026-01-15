-- Add viral tweet tracking columns to reports table
alter table reports add column if not exists viral_tweet_id text;
alter table reports add column if not exists viral_tweet_status text default 'pending';

-- Add index for filtering by viral tweet status
create index if not exists reports_viral_tweet_status_idx on reports(viral_tweet_status);

-- Add comment for documentation
comment on column reports.viral_tweet_id is 'X tweet ID of the viral share post';
comment on column reports.viral_tweet_status is 'Status of viral tweet: pending, generating, posted, failed';
