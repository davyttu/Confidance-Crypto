create table if not exists public.user_ui_preferences (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  analytics_year integer null,
  analytics_month text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint user_ui_preferences_pkey primary key (id),
  constraint user_ui_preferences_user_id_key unique (user_id)
);
