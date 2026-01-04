-- Create notifications table for persistent alerts
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  shop_id uuid references public.shops(id) on delete cascade not null,
  type text check (type in ('expiry', 'stock', 'system', 'reminder')) not null,
  title text not null,
  message text,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.notifications enable row level security;

-- Policy: Users can only see notifications for their shop
create policy "Users can view their shop notifications"
on public.notifications for select
using (shop_id = (select shop_id from public.users where id = auth.uid()));

-- Policy: Insert via Service Role (N8N) or potentially trigger
create policy "Service Role can insert notifications"
on public.notifications for insert
with check (true);

-- Policy: Users can update (mark as read)
create policy "Users can update their shop notifications"
on public.notifications for update
using (shop_id = (select shop_id from public.users where id = auth.uid()));
