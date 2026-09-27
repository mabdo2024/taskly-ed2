-- =============================================================
-- Taskly database schema (Supabase / PostgreSQL)
--
-- How to use: open your Supabase project -> SQL Editor -> New query,
-- paste this whole file, and click "Run".
-- =============================================================

-- 1. The tasks table -------------------------------------------------
create table if not exists public.tasks (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 2000),
  due_date    date,
  priority    text not null default 'medium'
              check (priority in ('low', 'medium', 'high')),
  is_complete boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Speeds up "get all tasks for this user"
create index if not exists tasks_user_id_idx on public.tasks (user_id);

-- 2. Keep updated_at current on every edit ----------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- 3. Let logged-in users reach the table through Supabase's API --------
-- (Supabase usually does this automatically; it is repeated here so the
-- script works on every project.)
grant select, insert, update, delete on public.tasks to authenticated;

-- 4. Row Level Security (RLS) -----------------------------------------
-- RLS makes the database itself enforce that users can only see and
-- change their OWN tasks, even though the public API key is in the
-- frontend code. Logged-out visitors can do nothing.
alter table public.tasks enable row level security;

drop policy if exists "Users can view their own tasks" on public.tasks;
create policy "Users can view their own tasks"
  on public.tasks for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own tasks" on public.tasks;
create policy "Users can create their own tasks"
  on public.tasks for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own tasks" on public.tasks;
create policy "Users can update their own tasks"
  on public.tasks for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own tasks" on public.tasks;
create policy "Users can delete their own tasks"
  on public.tasks for delete
  to authenticated
  using ((select auth.uid()) = user_id);
