alter table public.users
add column if not exists pending_email text null,
add column if not exists pending_email_code text null,
add column if not exists pending_email_expires_at timestamp with time zone null;
