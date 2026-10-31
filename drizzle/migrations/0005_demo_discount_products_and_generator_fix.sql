
create table public.demo_discount_products (
  discount_id uuid not null references public.demo_discounts(id) on delete cascade,
  product_id uuid not null references public.demo_products(id),
  primary key (discount_id, product_id)
);

grant select, insert, update, delete on public.demo_discount_products to authenticated;
grant all on public.demo_discount_products to service_role;
alter table public.demo_discount_products enable row level security;
create policy "staff only" on public.demo_discount_products for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Align generated discounts with the app's discount_type/scope vocabulary
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

  insert into public.demo_tax_rules (name, rate, tax_type, applies_to, effective_from)
    values ('GST 18%', 18, 'gst', 'all', current_date - 365), ('GST 5%', 5, 'gst', 'all', current_date - 365);
  insert into public.demo_discounts (name, discount_type, value, scope, min_purchase, starts_on, ends_on)
    values ('Festive 10% off', 'percentage', 10, 'subscription', 5000, current_date - 60, current_date + 60),
           ('Bulk discount ₹500', 'fixed', 500, 'subscription', 10000, current_date - 90, null);

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

  for i in 1..n_plans loop
    insert into public.demo_plans (name, description, billing_frequency, price, min_quantity, status)
    values (plan_names[i], 'Demo plan', plan_freqs[i], plan_prices[i], 1, 'active')
    returning id into v_pid;
    v_plans := v_plans || v_pid;
    insert into public.demo_plan_product_lines (plan_id, product_id, quantity, unit_price)
    values (v_pid, v_prods[1 + (i % n_prod)], 1, plan_prices[i] * 0.7),
           (v_pid, v_prods[1 + ((i + 2) % n_prod)], 1, plan_prices[i] * 0.3);
  end loop;

  insert into public.demo_quotation_templates (name, plan_id, validity_days, notes)
  values ('Standard monthly offer', v_plans[1], 30, 'Demo template') returning id into v_tpl;
  insert into public.demo_quotation_templates (name, plan_id, validity_days) values ('Enterprise annual offer', v_plans[least(4, n_plans)], 45);

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
