
alter table public.profiles add column active_mode text not null default 'real';

create table public.demo_meta (
  id boolean primary key default true check (id),
  size text not null,
  generated_by uuid,
  generated_at timestamptz not null default now()
);

create table public.demo_customers (
  id uuid primary key default gen_random_uuid(),
  customer_number text not null,
  user_id uuid,
  name text not null,
  email text not null,
  phone text,
  company text,
  address text,
  tax_id text,
  status text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.demo_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  product_type text not null default 'service',
  sales_price numeric not null default 0,
  cost_price numeric not null default 0,
  notes text,
  status text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.demo_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.demo_products(id) on delete cascade,
  attribute text not null,
  value text not null,
  extra_price numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.demo_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  billing_frequency billing_frequency not null default 'monthly',
  price numeric not null default 0,
  min_quantity integer not null default 1,
  available_from date,
  available_until date,
  auto_close boolean not null default false,
  auto_close_cycles integer,
  allow_early_close boolean not null default true,
  allow_pause boolean not null default true,
  allow_renew boolean not null default true,
  status text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.demo_plan_product_lines (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.demo_plans(id) on delete cascade,
  product_id uuid not null references public.demo_products(id),
  variant_id uuid references public.demo_product_variants(id),
  quantity integer not null default 1,
  unit_price numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.demo_tax_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rate numeric not null,
  tax_type text not null default 'gst',
  applies_to text not null default 'all',
  product_id uuid references public.demo_products(id),
  effective_from date not null default current_date,
  effective_to date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.demo_discounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  discount_type text not null default 'percent',
  value numeric not null,
  scope text not null default 'order',
  min_purchase numeric not null default 0,
  min_quantity integer not null default 0,
  starts_on date not null default current_date,
  ends_on date,
  max_uses integer,
  used_count integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.demo_quotation_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_id uuid not null references public.demo_plans(id),
  validity_days integer not null default 30,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.demo_quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text not null,
  customer_id uuid not null references public.demo_customers(id),
  template_id uuid references public.demo_quotation_templates(id),
  plan_id uuid not null references public.demo_plans(id),
  status quotation_status not null default 'draft',
  subtotal numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  valid_until date not null,
  converted_subscription_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.demo_quotation_lines (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.demo_quotations(id) on delete cascade,
  product_id uuid not null references public.demo_products(id),
  variant_id uuid references public.demo_product_variants(id),
  description text not null,
  quantity integer not null default 1,
  unit_price numeric not null default 0,
  line_subtotal numeric not null default 0
);

create table public.demo_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscription_number text not null,
  customer_id uuid not null references public.demo_customers(id),
  plan_id uuid not null references public.demo_plans(id),
  status subscription_status not null default 'draft',
  billing_frequency billing_frequency not null default 'monthly',
  start_date date not null,
  expiry_date date,
  payment_terms_days integer not null default 15,
  cycles_billed integer not null default 0,
  next_billing_date date,
  subtotal numeric not null default 0,
  total numeric not null default 0,
  quotation_id uuid references public.demo_quotations(id),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.demo_subscription_lines (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.demo_subscriptions(id) on delete cascade,
  product_id uuid not null references public.demo_products(id),
  variant_id uuid references public.demo_product_variants(id),
  description text not null,
  quantity integer not null default 1,
  unit_price numeric not null default 0
);

create table public.demo_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  customer_id uuid not null references public.demo_customers(id),
  subscription_id uuid references public.demo_subscriptions(id),
  customer_snapshot jsonb not null default '{}',
  invoice_date date not null,
  due_date date not null,
  period_start date,
  period_end date,
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  amount_paid numeric not null default 0,
  status invoice_status not null default 'draft',
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.demo_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.demo_invoices(id) on delete cascade,
  product_id uuid references public.demo_products(id),
  description text not null,
  quantity integer not null default 1,
  unit_price numeric not null default 0,
  line_subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_rate numeric not null default 0,
  tax_amount numeric not null default 0,
  line_total numeric not null default 0
);

create table public.demo_payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null,
  customer_id uuid not null references public.demo_customers(id),
  amount numeric not null,
  method payment_method not null default 'bank_transfer',
  payment_date date not null,
  reference text,
  notes text,
  status payment_status not null default 'recorded',
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.demo_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.demo_payments(id) on delete cascade,
  invoice_id uuid not null references public.demo_invoices(id),
  amount numeric not null,
  created_at timestamptz not null default now()
);

create table public.demo_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Grants + RLS: demo data is internal (staff only), never visible to customers
grant select, insert, update, delete on public.demo_meta to authenticated;
grant select, insert, update, delete on public.demo_customers to authenticated;
grant select, insert, update, delete on public.demo_products to authenticated;
grant select, insert, update, delete on public.demo_product_variants to authenticated;
grant select, insert, update, delete on public.demo_plans to authenticated;
grant select, insert, update, delete on public.demo_plan_product_lines to authenticated;
grant select, insert, update, delete on public.demo_tax_rules to authenticated;
grant select, insert, update, delete on public.demo_discounts to authenticated;
grant select, insert, update, delete on public.demo_quotation_templates to authenticated;
grant select, insert, update, delete on public.demo_quotations to authenticated;
grant select, insert, update, delete on public.demo_quotation_lines to authenticated;
grant select, insert, update, delete on public.demo_subscriptions to authenticated;
grant select, insert, update, delete on public.demo_subscription_lines to authenticated;
grant select, insert, update, delete on public.demo_invoices to authenticated;
grant select, insert, update, delete on public.demo_invoice_lines to authenticated;
grant select, insert, update, delete on public.demo_payments to authenticated;
grant select, insert, update, delete on public.demo_payment_allocations to authenticated;
grant select, insert, update, delete on public.demo_audit_logs to authenticated;
grant all on all tables in schema public to service_role;

do $$
declare t text;
begin
  foreach t in array array['demo_meta','demo_customers','demo_products','demo_product_variants','demo_plans','demo_plan_product_lines','demo_tax_rules','demo_discounts','demo_quotation_templates','demo_quotations','demo_quotation_lines','demo_subscriptions','demo_subscription_lines','demo_invoices','demo_invoice_lines','demo_payments','demo_payment_allocations','demo_audit_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "staff only" on public.%I for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()))', t);
  end loop;
end $$;

create or replace function public.set_active_mode(_mode text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Only admins can switch modes'; end if;
  if _mode not in ('real', 'demo') then raise exception 'Invalid mode'; end if;
  update public.profiles set active_mode = _mode, updated_at = now() where id = auth.uid();
end $$;

create or replace function public.clear_demo_data()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Only admins can clear demo data'; end if;
  delete from public.demo_payment_allocations;
  delete from public.demo_payments;
  delete from public.demo_invoice_lines;
  delete from public.demo_invoices;
  delete from public.demo_subscription_lines;
  delete from public.demo_subscriptions;
  delete from public.demo_quotation_lines;
  delete from public.demo_quotations;
  delete from public.demo_quotation_templates;
  delete from public.demo_plan_product_lines;
  delete from public.demo_plans;
  delete from public.demo_product_variants;
  delete from public.demo_products;
  delete from public.demo_tax_rules;
  delete from public.demo_discounts;
  delete from public.demo_customers;
  delete from public.demo_audit_logs;
  delete from public.demo_meta;
end $$;

create or replace function public.generate_sample_data(_size text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  n_cust int; n_prod int; n_plans int; n_subs int;
  companies text[] := array['Acme Textiles','Bluepeak Labs','Crescent Foods','Delta Logistics','Everline Retail','Falcon Motors','Greenfield Agro','Harbor Marine','Indus Ceramics','Jupiter Hotels','Kaveri Pharma','Lotus Apparel','Meridian Steel','Nimbus Cloud Kitchen','Orbit Electronics','Prism Paints','Quantum Fitness','Riverstone Realty','Sunrise Dairies','Trident Security','Umbrella Events','Vertex Automation','Willow Wellness','Xpress Couriers','Yellowbrick Education','Zenith Furniture','Banyan Books','Cobalt Chemicals','Dreamscape Studios','Echo Mobility','Frontier Oils','Galaxy Gems','Horizon Hospitals','Ivory Interiors','Jade Jewellers','Kite Media','Lumen Lighting','Maple Bakeries','Nova Nutrients','Oasis Spas','Pinnacle Polymers','Quest Analytics','Radiant Solar','Summit Sports','Terra Tiles','Urban Eats'];
  first_names text[] := array['Aarav','Diya','Rohan','Priya','Vikram','Ananya','Arjun','Meera','Karan','Ishita','Nikhil','Sneha','Rahul','Pooja','Aditya','Kavya','Sahil','Neha','Varun','Lakshmi'];
  last_names text[] := array['Shah','Patel','Iyer','Reddy','Khan','Mehta','Nair','Gupta','Joshi','Rao','Chopra','Das','Kulkarni','Singh','Bose','Agarwal','Menon','Pillai','Verma','Chauhan'];
  prod_names text[] := array['ERP Implementation','Cloud Hosting','Support Retainer','POS Terminal','Inventory Module','CRM License','Payroll Module','Analytics Dashboard','API Gateway','Mobile App License','Barcode Scanner','Training Session','Data Migration','Custom Report Pack','Security Audit','Backup Service'];
  plan_names text[] := array['Starter Monthly','Growth Monthly','Scale Weekly','Enterprise Yearly','Daily Essentials','Professional Monthly','Ultimate Yearly'];
  plan_freqs billing_frequency[] := array['monthly','monthly','weekly','yearly','daily','monthly','yearly'];
  plan_prices numeric[] := array[999,2499,799,49999,99,4999,99999];
  v_prods uuid[] := '{}';
  v_plans uuid[] := '{}';
  v_custs uuid[] := '{}';
  v_subs uuid[] := '{}';
  v_id uuid; v_pid uuid; v_cid uuid; v_sid uuid; v_iid uuid; v_pay uuid; v_tpl uuid;
  i int; k int; n_inv int;
  v_sub numeric; v_tax numeric; v_total numeric;
  v_status text;
  v_inv_date date; v_due date;
  v_line record;
  v_subrec record;
  v_pname text; v_cname text;
  methods payment_method[] := array['upi','bank_transfer','card','cash'];
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Only admins can generate sample data'; end if;
  if exists (select 1 from public.demo_meta) then raise exception 'Sample data already exists. Clear demo data before generating again.'; end if;
  if _size not in ('small','medium','large') then raise exception 'Size must be small, medium or large'; end if;

  n_cust := case _size when 'small' then 6 when 'medium' then 18 else 45 end;
  n_prod := case _size when 'small' then 5 when 'medium' then 10 else 16 end;
  n_plans := case _size when 'small' then 3 when 'medium' then 5 else 7 end;
  n_subs := case _size when 'small' then 8 when 'medium' then 20 else 44 end;

  -- Tax rules and discounts
  insert into public.demo_tax_rules (name, rate, tax_type, applies_to, effective_from)
    values ('GST 18%', 18, 'gst', 'all', current_date - 365), ('GST 5%', 5, 'gst', 'all', current_date - 365);
  insert into public.demo_discounts (name, discount_type, value, scope, min_purchase, starts_on, ends_on)
    values ('Festive 10% off', 'percent', 10, 'order', 5000, current_date - 60, current_date + 60),
           ('Bulk discount ₹500', 'fixed', 500, 'order', 10000, current_date - 90, null);

  -- Products + variants
  for i in 1..n_prod loop
    v_pname := prod_names[1 + (i - 1) % array_length(prod_names, 1)];
    insert into public.demo_products (name, product_type, sales_price, cost_price, notes, status)
    values (v_pname, (array['service','software','license','consumable'])[1 + (i % 4)], 499 + i * 350, round((499 + i * 350) * 0.4), 'Demo product', 'active')
    returning id into v_pid;
    v_prods := v_prods || v_pid;
    if i <= 4 then
      insert into public.demo_product_variants (product_id, attribute, value, extra_price) values
        (v_pid, 'Brand', 'Odoo', 0), (v_pid, 'Brand', 'ERPNext', 200);
    end if;
  end loop;

  -- Plans + plan lines
  for i in 1..n_plans loop
    insert into public.demo_plans (name, description, billing_frequency, price, min_quantity, status)
    values (plan_names[i], 'Demo plan', plan_freqs[i], plan_prices[i], 1, 'active')
    returning id into v_pid;
    v_plans := v_plans || v_pid;
    insert into public.demo_plan_product_lines (plan_id, product_id, quantity, unit_price)
    values (v_pid, v_prods[1 + (i % n_prod)], 1, plan_prices[i] * 0.7),
           (v_pid, v_prods[1 + ((i + 2) % n_prod)], 1, plan_prices[i] * 0.3);
  end loop;

  -- Quotation templates
  insert into public.demo_quotation_templates (name, plan_id, validity_days, notes)
  values ('Standard monthly offer', v_plans[1], 30, 'Demo template') returning id into v_tpl;
  insert into public.demo_quotation_templates (name, plan_id, validity_days) values ('Enterprise annual offer', v_plans[least(4, n_plans)], 45);

  -- Customers
  for i in 1..n_cust loop
    v_cname := first_names[1 + (i - 1) % 20] || ' ' || last_names[1 + ((i * 3) - 1) % 20];
    insert into public.demo_customers (customer_number, name, email, phone, company, address, tax_id, status)
    values ('DEMO-CUS-' || lpad(i::text, 4, '0'), v_cname,
            lower(replace(v_cname, ' ', '.')) || '@' || lower(replace(companies[1 + (i - 1) % array_length(companies, 1)], ' ', '')) || '.example.com',
            '+91 98' || lpad((10000000 + i * 137)::text, 8, '0'),
            companies[1 + (i - 1) % array_length(companies, 1)],
            (10 + i) || ' Demo Street, Bengaluru', '29DEMO' || lpad(i::text, 4, '0') || 'Z5',
            case when i % 9 = 0 then 'archived' else 'active' end)
    returning id into v_cid;
    v_custs := v_custs || v_cid;
  end loop;

  -- Quotations (every other customer)
  for i in 1..n_cust loop
    if i % 2 = 0 then
      v_pid := v_plans[1 + (i % n_plans)];
      select coalesce(sum(unit_price * quantity), 0) into v_sub from public.demo_plan_product_lines where plan_id = v_pid;
      v_tax := round(v_sub * 0.18, 2);
      v_status := (array['draft','sent','accepted','rejected','converted'])[1 + (i % 5)];
      insert into public.demo_quotations (quotation_number, customer_id, template_id, plan_id, status, subtotal, tax_amount, total, valid_until, created_at)
      values ('DEMO-QT-' || lpad(i::text, 4, '0'), v_custs[i], case when i % 4 = 0 then v_tpl end, v_pid, v_status::quotation_status,
              v_sub, v_tax, v_sub + v_tax, current_date + 30, now() - ((i * 3) || ' days')::interval)
      returning id into v_id;
      insert into public.demo_quotation_lines (quotation_id, product_id, description, quantity, unit_price, line_subtotal)
      select v_id, l.product_id, p.name, l.quantity, l.unit_price, l.quantity * l.unit_price
      from public.demo_plan_product_lines l join public.demo_products p on p.id = l.product_id where l.plan_id = v_pid;
    end if;
  end loop;

  -- Subscriptions with lines
  for i in 1..n_subs loop
    v_pid := v_plans[1 + (i % n_plans)];
    v_cid := v_custs[1 + (i % n_cust)];
    select coalesce(sum(unit_price * quantity), 0) into v_sub from public.demo_plan_product_lines where plan_id = v_pid;
    v_tax := round(v_sub * 0.18, 2);
    v_status := (array['active','active','active','paused','closed','draft','confirmed'])[1 + (i % 7)];
    insert into public.demo_subscriptions (subscription_number, customer_id, plan_id, status, billing_frequency, start_date, payment_terms_days, cycles_billed, next_billing_date, subtotal, total, created_at)
    values ('DEMO-SUB-' || lpad(i::text, 4, '0'), v_cid, v_pid, v_status::subscription_status, plan_freqs[1 + (i % n_plans)],
            current_date - (30 + (i * 6) % 270), 15, 0,
            case when v_status in ('active','paused') then current_date + (1 + (i * 3) % 25) end,
            v_sub, v_sub + v_tax, now() - ((30 + (i * 6) % 270) || ' days')::interval)
    returning id into v_sid;
    v_subs := v_subs || v_sid;
    insert into public.demo_subscription_lines (subscription_id, product_id, description, quantity, unit_price)
    select v_sid, l.product_id, p.name, l.quantity, l.unit_price
    from public.demo_plan_product_lines l join public.demo_products p on p.id = l.product_id where l.plan_id = v_pid;
  end loop;

  -- Invoices + payments for non-draft subscriptions
  for i in 1..n_subs loop
    select * into v_subrec from public.demo_subscriptions where id = v_subs[i];
    if v_subrec.status in ('active','paused','closed','confirmed') then
      n_inv := 1 + (i % 3);
      for k in 0..n_inv - 1 loop
        v_inv_date := current_date - (k * 30 + (i % 5));
        v_due := v_inv_date + 15;
        v_sub := v_subrec.subtotal; v_tax := round(v_sub * 0.18, 2); v_total := v_sub + v_tax;
        if k = 0 and v_subrec.status <> 'closed' and (i % 3) = 0 then
          v_status := case when v_due < current_date then 'overdue' else 'confirmed' end;
        else
          v_status := 'paid';
        end if;
        insert into public.demo_invoices (invoice_number, customer_id, subscription_id, customer_snapshot, invoice_date, due_date, period_start, period_end, subtotal, tax_amount, total, amount_paid, status, confirmed_at, created_at)
        values ('DEMO-INV-' || lpad(i::text, 4, '0') || '-' || (k + 1), v_subrec.customer_id, v_subrec.id,
                jsonb_build_object('name', (select name from public.demo_customers where id = v_subrec.customer_id)),
                v_inv_date, v_due, v_inv_date - 30, v_inv_date, v_sub, v_tax, v_total,
                case when v_status = 'paid' then v_total else 0 end, v_status::invoice_status, v_inv_date, v_inv_date)
        returning id into v_iid;
        insert into public.demo_invoice_lines (invoice_id, product_id, description, quantity, unit_price, line_subtotal, tax_rate, tax_amount, line_total)
        select v_iid, l.product_id, l.description, l.quantity, l.unit_price, l.quantity * l.unit_price, 18,
               round(l.quantity * l.unit_price * 0.18, 2), round(l.quantity * l.unit_price * 1.18, 2)
        from public.demo_subscription_lines l where l.subscription_id = v_subrec.id;
        if v_status = 'paid' then
          insert into public.demo_payments (payment_number, customer_id, amount, method, payment_date, reference, status, created_at)
          values ('DEMO-PAY-' || lpad(i::text, 4, '0') || '-' || (k + 1), v_subrec.customer_id, v_total,
                  methods[1 + (i + k) % 4], v_inv_date + (1 + (i % 10)), 'DEMO-TXN-' || i || '-' || k, 'recorded', v_inv_date)
          returning id into v_pay;
          insert into public.demo_payment_allocations (payment_id, invoice_id, amount) values (v_pay, v_iid, v_total);
        end if;
      end loop;
      update public.demo_subscriptions set cycles_billed = n_inv where id = v_subrec.id;
    end if;
  end loop;

  insert into public.demo_audit_logs (actor, action, entity_type, metadata)
  values (auth.uid(), 'generate_sample_data', 'demo_meta', jsonb_build_object('size', _size));
  insert into public.demo_meta (size, generated_by) values (_size, auth.uid());

  return jsonb_build_object('customers', n_cust, 'products', n_prod, 'plans', n_plans, 'subscriptions', n_subs);
end $$;

create or replace function public.demo_dashboard_metrics(_from date default null, _to date default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare r jsonb;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorized'; end if;
  select jsonb_build_object(
    'customers', (select count(*) from demo_customers where status = 'active'),
    'products', (select count(*) from demo_products where status = 'active'),
    'active_plans', (select count(*) from demo_plans where status = 'active'),
    'active_subs', (select count(*) from demo_subscriptions where status = 'active'),
    'paused_subs', (select count(*) from demo_subscriptions where status = 'paused'),
    'cancelled_subs', (select count(*) from demo_subscriptions where status = 'cancelled'),
    'open_quotations', (select count(*) from demo_quotations where status in ('draft','sent','accepted')),
    'upcoming_renewals', (select count(*) from demo_subscriptions where status = 'active' and next_billing_date between current_date and current_date + 7),
    'mrr', (select coalesce(sum(case billing_frequency when 'daily' then total * 365 / 12.0 when 'weekly' then total * 52 / 12.0 when 'monthly' then total else total / 12.0 end),0) from demo_subscriptions where status = 'active'),
    'invoiced', (select coalesce(sum(total),0) from demo_invoices where status not in ('draft','cancelled') and (_from is null or invoice_date >= _from) and (_to is null or invoice_date <= _to)),
    'collected', (select coalesce(sum(amount),0) from demo_payments where status = 'recorded' and (_from is null or payment_date >= _from) and (_to is null or payment_date <= _to)),
    'outstanding', (select coalesce(sum(total - amount_paid),0) from demo_invoices where status in ('confirmed','partially_paid','overdue')),
    'overdue_count', (select count(*) from demo_invoices where status = 'overdue' or (status in ('confirmed','partially_paid') and due_date < current_date)),
    'pending_invoices', (select count(*) from demo_invoices where status in ('confirmed','partially_paid','overdue')),
    'status_distribution', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from demo_subscriptions group by status) x),
    'revenue_trend', (select coalesce(jsonb_agg(row_to_json(t) order by t.month), '[]'::jsonb) from (
        select to_char(m, 'YYYY-MM') as month,
          (select coalesce(sum(total),0) from demo_invoices where status not in ('draft','cancelled') and date_trunc('month', invoice_date) = m) as invoiced,
          (select coalesce(sum(amount),0) from demo_payments where status = 'recorded' and date_trunc('month', payment_date) = m) as collected,
          (select count(*) from demo_subscriptions where date_trunc('month', created_at) = m) as new_subs
        from generate_series(date_trunc('month', current_date) - interval '11 months', date_trunc('month', current_date), interval '1 month') m) t),
    'product_performance', (select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select pr.name, coalesce(sum(il.line_total),0) as revenue from demo_invoice_lines il join demo_invoices i on i.id = il.invoice_id and i.status not in ('draft','cancelled')
        join demo_products pr on pr.id = il.product_id group by pr.name order by 2 desc limit 8) t)
  ) into r;
  r := r || jsonb_build_object('arr', (r->>'mrr')::numeric * 12);
  return r;
end $$;
