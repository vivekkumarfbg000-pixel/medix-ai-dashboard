-- Function to automatically deduct inventory when a sale is made
-- Assumes 'orders' table has a JSONB column 'order_items' structure: [{ inventory_id, qty, ... }]
create or replace function deduct_inventory_on_sale()
returns trigger as $$
declare
  item jsonb;
begin
  -- Loop through each item in the order_items JSON array
  for item in select * from jsonb_array_elements(new.order_items)
  loop
    -- Deduct quantity from inventory table
    update inventory
    set quantity = quantity - (item->>'qty')::int
    where id = (item->>'inventory_id')::uuid;
  end loop;
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger definition
drop trigger if exists after_sale_deduction on orders;

create trigger after_sale_deduction
after insert on orders
for each row
execute function deduct_inventory_on_sale();
