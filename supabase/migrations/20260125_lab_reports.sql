create table if not exists lab_reports (
  id uuid default gen_random_uuid() primary key,
  shop_id uuid references shops(id) not null,
  patient_id uuid references customers(id),
  patient_name text,
  report_date timestamp with time zone default now(),
  summary_json jsonb,     -- The AI generated summary
  biomarkers_json jsonb,  -- The extracted values
  file_path text,         -- Path to storage if we save the file
  created_at timestamp with time zone default now()
);

-- RLS Policies
alter table lab_reports enable row level security;

create policy "Users can view reports for their shop"
  on lab_reports for select
  using (shop_id = (select shop_id from user_shops where user_id = auth.uid() limit 1));

create policy "Users can insert reports for their shop"
  on lab_reports for insert
  with check (shop_id = (select shop_id from user_shops where user_id = auth.uid() limit 1));
