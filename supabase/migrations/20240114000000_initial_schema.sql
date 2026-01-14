-- Create enum for report status
create type report_status as enum ('pending', 'scraping', 'completed', 'failed');

-- Profiles table (linked to auth.users)
create table profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    x_username text,
    x_id text,
    avatar_url text,
    x_access_token text,
    x_refresh_token text,
    x_token_expires_at timestamptz,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- Reports table (scraping jobs)
create table reports (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references profiles(id) on delete cascade not null,
    x_post_url text not null,
    conversation_id text not null,
    status report_status default 'pending' not null,
    reply_count int default 0 not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- Replies table (scraped data)
create table replies (
    id text primary key,
    report_id uuid references reports(id) on delete cascade not null,
    username text not null,
    x_user_id text,
    is_premium boolean default false,
    follower_count int default 0,
    text text not null,
    tweet_created_at timestamptz,
    created_at timestamptz default now() not null
);

-- Indexes for performance
create index replies_report_id_idx on replies(report_id);
create index reports_user_id_idx on reports(user_id);
create index reports_status_idx on reports(status);

-- Enable Row Level Security
alter table profiles enable row level security;
alter table reports enable row level security;
alter table replies enable row level security;

-- Profiles policies
create policy "Users can view own profile"
    on profiles for select
    using (auth.uid() = id);

create policy "Users can update own profile"
    on profiles for update
    using (auth.uid() = id);

create policy "Users can insert own profile"
    on profiles for insert
    with check (auth.uid() = id);

-- Reports policies
create policy "Users can view own reports"
    on reports for select
    using (auth.uid() = user_id);

create policy "Users can create own reports"
    on reports for insert
    with check (auth.uid() = user_id);

create policy "Users can update own reports"
    on reports for update
    using (auth.uid() = user_id);

create policy "Users can delete own reports"
    on reports for delete
    using (auth.uid() = user_id);

-- Replies policies (users can view replies for their own reports)
create policy "Users can view replies for own reports"
    on replies for select
    using (
        exists (
            select 1 from reports
            where reports.id = replies.report_id
            and reports.user_id = auth.uid()
        )
    );

-- Service role can insert replies (for Inngest worker)
create policy "Service role can insert replies"
    on replies for insert
    with check (true);

-- Enable realtime for replies table
alter publication supabase_realtime add table replies;
alter publication supabase_realtime add table reports;

-- Function to update updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger profiles_updated_at
    before update on profiles
    for each row execute function update_updated_at();

create trigger reports_updated_at
    before update on reports
    for each row execute function update_updated_at();
