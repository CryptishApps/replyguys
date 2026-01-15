-- Report Activity Events
-- Creates an append-only activity log that the UI can subscribe to via Supabase Realtime.

-- Activity events for a report (append-only)
create table if not exists report_activity (
    id bigint generated always as identity primary key,
    report_id uuid references reports(id) on delete cascade not null,
    created_at timestamptz default now() not null,
    -- A stable key for grouping (e.g. "scrape", "filter", "evaluate", "summary")
    key text not null,
    -- A short, user-facing message (e.g. "Filtering out unhelpful replies")
    message text not null,
    -- Optional structured metadata (e.g. counts)
    meta jsonb
);

create index if not exists report_activity_report_id_created_at_idx
    on report_activity(report_id, created_at desc);

alter table report_activity enable row level security;

-- Users can view activity for their own reports
create policy "Users can view activity for own reports"
    on report_activity for select
    using (
        exists (
            select 1 from reports
            where reports.id = report_activity.report_id
            and reports.user_id = auth.uid()
        )
    );

-- Service role can insert activity (Inngest worker)
create policy "Service role can insert activity"
    on report_activity for insert
    with check (true);

-- Enable realtime for activity table
alter publication supabase_realtime add table report_activity;

