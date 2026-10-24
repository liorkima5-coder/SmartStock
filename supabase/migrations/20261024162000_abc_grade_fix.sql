-- ABC grading: an item is "A" while the revenue share *before* it is under 80% (standard Pareto),
-- so a single dominant best-seller is graded A rather than B.
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
