-- RunPod dynamic endpoint configuration
-- A simple singleton table keyed by scope='global' that holds active endpoint URLs.

create table if not exists runpod_config (
  scope text primary key default 'global',
  image_url text,
  image_modify_url text,
  text_url text,
  video_url text,
  updated_at timestamptz default now()
);

-- Seed a default row if empty; values remain null to fall back to envs
insert into runpod_config(scope)
  values ('global')
  on conflict (scope) do nothing;
