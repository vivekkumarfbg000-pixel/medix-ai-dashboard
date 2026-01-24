create or replace function decrement_stock(row_id uuid, amount int)
returns void
language plpgsql
security definer
as $$
begin
  update inventory
  set quantity = quantity - amount
  where id = row_id;
end;
$$;
