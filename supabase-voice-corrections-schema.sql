-- Voice corrections shared across users
create table if not exists public.voice_corrections (
  id uuid primary key default gen_random_uuid(),
  language text not null,
  from_text text not null,
  to_text text not null,
  usage_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists voice_corrections_language_from_idx
  on public.voice_corrections (language, from_text);

create or replace function public.set_voice_corrections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_voice_corrections_updated_at on public.voice_corrections;
create trigger trg_voice_corrections_updated_at
before update on public.voice_corrections
for each row execute procedure public.set_voice_corrections_updated_at();
