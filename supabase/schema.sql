-- Database schema for shlokdhavalpatel.com (Supabase / Postgres).
-- Safe to re-run. The anon/publishable key is public, so Row Level Security
-- below is what protects the data.
--
-- Owner = the one email allowed to read stats and sync Bible data.

-- ---------------------------------------------------------------------------
-- Bible reader: one row per signed-in user (settings + conversation)
-- ---------------------------------------------------------------------------
create table if not exists public.bible_state (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,  -- {ref, version, sizeIdx, recents}
  messages   jsonb not null default '[]'::jsonb,  -- chat history
  updated_at timestamptz not null default now()
);

alter table public.bible_state enable row level security;

drop policy if exists "owner reads own bible state"   on public.bible_state;
drop policy if exists "owner inserts own bible state" on public.bible_state;
drop policy if exists "owner updates own bible state" on public.bible_state;

create policy "owner reads own bible state" on public.bible_state
  for select to authenticated
  using (user_id = auth.uid() and (auth.jwt() ->> 'email') = 'shlokdhavalpatel@gmail.com');

create policy "owner inserts own bible state" on public.bible_state
  for insert to authenticated
  with check (user_id = auth.uid() and (auth.jwt() ->> 'email') = 'shlokdhavalpatel@gmail.com');

create policy "owner updates own bible state" on public.bible_state
  for update to authenticated
  using (user_id = auth.uid() and (auth.jwt() ->> 'email') = 'shlokdhavalpatel@gmail.com')
  with check (user_id = auth.uid() and (auth.jwt() ->> 'email') = 'shlokdhavalpatel@gmail.com');

revoke all on public.bible_state from anon;
grant select, insert, update on public.bible_state to authenticated;

-- ---------------------------------------------------------------------------
-- Silver Tongue: anonymous usage events (insert-only for visitors)
-- ---------------------------------------------------------------------------
create table if not exists public.course_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  visitor_id  uuid not null,                -- random id stored in the visitor's browser
  session_id  uuid not null,                -- new per page load
  event       text not null check (event in (
                'visit', 'gate_view', 'password_attempt', 'unlock',
                'onboard_done', 'identify', 'week_open', 'week_complete', 'leave')),
  detail      text check (char_length(detail) <= 40),   -- 'password' | 'backdoor' | week number | first name (onboard_done/identify)
  seconds     integer check (seconds between 0 and 86400),
  device      text check (device in ('mobile', 'desktop')),
  referrer    text check (char_length(referrer) <= 200)
);

create index if not exists course_events_created_at_idx on public.course_events (created_at);

alter table public.course_events enable row level security;

drop policy if exists "anyone can log an event" on public.course_events;
drop policy if exists "owner reads events"      on public.course_events;

create policy "anyone can log an event" on public.course_events
  for insert to anon, authenticated
  with check (true);

create policy "owner reads events" on public.course_events
  for select to authenticated
  using ((auth.jwt() ->> 'email') = 'shlokdhavalpatel@gmail.com');

revoke all on public.course_events from anon, authenticated;
grant insert on public.course_events to anon, authenticated;
grant select on public.course_events to authenticated;

-- Migration (Oct 2026): allow the 'identify' event (first name of returning visitors).
alter table public.course_events drop constraint if exists course_events_event_check;
alter table public.course_events add constraint course_events_event_check check (event in (
  'visit', 'gate_view', 'password_attempt', 'unlock',
  'onboard_done', 'identify', 'week_open', 'week_complete', 'leave'));

-- ---------------------------------------------------------------------------
-- Bible reader: usage events (insert-only for visitors, owner reads)
-- ---------------------------------------------------------------------------
create table if not exists public.bible_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  visitor_id  uuid not null,                -- shared with course_events (same browser id)
  session_id  text not null check (char_length(session_id) <= 40),
  event       text not null check (event in ('visit', 'onboard_done', 'identify', 'chapter_open', 'leave')),
  detail      text check (char_length(detail) <= 40),   -- first name, or a chapter ref like 'JHN.3'
  seconds     integer check (seconds between 0 and 86400),
  device      text check (device in ('mobile', 'desktop')),
  referrer    text check (char_length(referrer) <= 200)
);

create index if not exists bible_events_created_at_idx on public.bible_events (created_at);

alter table public.bible_events enable row level security;

drop policy if exists "anyone can log a bible event" on public.bible_events;
drop policy if exists "owner reads bible events"     on public.bible_events;

create policy "anyone can log a bible event" on public.bible_events
  for insert to anon, authenticated
  with check (true);

create policy "owner reads bible events" on public.bible_events
  for select to authenticated
  using ((auth.jwt() ->> 'email') = 'shlokdhavalpatel@gmail.com');

revoke all on public.bible_events from anon, authenticated;
grant insert on public.bible_events to anon, authenticated;
grant select on public.bible_events to authenticated;
