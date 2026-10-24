-- SmartStock: atomic checkout, cancellation, stock moves, reports, logo storage.
-- All functions are SECURITY INVOKER: they run as the signed-in user, so RLS still applies.

-- ---------------------------------------------------------------------------
-- Initial stock log when a product is created
-- ---------------------------------------------------------------------------
create or replace function public.log_initial_stock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.quantity > 0 then
    insert into public.inventory_logs (user_id, product_id, change_amount, change_type, note)
    values (new.user_id, new.id, new.quantity, 'initial', 'מלאי פתיחה');
  end if;
  return new;
end;
$$;

drop trigger if exists products_initial_stock on public.products;
create trigger products_initial_stock
  after insert on public.products
  for each row execute function public.log_initial_stock();

-- ---------------------------------------------------------------------------
-- create_order: validates ownership + stock, writes order, items, stock and logs atomically
-- p_items: [{"product_id": 1, "quantity": 2}, ...]
-- ---------------------------------------------------------------------------
create or replace function public.create_order(
  p_items jsonb,
  p_customer_id bigint default null,
  p_payment_method text default 'מזומן',
  p_discount numeric default 0,
  p_note text default null
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order_id bigint;
  v_total numeric := 0;
  v_discount numeric;
  v_customer_name text;
  r record;
begin
  if v_uid is null then
    raise exception 'יש להתחבר מחדש' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'העגלה ריקה';
  end if;

  -- lock the rows we are about to change (stable order avoids deadlocks)
  perform 1 from public.products p
  where p.user_id = v_uid and p.id in (select (e ->> 'product_id')::bigint from jsonb_array_elements(p_items) e)
  order by p.id
  for update;

  for r in
    select q.pid, q.qty, p.id, p.name, p.quantity as stock, coalesce(p.sell_price, 0) as price
    from (select (e ->> 'product_id')::bigint as pid, sum((e ->> 'quantity')::int) as qty from jsonb_array_elements(p_items) e group by 1) q
    left join public.products p on p.id = q.pid and p.user_id = v_uid
  loop
    if r.id is null then
      raise exception 'מוצר % לא נמצא', r.pid;
    end if;
    if r.qty is null or r.qty <= 0 then
      raise exception 'כמות לא תקינה עבור %', r.name;
    end if;
    if r.stock < r.qty then
      raise exception 'אין מספיק מלאי עבור "%" (במלאי: %)', r.name, r.stock;
    end if;
    v_total := v_total + r.price * r.qty;
  end loop;

  if p_customer_id is not null then
    select c.name into v_customer_name from public.customers c
    where c.id = p_customer_id and c.user_id = v_uid;
    if not found then
      raise exception 'הלקוח לא נמצא';
    end if;
  end if;

  v_discount := least(greatest(coalesce(p_discount, 0), 0), v_total);

  insert into public.orders (user_id, customer_id, customer_name, total_amount, payment_method, discount, note)
  values (v_uid, p_customer_id, v_customer_name, v_total - v_discount,
          coalesce(nullif(trim(p_payment_method), ''), 'מזומן'), v_discount, nullif(trim(p_note), ''))
  returning id into v_order_id;

  insert into public.order_items (user_id, order_id, product_id, product_name, quantity, sell_price, cost_price)
  select v_uid, v_order_id, p.id, p.name, q.qty, coalesce(p.sell_price, 0), coalesce(p.cost_price, 0)
  from (select (e ->> 'product_id')::bigint as pid, sum((e ->> 'quantity')::int) as qty from jsonb_array_elements(p_items) e group by 1) q
  join public.products p on p.id = q.pid and p.user_id = v_uid;

  update public.products p
  set quantity = p.quantity - q.qty
  from (select (e ->> 'product_id')::bigint as pid, sum((e ->> 'quantity')::int) as qty from jsonb_array_elements(p_items) e group by 1) q
  where p.id = q.pid and p.user_id = v_uid;

  insert into public.inventory_logs (user_id, product_id, change_amount, change_type, note)
  select v_uid, q.pid, -q.qty, 'sale', 'הזמנה #' || v_order_id
  from (select (e ->> 'product_id')::bigint as pid, sum((e ->> 'quantity')::int) as qty from jsonb_array_elements(p_items) e group by 1) q;

  return v_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_order: marks the order cancelled and returns the stock
-- ---------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'יש להתחבר מחדש' using errcode = '42501';
  end if;

  perform 1 from public.orders o
  where o.id = p_order_id and o.user_id = v_uid and o.status = 'completed'
  for update;
  if not found then
    raise exception 'ההזמנה לא נמצאה או שכבר בוטלה';
  end if;

  update public.products p
  set quantity = p.quantity + i.qty
  from (
    select product_id, sum(quantity) as qty from public.order_items
    where order_id = p_order_id and user_id = v_uid and product_id is not null
    group by product_id
  ) i
  where p.id = i.product_id and p.user_id = v_uid;

  insert into public.inventory_logs (user_id, product_id, change_amount, change_type, note)
  select v_uid, product_id, sum(quantity), 'cancel', 'ביטול הזמנה #' || p_order_id
  from public.order_items
  where order_id = p_order_id and user_id = v_uid and product_id is not null
  group by product_id;

  update public.orders set status = 'cancelled' where id = p_order_id and user_id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- adjust_stock: restock / manual correction, always logged
-- ---------------------------------------------------------------------------
create or replace function public.adjust_stock(
  p_product_id bigint,
  p_change integer,
  p_type text default 'restock',
  p_note text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_current integer;
  v_new integer;
begin
  if v_uid is null then
    raise exception 'יש להתחבר מחדש' using errcode = '42501';
  end if;
  if p_change is null or p_change = 0 then
    raise exception 'יש להזין כמות';
  end if;
  if p_type not in ('restock', 'adjustment', 'return') then
    raise exception 'סוג תנועה לא תקין';
  end if;

  select quantity into v_current from public.products
  where id = p_product_id and user_id = v_uid
  for update;
  if not found then
    raise exception 'המוצר לא נמצא';
  end if;
  if v_current + p_change < 0 then
    raise exception 'לא ניתן להוריד מתחת לאפס (במלאי: %)', v_current;
  end if;

  update public.products set quantity = v_current + p_change
  where id = p_product_id and user_id = v_uid
  returning quantity into v_new;

  insert into public.inventory_logs (user_id, product_id, change_amount, change_type, note)
  values (v_uid, p_product_id, p_change, p_type, nullif(trim(p_note), ''));

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_dashboard: KPIs, 30-day sales series, top products, low stock
-- ---------------------------------------------------------------------------
create or replace function public.get_dashboard(p_tz text default 'Asia/Jerusalem')
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  bounds as (
    select
      (date_trunc('day', now() at time zone p_tz)) at time zone p_tz as today_start,
      (date_trunc('month', now() at time zone p_tz)) at time zone p_tz as month_start,
      (date_trunc('day', now() at time zone p_tz) - interval '29 days') at time zone p_tz as series_start
  ),
  o as (
    select o.* from public.orders o
    where o.user_id = (select auth.uid()) and o.status = 'completed'
      and o.created_at >= least((select month_start from bounds), (select series_start from bounds))
  ),
  oi as (
    select i.order_id, sum(i.quantity * (i.sell_price - coalesce(i.cost_price, 0))) as gross_profit
    from public.order_items i
    where i.user_id = (select auth.uid()) and i.order_id in (select id from o)
    group by i.order_id
  ),
  op as (
    select o.id, o.created_at, o.total_amount, o.payment_method,
           coalesce(oi.gross_profit, 0) - o.discount as profit
    from o left join oi on oi.order_id = o.id
  ),
  p as (
    select * from public.products where user_id = (select auth.uid())
  )
  select jsonb_build_object(
    'today_sales',   coalesce((select sum(total_amount) from op where created_at >= (select today_start from bounds)), 0),
    'today_orders',  (select count(*) from op where created_at >= (select today_start from bounds)),
    'month_sales',   coalesce((select sum(total_amount) from op where created_at >= (select month_start from bounds)), 0),
    'month_profit',  coalesce((select sum(profit) from op where created_at >= (select month_start from bounds)), 0),
    'month_orders',  (select count(*) from op where created_at >= (select month_start from bounds)),
    'product_count', (select count(*) from p),
    'inventory_cost',   coalesce((select sum(quantity * coalesce(cost_price, 0)) from p), 0),
    'inventory_retail', coalesce((select sum(quantity * coalesce(sell_price, 0)) from p), 0),
    'low_stock_count',  (select count(*) from p where quantity <= reorder_level),
    'out_of_stock_count', (select count(*) from p where quantity = 0),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'sales', d.sales, 'profit', d.profit, 'orders', d.orders) order by d.day), '[]'::jsonb)
      from (
        select g.day::date as day,
               coalesce(sum(op.total_amount), 0) as sales,
               coalesce(sum(op.profit), 0) as profit,
               count(op.id) as orders
        from generate_series(
               date_trunc('day', now() at time zone p_tz) - interval '29 days',
               date_trunc('day', now() at time zone p_tz),
               interval '1 day') as g(day)
        left join op on date_trunc('day', op.created_at at time zone p_tz) = g.day
        group by g.day
      ) d
    ),
    'payments', (
      select coalesce(jsonb_agg(jsonb_build_object('method', payment_method, 'total', total) order by total desc), '[]'::jsonb)
      from (select payment_method, sum(total_amount) as total from op
            where created_at >= (select series_start from bounds) group by payment_method) x
    ),
    'top_products', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'revenue', revenue) order by revenue desc), '[]'::jsonb)
      from (
        select i.product_name as name, sum(i.quantity) as qty, sum(i.quantity * i.sell_price) as revenue
        from public.order_items i
        join op on op.id = i.order_id and op.created_at >= (select series_start from bounds)
        where i.user_id = (select auth.uid())
        group by i.product_name
        order by revenue desc
        limit 5
      ) t
    ),
    'low_stock', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'quantity', quantity, 'reorder_level', reorder_level) order by quantity), '[]'::jsonb)
      from (select id, name, quantity, reorder_level from p where quantity <= reorder_level order by quantity limit 8) l
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- get_reports: ABC analysis, depletion forecast, category breakdown for a period
-- ---------------------------------------------------------------------------
create or replace function public.get_reports(p_days integer default 30)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  o as (
    select id, created_at from public.orders
    where user_id = (select auth.uid()) and status = 'completed'
      and created_at >= now() - make_interval(days => greatest(p_days, 1))
  ),
  span as (
    -- don't divide by 30 days if the business only started selling 5 days ago
    select greatest(1, least(greatest(p_days, 1),
             ceil(extract(epoch from (now() - coalesce(min(created_at), now()))) / 86400.0)))::numeric as days
    from o
  ),
  sold as (
    select i.product_id, max(i.product_name) as name,
           sum(i.quantity) as qty,
           sum(i.quantity * i.sell_price) as revenue,
           sum(i.quantity * (i.sell_price - coalesce(i.cost_price, 0))) as profit
    from public.order_items i
    where i.user_id = (select auth.uid()) and i.order_id in (select id from o)
    group by i.product_id
  ),
  ranked as (
    select s.*,
           sum(revenue) over (order by revenue desc, product_id rows unbounded preceding)
             / nullif(sum(revenue) over (), 0) as cum_share,
           (sum(revenue) over (order by revenue desc, product_id rows unbounded preceding) - revenue)
             / nullif(sum(revenue) over (), 0) as prev_share
    from sold s
  ),
  p as (
    select * from public.products where user_id = (select auth.uid())
  )
  select jsonb_build_object(
    'days', (select days from span),
    'total_revenue', coalesce((select sum(revenue) from sold), 0),
    'total_profit',  coalesce((select sum(profit) from sold), 0),
    'abc', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'product_id', product_id, 'name', name, 'qty', qty, 'revenue', revenue, 'profit', profit,
        'share', round(coalesce(cum_share, 0) * 100, 1),
        'grade', case when coalesce(prev_share, 0) < 0.8 then 'A' when coalesce(prev_share, 0) < 0.95 then 'B' else 'C' end
      ) order by revenue desc), '[]'::jsonb)
      from ranked
    ),
    'forecast', (
      select coalesce(jsonb_agg(f order by (f ->> 'days_left')::numeric nulls last), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'product_id', p.id, 'name', p.name, 'stock', p.quantity, 'reorder_level', p.reorder_level,
          'daily_rate', round(s.qty / (select days from span), 2),
          'days_left', floor(p.quantity / (s.qty / (select days from span)))
        ) as f
        from p join sold s on s.product_id = p.id
        where s.qty > 0
      ) x
    ),
    'dead_stock', (
      select coalesce(jsonb_agg(jsonb_build_object('product_id', p.id, 'name', p.name, 'stock', p.quantity,
                                                   'value', p.quantity * coalesce(p.cost_price, 0))
                                order by p.quantity * coalesce(p.cost_price, 0) desc), '[]'::jsonb)
      from p
      where p.quantity > 0 and not exists (select 1 from sold s where s.product_id = p.id)
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'revenue', revenue) order by revenue desc), '[]'::jsonb)
      from (
        select coalesce(c.name, 'ללא קטגוריה') as name, sum(s.revenue) as revenue
        from sold s
        left join p on p.id = s.product_id
        left join public.categories c on c.id = p.category_id
        group by 1
      ) cat
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: signed-in users only
-- ---------------------------------------------------------------------------
revoke execute on function public.create_order(jsonb, bigint, text, numeric, text) from public, anon;
revoke execute on function public.cancel_order(bigint) from public, anon;
revoke execute on function public.adjust_stock(bigint, integer, text, text) from public, anon;
revoke execute on function public.get_dashboard(text) from public, anon;
revoke execute on function public.get_reports(integer) from public, anon;
revoke execute on function public.log_initial_stock() from public, anon, authenticated;
grant execute on function public.create_order(jsonb, bigint, text, numeric, text) to authenticated;
grant execute on function public.cancel_order(bigint) to authenticated;
grant execute on function public.adjust_stock(bigint, integer, text, text) to authenticated;
grant execute on function public.get_dashboard(text) to authenticated;
grant execute on function public.get_reports(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Logo storage: public read, each user writes only inside their own folder
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "logos: own select" on storage.objects for select to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "logos: own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "logos: own update" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "logos: own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = (select auth.uid())::text);
