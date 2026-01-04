-- Create B2B Orders Table
create table if not exists public.b2b_orders (
    id uuid default gen_random_uuid() primary key,
    shop_id uuid references public.shops(id) on delete cascade not null,
    distributor_name text, -- Storing name for simplicity if distributor_id is complex to resolve from catalogs
    total_amount numeric not null default 0,
    status text not null default 'pending' check (status in ('pending', 'approved', 'shipped', 'cancelled')),
    items jsonb not null default '[]'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.b2b_orders enable row level security;

-- Policies
create policy "Enable read access for authenticated users"
on public.b2b_orders for select
to authenticated
using (true);

create policy "Enable insert access for authenticated users"
on public.b2b_orders for insert
to authenticated
with check (true);

create policy "Enable update access for authenticated users"
on public.b2b_orders for update
to authenticated
using (true);
