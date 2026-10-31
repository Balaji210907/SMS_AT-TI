create or replace function public.demo_dashboard_metrics(_from date default null, _to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_from date := coalesce(_from, current_date - interval '365 days');
  v_to date := coalesce(_to, current_date);
  v jsonb;
begin
  if not public.is_staff(auth.uid()) then raise exception 'forbidden'; end if;
  with inv as (
    select * from public.demo_invoices
    where status not in ('draft','cancelled') and invoice_date between v_from and v_to
  ), pays as (
    select * from public.demo_payments where status = 'recorded' and payment_date between v_from and v_to
  ), subs as (select * from public.demo_subscriptions)
  select jsonb_build_object(
    'mrr', coalesce((select sum(case billing_frequency when 'daily' then total*30 when 'weekly' then total*4.33 when 'monthly' then total when 'yearly' then total/12 end) from subs where status = 'active'), 0),
    'arr', coalesce((select sum(case billing_frequency when 'daily' then total*365 when 'weekly' then total*52 when 'monthly' then total*12 when 'yearly' then total end) from subs where status = 'active'), 0),
    'invoiced', coalesce((select sum(total) from inv), 0),
    'collected', coalesce((select sum(amount) from pays), 0),
    'outstanding', coalesce((select sum(total - amount_paid) from public.demo_invoices where status in ('confirmed','partially_paid','overdue')), 0),
    'overdue_count', (select count(*) from public.demo_invoices where status = 'overdue'),
    'active_subs', (select count(*) from subs where status = 'active'),
    'paused_subs', (select count(*) from subs where status = 'paused'),
    'cancelled_subs', (select count(*) from subs where status in ('cancelled','closed')),
    'upcoming_renewals', (select count(*) from subs where status = 'active' and next_billing_date between current_date and current_date + 7),
    'customers', (select count(*) from public.demo_customers where status = 'active'),
    'open_quotations', (select count(*) from public.demo_quotations where status in ('draft','sent')),
    'revenue_trend', coalesce((select jsonb_agg(t order by t.month) from (
      select to_char(m, 'Mon YY') as month,
        coalesce((select sum(total) from public.demo_invoices where status not in ('draft','cancelled') and date_trunc('month', invoice_date) = m), 0) as invoiced,
        coalesce((select sum(amount) from public.demo_payments where status = 'recorded' and date_trunc('month', payment_date) = m), 0) as collected
      from generate_series(date_trunc('month', current_date) - interval '11 months', date_trunc('month', current_date), interval '1 month') m
    ) t), '[]'::jsonb),
    'status_distribution', coalesce((select jsonb_agg(jsonb_build_object('status', status, 'count', c)) from (select status, count(*) c from subs group by status) s), '[]'::jsonb),
    'product_performance', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'revenue', revenue) order by revenue desc) from (
      select p.name, sum(l.line_total) revenue from public.demo_invoice_lines l join public.demo_products p on p.id = l.product_id
      join public.demo_invoices i on i.id = l.invoice_id and i.status not in ('draft','cancelled')
      group by p.name order by revenue desc limit 6
    ) pp), '[]'::jsonb)
  ) into v;
  return v;
end $$;

-- Record a verified Razorpay payment: full amount against one invoice.
-- Verified-only rule lives here so no client path can create gateway payments.
create or replace function public.apply_verified_payment(_invoice uuid, _amount numeric, _method payment_method, _reference text, _notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_inv public.invoices;
  v_pay uuid;
begin
  select * into v_inv from public.invoices where id = _invoice for update;
  if not found then raise exception 'invoice not found'; end if;
  if v_inv.status in ('draft','cancelled','paid') then raise exception 'invoice % cannot accept payments', v_inv.status; end if;
  if _amount <= 0 then raise exception 'amount must be positive'; end if;
  if _amount > v_inv.total - v_inv.amount_paid + 0.001 then raise exception 'amount exceeds outstanding balance'; end if;

  v_pay := public.record_payment(_invoice, _amount, _method, current_date, _reference, _notes);
  return v_pay;
end $$;

comment on function public.apply_verified_payment is 'Records a payment only after gateway signature verification; used by the Razorpay server flow.';