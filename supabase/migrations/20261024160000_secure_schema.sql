-- SmartStock: fix signup, secure every table with RLS, tighten constraints.

-- ---------------------------------------------------------------------------
-- 1. Signup trigger (was writing to a non-existent "role" column -> every signup failed)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, username, business_name)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    nullif(trim(new.raw_user_meta_data ->> 'business_name'), '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that signed up while the trigger was broken
insert into public.profiles (id, email, username, business_name)
select u.id, u.email, split_part(u.email, '@', 1),
       nullif(trim(u.raw_user_meta_data ->> 'business_name'), '')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Ownership defaults so the client never has to send user_id
-- ---------------------------------------------------------------------------
alter table public.products       alter column user_id set default auth.uid();
alter table public.categories     alter column user_id set default auth.uid();
alter table public.suppliers      alter column user_id set default auth.uid();
alter table public.customers      alter column user_id set default auth.uid();
alter table public.orders         alter column user_id set default auth.uid();
alter table public.inventory_logs alter column user_id set default auth.uid();

-- order_items gets its own user_id for simple, fast RLS
alter table public.order_items add column if not exists user_id uuid default auth.uid();
update public.order_items oi set user_id = o.user_id from public.orders o where o.id = oi.order_id and oi.user_id is null;
alter table public.order_items alter column user_id set not null;
alter table public.order_items drop constraint if exists order_items_user_id_fkey;
alter table public.order_items add constraint order_items_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 3. Columns & constraints
-- ---------------------------------------------------------------------------
alter table public.products alter column sku drop not null;
alter table public.products alter column quantity set not null;
alter table public.products alter column reorder_level set not null;
alter table public.products alter column sell_price set default 0;
alter table public.products alter column cost_price set default 0;
alter table public.products drop constraint if exists products_quantity_nonneg;
alter table public.products add constraint products_quantity_nonneg check (quantity >= 0);
alter table public.products drop constraint if exists products_prices_nonneg;
alter table public.products add constraint products_prices_nonneg
  check (coalesce(sell_price, 0) >= 0 and coalesce(cost_price, 0) >= 0);
create unique index if not exists products_user_sku_key
  on public.products (user_id, sku) where sku is not null and sku <> '';

alter table public.suppliers add column if not exists notes text;
alter table public.customers add column if not exists email text;
alter table public.customers add column if not exists notes text;

alter table public.orders alter column payment_method set default 'מזומן';
alter table public.orders add column if not exists status text not null default 'completed';
alter table public.orders add column if not exists discount numeric not null default 0;
alter table public.orders add column if not exists note text;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('completed', 'cancelled'));

alter table public.inventory_logs drop constraint if exists inventory_logs_type_check;
alter table public.inventory_logs add constraint inventory_logs_type_check
  check (change_type in ('initial', 'restock', 'sale', 'adjustment', 'return', 'cancel'));

-- Sensible delete behaviour (deleting a category/supplier/customer must not break history)
alter table public.products drop constraint products_category_id_fkey;
alter table public.products add constraint products_category_id_fkey
  foreign key (category_id) references public.categories (id) on delete set null;
alter table public.products drop constraint products_supplier_id_fkey;
alter table public.products add constraint products_supplier_id_fkey
  foreign key (supplier_id) references public.suppliers (id) on delete set null;
alter table public.orders drop constraint orders_customer_id_fkey;
alter table public.orders add constraint orders_customer_id_fkey
  foreign key (customer_id) references public.customers (id) on delete set null;
alter table public.order_items drop constraint order_items_order_id_fkey;
alter table public.order_items add constraint order_items_order_id_fkey
  foreign key (order_id) references public.orders (id) on delete cascade;
alter table public.order_items drop constraint order_items_product_id_fkey;
alter table public.order_items add constraint order_items_product_id_fkey
  foreign key (product_id) references public.products (id) on delete set null;
alter table public.inventory_logs drop constraint inventory_logs_product_id_fkey;
alter table public.inventory_logs add constraint inventory_logs_product_id_fkey
  foreign key (product_id) references public.products (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 4. Indexes (RLS filters + foreign keys)
-- ---------------------------------------------------------------------------
create index if not exists products_user_id_idx        on public.products (user_id);
create index if not exists products_category_id_idx    on public.products (category_id);
create index if not exists products_supplier_id_idx    on public.products (supplier_id);
create index if not exists categories_user_id_idx      on public.categories (user_id);
create index if not exists suppliers_user_id_idx       on public.suppliers (user_id);
create index if not exists customers_user_id_idx       on public.customers (user_id);
create index if not exists orders_user_created_idx     on public.orders (user_id, created_at desc);
create index if not exists orders_customer_id_idx      on public.orders (customer_id);
create index if not exists order_items_order_id_idx    on public.order_items (order_id);
create index if not exists order_items_product_id_idx  on public.order_items (product_id);
create index if not exists order_items_user_id_idx     on public.order_items (user_id);
create index if not exists inventory_logs_user_created_idx on public.inventory_logs (user_id, created_at desc);
create index if not exists inventory_logs_product_id_idx   on public.inventory_logs (product_id);

-- ---------------------------------------------------------------------------
-- 5. Row Level Security: every user sees only their own rows
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

alter table public.profiles       enable row level security;
alter table public.products       enable row level security;
alter table public.categories     enable row level security;
alter table public.suppliers      enable row level security;
alter table public.customers      enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.inventory_logs enable row level security;

-- profiles: keyed by id
create policy "profiles: own select" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "profiles: own insert" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "profiles: own update" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- owned tables: keyed by user_id
do $$
declare t text;
begin
  foreach t in array array['products','categories','suppliers','customers','orders','order_items','inventory_logs'] loop
    execute format('create policy "%1$s: own select" on public.%1$I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: own insert" on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: own update" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: own delete" on public.%1$I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- Sales history is append-only from the client: changes go through the functions below
drop policy "order_items: own update" on public.order_items;
drop policy "inventory_logs: own update" on public.inventory_logs;
drop policy "inventory_logs: own delete" on public.inventory_logs;
