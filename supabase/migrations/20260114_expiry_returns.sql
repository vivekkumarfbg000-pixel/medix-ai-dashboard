-- Create Purchase Returns Table (Header)
create table if not exists purchase_returns (
  id uuid default gen_random_uuid() primary key,
  shop_id uuid references user_shops(id) not null,
  supplier_id uuid references suppliers(id), -- Optional, text name fallback
  supplier_name text,
  return_date timestamp with time zone default now(),
  status text default 'draft', -- draft, sent, refunded
  total_estimated_value numeric default 0,
  created_at timestamp with time zone default now()
);

-- Create Purchase Return Items (Line Items)
create table if not exists purchase_return_items (
  id uuid default gen_random_uuid() primary key,
  return_id uuid references purchase_returns(id) on delete cascade,
  inventory_id uuid references inventory(id),
  medicine_name text,
  batch_number text,
  quantity integer,
  purchase_price numeric,
  reason text, -- 'expired', 'damaged', 'excess'
  created_at timestamp with time zone default now()
);

-- RLS Policies
alter table purchase_returns enable row level security;
alter table purchase_return_items enable row level security;

create policy "Users can view their own returns"
  on purchase_returns for select
  using (shop_id in (select shop_id from user_roles where user_id = auth.uid()));

create policy "Users can insert their own returns"
  on purchase_returns for insert
  with check (shop_id in (select shop_id from user_roles where user_id = auth.uid()));

create policy "Users can update their own returns"
  on purchase_returns for update
  using (shop_id in (select shop_id from user_roles where user_id = auth.uid()));

create policy "Users can view return items"
  on purchase_return_items for select
  using (return_id in (select id from purchase_returns where shop_id in (select shop_id from user_roles where user_id = auth.uid())));

create policy "Users can insert return items"
  on purchase_return_items for insert
  with check (return_id in (select id from purchase_returns where shop_id in (select shop_id from user_roles where user_id = auth.uid())));
