-- Create table for storing AI Forecast History for charting
create table if not exists forecast_history (
    id uuid default gen_random_uuid() primary key,
    shop_id uuid references shops(id) not null,
    month_data jsonb not null, -- Stores array [{month: 'Jan', sales: 100, forecast: 110}]
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table forecast_history enable row level security;

-- Policies
create policy "Users can view their shop forecast"
    on forecast_history for select
    using (shop_id in (select id from shops where owner_id = auth.uid()));

create policy "Users can insert their shop forecast"
    on forecast_history for insert
    with check (shop_id in (select id from shops where owner_id = auth.uid()));

create policy "Users can update their shop forecast"
    on forecast_history for update
    using (shop_id in (select id from shops where owner_id = auth.uid()));
