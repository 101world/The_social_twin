-- audio_jobs table to track TTS/STT/merge tasks
create extension if not exists "pgcrypto";

create table if not exists public.audio_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  job_type text not null check (job_type in ('TTS','SoundEffectMerge','STT','STS','VoiceGeneration','SoundEffect')),
  input_text text,
  params jsonb default '{}'::jsonb,
  sound_effects jsonb default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  output_audio_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Optional: reference to auth.users (if enabled in your project)
-- alter table public.audio_jobs add constraint audio_jobs_user_fk foreign key (user_id) references auth.users(id) on delete cascade;

create index if not exists idx_audio_jobs_user_created on public.audio_jobs(user_id, created_at desc);

alter table public.audio_jobs enable row level security;

-- Policies: users can read their own jobs
do $$ begin
  if not exists (
    select 1 from pg_policies where polname = 'audio_jobs_select_own'
  ) then
    create policy audio_jobs_select_own on public.audio_jobs
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

-- Allow inserts/updates/deletes only to service role by default
-- (API routes should use the service role key for writes)
do $$ begin
  if not exists (
    select 1 from pg_policies where polname = 'audio_jobs_service_write'
  ) then
    create policy audio_jobs_service_write on public.audio_jobs
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- Trigger to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_audio_jobs_updated_at on public.audio_jobs;
create trigger trg_audio_jobs_updated_at
  before update on public.audio_jobs
  for each row execute function public.set_updated_at();
