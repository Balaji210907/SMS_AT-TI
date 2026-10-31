-- ========================================================
-- BrightLoop Subscription Management System (SMS)
-- Full Database Schema & Business Logic
-- Run this in your Supabase SQL Editor from scratch
-- ========================================================

-- >>> Start of 0000_core_schema.sql >>>

-- ===== ENUMS =====
create type public.app_role as enum ('admin','staff','customer');
create type public.billing_frequency as enum ('daily','weekly','monthly','yearly');
create type public.subscription_status as enum ('draft','quotation','confirmed','active','paused','closed','cancelled','expired');
create type public.invoice_status as enum ('draft','confirmed','partially_paid','paid','overdue','cancelled');
create type public.quotation_status as enum ('draft','sent','accepted','rejected','expired','converted');
create type public.payment_method as enum ('upi','cash','bank_transfer','card','other');
create type public.payment_status as enum ('recorded','reversed');

-- ===== SEQUENCES =====
create sequence public.customer_number_seq start 1001;
create sequence public.subscription_number_seq start 1001;
create sequence public.invoice_number_seq start 1001;
create sequence public.payment_number_seq start 1001;
create sequence public.quotation_number_seq start 1001;

-- ===== AUTH / USERS =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','staff'))
$$;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- ===== CUSTOMERS =====
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_number text not null unique default ('CUS-' || nextval('public.customer_number_seq')),
  user_id uuid unique,
  name text not null check (length(trim(name)) > 0),
  email text not null,
  phone text,
  company text,
  address text,
  tax_id text,
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index customers_email_uniq on public.customers (lower(email));
grant select, insert, update on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create policy "staff manage customers" on public.customers for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "customer reads self" on public.customers for select to authenticated using (user_id = auth.uid());
create policy "customer updates self" on public.customers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.my_customer_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.customers where user_id = auth.uid()
$$;

-- prevent customers from changing protected customer columns
create or replace function public.customers_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) and auth.uid() is not null then
    if new.user_id is distinct from old.user_id or new.status is distinct from old.status
       or new.customer_number is distinct from old.customer_number or lower(new.email) is distinct from lower(old.email) then
      raise exception 'Not allowed to change protected fields';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger customers_guard before update on public.customers for each row execute function public.customers_guard();

-- ===== CATALOG =====
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  product_type text not null default 'service' check (product_type in ('service','software','license','consumable','other')),
  sales_price numeric(14,2) not null default 0 check (sales_price >= 0),
  cost_price numeric(14,2) not null default 0 check (cost_price >= 0),
  notes text,
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  attribute text not null default 'Brand',
  value text not null check (length(trim(value)) > 0),
  extra_price numeric(14,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, attribute, value)
);
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  billing_frequency public.billing_frequency not null default 'monthly',
  price numeric(14,2) not null default 0 check (price >= 0),
  min_quantity integer not null default 1 check (min_quantity >= 1),
  available_from date,
  available_until date,
  auto_close boolean not null default false,
  auto_close_cycles integer check (auto_close_cycles is null or auto_close_cycles > 0),
  allow_early_close boolean not null default true,
  allow_pause boolean not null default true,
  allow_renew boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (available_until is null or available_from is null or available_until >= available_from)
);
create table public.plan_product_lines (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);
create table public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rate numeric(6,3) not null check (rate >= 0 and rate <= 100),
  tax_type text not null default 'exclusive' check (tax_type in ('exclusive')),
  applies_to text not null default 'all' check (applies_to in ('all','product')),
  product_id uuid references public.products(id),
  effective_from date not null default current_date,
  effective_to date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  check (applies_to = 'all' or product_id is not null)
);
create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  discount_type text not null check (discount_type in ('percentage','fixed')),
  value numeric(14,2) not null check (value > 0),
  scope text not null default 'subscription' check (scope in ('subscription','product')),
  min_purchase numeric(14,2) not null default 0 check (min_purchase >= 0),
  min_quantity integer not null default 0 check (min_quantity >= 0),
  starts_on date not null default current_date,
  ends_on date,
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type <> 'percentage' or value <= 100),
  check (ends_on is null or ends_on >= starts_on),
  check (max_uses is null or used_count <= max_uses)
);
create table public.discount_products (
  discount_id uuid not null references public.discounts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (discount_id, product_id)
);

grant select on public.products, public.product_variants, public.plans, public.plan_product_lines, public.tax_rules, public.discounts, public.discount_products to authenticated;
grant insert, update, delete on public.products, public.product_variants, public.plans, public.plan_product_lines, public.tax_rules, public.discounts, public.discount_products to authenticated;
grant all on public.products, public.product_variants, public.plans, public.plan_product_lines, public.tax_rules, public.discounts, public.discount_products to service_role;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.plans enable row level security;
alter table public.plan_product_lines enable row level security;
alter table public.tax_rules enable row level security;
alter table public.discounts enable row level security;
alter table public.discount_products enable row level security;

create policy "read products" on public.products for select to authenticated using (true);
create policy "admin write products" on public.products for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "read variants" on public.product_variants for select to authenticated using (true);
create policy "admin write variants" on public.product_variants for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "read plans" on public.plans for select to authenticated using (true);
create policy "admin write plans" on public.plans for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "read plan lines" on public.plan_product_lines for select to authenticated using (true);
create policy "admin write plan lines" on public.plan_product_lines for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "staff read taxes" on public.tax_rules for select to authenticated using (public.is_staff(auth.uid()));
create policy "admin write taxes" on public.tax_rules for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "staff read discounts" on public.discounts for select to authenticated using (public.is_staff(auth.uid()));
create policy "admin write discounts" on public.discounts for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "staff read discount products" on public.discount_products for select to authenticated using (public.is_staff(auth.uid()));
create policy "admin write discount products" on public.discount_products for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ===== QUOTATIONS =====
create table public.quotation_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_id uuid not null references public.plans(id),
  validity_days integer not null default 30 check (validity_days > 0),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quotation_templates to authenticated;
grant all on public.quotation_templates to service_role;
alter table public.quotation_templates enable row level security;
create policy "staff read templates" on public.quotation_templates for select to authenticated using (public.is_staff(auth.uid()));
create policy "admin write templates" on public.quotation_templates for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text not null unique default ('QUO-' || nextval('public.quotation_number_seq')),
  customer_id uuid not null references public.customers(id),
  template_id uuid references public.quotation_templates(id),
  plan_id uuid not null references public.plans(id),
  status public.quotation_status not null default 'draft',
  subtotal numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  valid_until date not null,
  converted_subscription_id uuid unique,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.quotation_lines (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  description text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_subtotal numeric(14,2) not null
);
grant select on public.quotations, public.quotation_lines to authenticated;
grant all on public.quotations, public.quotation_lines to service_role;
alter table public.quotations enable row level security;
alter table public.quotation_lines enable row level security;
create policy "staff read quotations" on public.quotations for select to authenticated using (public.is_staff(auth.uid()) or customer_id = public.my_customer_id());
create policy "read quotation lines" on public.quotation_lines for select to authenticated using (exists (select 1 from public.quotations q where q.id = quotation_id and (public.is_staff(auth.uid()) or q.customer_id = public.my_customer_id())));

-- ===== SUBSCRIPTIONS =====
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscription_number text not null unique default ('SUB-' || nextval('public.subscription_number_seq')),
  customer_id uuid not null references public.customers(id),
  plan_id uuid not null references public.plans(id),
  status public.subscription_status not null default 'draft',
  billing_frequency public.billing_frequency not null,
  start_date date not null,
  expiry_date date,
  payment_terms_days integer not null default 15 check (payment_terms_days >= 0 and payment_terms_days <= 365),
  cycles_billed integer not null default 0,
  next_billing_date date,
  subtotal numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  quotation_id uuid unique references public.quotations(id),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expiry_date is null or expiry_date >= start_date)
);
create index subscriptions_customer_idx on public.subscriptions(customer_id);
create index subscriptions_due_idx on public.subscriptions(status, next_billing_date);
create table public.subscription_lines (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  description text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0)
);
create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  event_type text not null,
  from_status public.subscription_status,
  to_status public.subscription_status,
  note text,
  actor uuid,
  created_at timestamptz not null default now()
);
alter table public.quotations add constraint quotations_sub_fk foreign key (converted_subscription_id) references public.subscriptions(id);
grant select on public.subscriptions, public.subscription_lines, public.subscription_events to authenticated;
grant all on public.subscriptions, public.subscription_lines, public.subscription_events to service_role;
alter table public.subscriptions enable row level security;
alter table public.subscription_lines enable row level security;
alter table public.subscription_events enable row level security;
create policy "read subscriptions" on public.subscriptions for select to authenticated using (public.is_staff(auth.uid()) or customer_id = public.my_customer_id());
create policy "read sub lines" on public.subscription_lines for select to authenticated using (exists (select 1 from public.subscriptions s where s.id = subscription_id and (public.is_staff(auth.uid()) or s.customer_id = public.my_customer_id())));
create policy "read sub events" on public.subscription_events for select to authenticated using (exists (select 1 from public.subscriptions s where s.id = subscription_id and (public.is_staff(auth.uid()) or s.customer_id = public.my_customer_id())));

-- ===== INVOICES =====
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default ('INV-' || nextval('public.invoice_number_seq')),
  customer_id uuid not null references public.customers(id),
  subscription_id uuid references public.subscriptions(id),
  customer_snapshot jsonb not null,
  invoice_date date not null default current_date,
  due_date date not null,
  period_start date,
  period_end date,
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0 check (total >= 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  status public.invoice_status not null default 'draft',
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, period_start),
  check (amount_paid <= total)
);
create index invoices_customer_idx on public.invoices(customer_id);
create index invoices_status_idx on public.invoices(status, due_date);
create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id),
  description text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null,
  line_subtotal numeric(14,2) not null,
  discount_amount numeric(14,2) not null default 0,
  tax_rate numeric(6,3) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null
);
grant select on public.invoices, public.invoice_lines to authenticated;
grant all on public.invoices, public.invoice_lines to service_role;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
create policy "read invoices" on public.invoices for select to authenticated using (public.is_staff(auth.uid()) or (customer_id = public.my_customer_id() and status <> 'draft'));
create policy "read invoice lines" on public.invoice_lines for select to authenticated using (exists (select 1 from public.invoices i where i.id = invoice_id and (public.is_staff(auth.uid()) or (i.customer_id = public.my_customer_id() and i.status <> 'draft'))));

create table public.discount_usages (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discounts(id),
  invoice_id uuid not null references public.invoices(id),
  amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (discount_id, invoice_id)
);
grant select on public.discount_usages to authenticated;
grant all on public.discount_usages to service_role;
alter table public.discount_usages enable row level security;
create policy "staff read usages" on public.discount_usages for select to authenticated using (public.is_staff(auth.uid()));

-- ===== PAYMENTS =====
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null unique default ('PAY-' || nextval('public.payment_number_seq')),
  customer_id uuid not null references public.customers(id),
  amount numeric(14,2) not null check (amount > 0),
  method public.payment_method not null,
  payment_date date not null default current_date,
  reference text,
  notes text,
  status public.payment_status not null default 'recorded',
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index payments_reference_uniq on public.payments (method, lower(reference)) where reference is not null and status = 'recorded';
create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  invoice_id uuid not null references public.invoices(id),
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);
grant select on public.payments, public.payment_allocations to authenticated;
grant all on public.payments, public.payment_allocations to service_role;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
create policy "read payments" on public.payments for select to authenticated using (public.is_staff(auth.uid()) or customer_id = public.my_customer_id());
create policy "read allocations" on public.payment_allocations for select to authenticated using (exists (select 1 from public.payments p where p.id = payment_id and (public.is_staff(auth.uid()) or p.customer_id = public.my_customer_id())));

-- ===== BILLING RUNS =====
create table public.billing_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('manual','scheduled')),
  status text not null default 'running' check (status in ('running','completed','completed_with_errors','failed')),
  run_date date not null default current_date,
  processed integer not null default 0,
  succeeded integer not null default 0,
  failed integer not null default 0,
  skipped integer not null default 0,
  triggered_by uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create table public.billing_run_items (
  id uuid primary key default gen_random_uuid(),
  billing_run_id uuid not null references public.billing_runs(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id),
  invoice_id uuid references public.invoices(id),
  status text not null check (status in ('success','failed','skipped')),
  message text,
  created_at timestamptz not null default now()
);
grant select on public.billing_runs, public.billing_run_items to authenticated;
grant all on public.billing_runs, public.billing_run_items to service_role;
alter table public.billing_runs enable row level security;
alter table public.billing_run_items enable row level security;
create policy "staff read runs" on public.billing_runs for select to authenticated using (public.is_staff(auth.uid()));
create policy "staff read run items" on public.billing_run_items for select to authenticated using (public.is_staff(auth.uid()));

-- ===== NOTIFICATIONS / AUDIT / DOCS =====
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  title text not null,
  body text,
  link text,
  email_status text not null default 'not_configured' check (email_status in ('not_configured','queued','sent','failed')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "mark own read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "admin read audit" on public.audit_logs for select to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.document_metadata (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  file_name text not null,
  storage_path text,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.document_metadata to authenticated;
grant all on public.document_metadata to service_role;
alter table public.document_metadata enable row level security;
create policy "staff read docs" on public.document_metadata for select to authenticated using (public.is_staff(auth.uid()));

alter publication supabase_realtime add table public.notifications;

-- <<< End of 0000_core_schema.sql <<<

-- >>> Start of 0001_business_logic.sql >>>

-- ===== helpers =====
create or replace function public.log_audit(_action text, _entity text, _id uuid, _meta jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs(actor, action, entity_type, entity_id, metadata) values (auth.uid(), _action, _entity, _id, coalesce(_meta,'{}'::jsonb));
$$;

create or replace function public.notify_user(_user uuid, _type text, _title text, _body text, _link text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _user is null then return; end if;
  insert into public.notifications(user_id, type, title, body, link) values (_user, _type, _title, _body, _link);
end $$;

create or replace function public.notify_staff(_type text, _title text, _body text, _link text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, type, title, body, link)
  select distinct user_id, _type, _title, _body, _link from public.user_roles where role = 'admin';
$$;

create or replace function public.freq_interval(_f public.billing_frequency)
returns interval language sql immutable as $$
  select case _f when 'daily' then interval '1 day' when 'weekly' then interval '1 week' when 'monthly' then interval '1 month' else interval '1 year' end
$$;

-- Anchored on the start date so month-end / leap days never drift (Jan 31 -> Feb 28/29 -> Mar 31).
create or replace function public.billing_date_for_cycle(_start date, _f public.billing_frequency, _cycle integer)
returns date language sql immutable as $$
  select (_start + (public.freq_interval(_f) * _cycle))::date
$$;

-- ===== generic audit trigger for configuration tables =====
create or replace function public.audit_config_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs(actor, action, entity_type, entity_id, metadata)
  values (auth.uid(), lower(tg_op), tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    case when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
         when tg_op = 'DELETE' then jsonb_build_object('before', to_jsonb(old))
         else jsonb_build_object('after', to_jsonb(new)) end);
  return coalesce(new, old);
end $$;
create trigger audit_products after insert or update or delete on public.products for each row execute function public.audit_config_change();
create trigger audit_plans after insert or update or delete on public.plans for each row execute function public.audit_config_change();
create trigger audit_taxes after insert or update or delete on public.tax_rules for each row execute function public.audit_config_change();
create trigger audit_discounts after insert or update or delete on public.discounts for each row execute function public.audit_config_change();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger t_products before update on public.products for each row execute function public.touch_updated_at();
create trigger t_plans before update on public.plans for each row execute function public.touch_updated_at();
create trigger t_taxes before update on public.tax_rules for each row execute function public.touch_updated_at();
create trigger t_discounts before update on public.discounts for each row execute function public.touch_updated_at();
create trigger t_profiles before update on public.profiles for each row execute function public.touch_updated_at();

-- discount used_count must only change through billing
create or replace function public.discounts_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.used_count is distinct from old.used_count and current_setting('app.billing', true) is distinct from 'on' then
    new.used_count := old.used_count;
  end if;
  if tg_op = 'INSERT' then new.used_count := 0; end if;
  return new;
end $$;
create trigger discounts_guard before insert or update on public.discounts for each row execute function public.discounts_guard();

-- ===== new user =====
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _name text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1));
  _invited text := new.raw_app_meta_data->>'invited_role';
begin
  insert into public.profiles(id, email, full_name) values (new.id, new.email, _name);
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  elsif _invited = 'staff' then
    insert into public.user_roles(user_id, role) values (new.id, 'staff');
  else
    insert into public.user_roles(user_id, role) values (new.id, 'customer');
    update public.customers set user_id = new.id where lower(email) = lower(new.email) and user_id is null;
    if not found then
      insert into public.customers(user_id, name, email) values (new.id, _name, new.email);
    end if;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.set_user_role(_user_id uuid, _role public.app_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Only administrators can change roles'; end if;
  if _user_id = auth.uid() then raise exception 'You cannot change your own role'; end if;
  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles(user_id, role) values (_user_id, _role);
  perform public.log_audit('role_change','user',_user_id, jsonb_build_object('role',_role));
end $$;

-- ===== pricing =====
create or replace function public.variant_unit_price(_product uuid, _variant uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select round(p.sales_price + coalesce((select v.extra_price from public.product_variants v where v.id = _variant and v.product_id = p.id), 0), 2)
  from public.products p where p.id = _product
$$;

create or replace function public.tax_rate_for(_product uuid, _on date)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(rate),0) from public.tax_rules
  where active and effective_from <= _on and (effective_to is null or effective_to >= _on)
    and (applies_to = 'all' or product_id = _product)
$$;

-- ===== subscriptions =====
create or replace function public.validate_plan(_plan uuid, _on date, _qty integer)
returns public.plans language plpgsql stable security definer set search_path = public as $$
declare p public.plans;
begin
  select * into p from public.plans where id = _plan;
  if not found then raise exception 'Plan not found'; end if;
  if p.status <> 'active' then raise exception 'Plan "%" is not active', p.name; end if;
  if p.available_from is not null and _on < p.available_from then raise exception 'Plan is only available from %', p.available_from; end if;
  if p.available_until is not null and _on > p.available_until then raise exception 'Plan was only available until %', p.available_until; end if;
  if _qty < p.min_quantity then raise exception 'Plan requires a minimum quantity of %', p.min_quantity; end if;
  return p;
end $$;

-- _lines: [{product_id, variant_id, quantity, unit_price?}]
create or replace function public.create_subscription(_customer uuid, _plan uuid, _start date, _expiry date, _payment_terms integer, _lines jsonb, _notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p public.plans; _sub uuid; l jsonb; _qty int := 0; _sum numeric := 0; _price numeric; _desc text;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorized'; end if;
  if not exists (select 1 from public.customers where id = _customer and status = 'active') then raise exception 'Customer not found or archived'; end if;
  if _lines is null or jsonb_array_length(_lines) = 0 then raise exception 'Add at least one product line'; end if;
  if _expiry is not null and _expiry < _start then raise exception 'Expiry date must be after start date'; end if;
  select coalesce(sum((x->>'quantity')::int),0) into _qty from jsonb_array_elements(_lines) x;
  p := public.validate_plan(_plan, _start, _qty);
  insert into public.subscriptions(customer_id, plan_id, billing_frequency, start_date, expiry_date, payment_terms_days, notes, created_by)
  values (_customer, _plan, p.billing_frequency, _start, _expiry, coalesce(_payment_terms,15), _notes, auth.uid()) returning id into _sub;
  for l in select * from jsonb_array_elements(_lines) loop
    if (l->>'quantity')::int <= 0 then raise exception 'Quantity must be positive'; end if;
    if not exists (select 1 from public.products where id = (l->>'product_id')::uuid and status = 'active') then raise exception 'Product is not active'; end if;
    _price := coalesce(nullif(l->>'unit_price','')::numeric, public.variant_unit_price((l->>'product_id')::uuid, nullif(l->>'variant_id','')::uuid));
    if _price < 0 then raise exception 'Unit price cannot be negative'; end if;
    select pr.name || coalesce(' (' || v.attribute || ': ' || v.value || ')','') into _desc
      from public.products pr left join public.product_variants v on v.id = nullif(l->>'variant_id','')::uuid where pr.id = (l->>'product_id')::uuid;
    insert into public.subscription_lines(subscription_id, product_id, variant_id, description, quantity, unit_price)
    values (_sub, (l->>'product_id')::uuid, nullif(l->>'variant_id','')::uuid, _desc, (l->>'quantity')::int, round(_price,2));
    _sum := _sum + round(_price,2) * (l->>'quantity')::int;
  end loop;
  _sum := _sum + p.price;
  update public.subscriptions set subtotal = _sum, total = _sum where id = _sub;
  insert into public.subscription_events(subscription_id, event_type, to_status, actor) values (_sub, 'created', 'draft', auth.uid());
  perform public.log_audit('create','subscription',_sub, jsonb_build_object('customer',_customer,'plan',_plan));
  return _sub;
end $$;

create or replace function public.transition_subscription(_sub uuid, _action text, _note text default null)
returns public.subscription_status language plpgsql security definer set search_path = public as $$
declare
  s public.subscriptions; p public.plans; _to public.subscription_status; _staff boolean := public.is_staff(auth.uid());
  _cust_user uuid;
begin
  select * into s from public.subscriptions where id = _sub for update;
  if not found then raise exception 'Subscription not found'; end if;
  if not _staff then
    if s.customer_id is distinct from public.my_customer_id() then raise exception 'Not authorized'; end if;
    if _action not in ('pause','resume','renew') then raise exception 'Customers can only pause, resume or renew'; end if;
  end if;
  select * into p from public.plans where id = s.plan_id;
  case _action
    when 'send_quotation' then if s.status <> 'draft' then raise exception 'Only drafts can be quoted'; end if; _to := 'quotation';
    when 'confirm' then if s.status not in ('draft','quotation') then raise exception 'Only draft or quotation subscriptions can be confirmed'; end if; _to := 'confirmed';
    when 'activate' then
      if s.status <> 'confirmed' then raise exception 'Only confirmed subscriptions can be activated'; end if;
      if s.expiry_date is not null and s.expiry_date < current_date then raise exception 'Subscription already past its expiry date'; end if;
      _to := 'active';
    when 'pause' then
      if s.status <> 'active' then raise exception 'Only active subscriptions can be paused'; end if;
      if not p.allow_pause then raise exception 'This plan does not allow pausing'; end if; _to := 'paused';
    when 'resume' then if s.status <> 'paused' then raise exception 'Only paused subscriptions can be resumed'; end if; _to := 'active';
    when 'close' then
      if s.status not in ('active','paused') then raise exception 'Only active or paused subscriptions can be closed'; end if;
      if (s.expiry_date is null or s.expiry_date > current_date) and not p.allow_early_close then raise exception 'This plan does not allow early closure'; end if;
      _to := 'closed';
    when 'cancel' then if s.status not in ('draft','quotation','confirmed','active','paused') then raise exception 'This subscription cannot be cancelled'; end if; _to := 'cancelled';
    when 'renew' then
      if s.status not in ('active','expired') then raise exception 'Only active or expired subscriptions can be renewed'; end if;
      if not p.allow_renew then raise exception 'This plan does not allow renewal'; end if;
      if s.expiry_date is null then raise exception 'Subscription has no expiry date to renew'; end if;
      _to := 'active';
    else raise exception 'Unknown action %', _action;
  end case;

  if _action = 'activate' then
    update public.subscriptions set status = _to, next_billing_date = public.billing_date_for_cycle(start_date, billing_frequency, cycles_billed), updated_at = now() where id = _sub;
  elsif _action = 'renew' then
    update public.subscriptions set status = 'active',
      expiry_date = (greatest(expiry_date, current_date) + (expiry_date - start_date))::date,
      next_billing_date = coalesce(next_billing_date, public.billing_date_for_cycle(start_date, billing_frequency, cycles_billed)),
      updated_at = now() where id = _sub;
  elsif _to in ('closed','cancelled') then
    update public.subscriptions set status = _to, next_billing_date = null, updated_at = now() where id = _sub;
  else
    update public.subscriptions set status = _to, updated_at = now() where id = _sub;
  end if;

  insert into public.subscription_events(subscription_id, event_type, from_status, to_status, note, actor) values (_sub, _action, s.status, _to, _note, auth.uid());
  perform public.log_audit('subscription_' || _action, 'subscription', _sub, jsonb_build_object('from', s.status, 'to', _to));
  select user_id into _cust_user from public.customers where id = s.customer_id;
  if _action in ('activate','renew','pause','resume','close','cancel') then
    perform public.notify_user(_cust_user, 'subscription_' || _action, 'Subscription ' || s.subscription_number || ' ' || _to::text,
      'Your subscription status is now ' || _to::text || '.', '/app/subscriptions/' || _sub);
  end if;
  return _to;
end $$;

-- ===== invoice generation for one subscription period (idempotent) =====
create or replace function public.generate_invoice_for_subscription(_sub uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s public.subscriptions; p public.plans; c public.customers; _inv uuid;
  _pstart date; _pend date; _sub_total numeric := 0; _qty int := 0;
  d public.discounts; _disc_total numeric := 0; _tax_total numeric := 0; l record;
  _line_disc numeric; _rate numeric; _line_tax numeric; _eligible_base numeric; _allocated numeric := 0; _n int; _i int := 0; _base_line numeric;
begin
  select * into s from public.subscriptions where id = _sub for update;
  if s.status <> 'active' then raise exception 'Subscription is not active'; end if;
  if s.next_billing_date is null or s.next_billing_date > current_date then raise exception 'Subscription is not due'; end if;
  select * into p from public.plans where id = s.plan_id;
  select * into c from public.customers where id = s.customer_id;
  _pstart := s.next_billing_date;
  _pend := (public.billing_date_for_cycle(s.start_date, s.billing_frequency, s.cycles_billed + 1) - 1);
  if s.expiry_date is not null and _pstart > s.expiry_date then raise exception 'Billing period starts after expiry'; end if;

  if exists (select 1 from public.invoices where subscription_id = _sub and period_start = _pstart) then
    -- already billed (retry) - just advance the schedule
    update public.subscriptions set cycles_billed = cycles_billed + 1,
      next_billing_date = public.billing_date_for_cycle(start_date, billing_frequency, cycles_billed + 1) where id = _sub;
    return (select id from public.invoices where subscription_id = _sub and period_start = _pstart);
  end if;

  insert into public.invoices(customer_id, subscription_id, customer_snapshot, invoice_date, due_date, period_start, period_end, status)
  values (s.customer_id, _sub,
    jsonb_build_object('name', c.name, 'email', c.email, 'company', c.company, 'address', c.address, 'phone', c.phone, 'tax_id', c.tax_id, 'customer_number', c.customer_number),
    current_date, current_date + s.payment_terms_days, _pstart, _pend, 'confirmed')
  returning id into _inv;

  select coalesce(sum(quantity * unit_price),0) + p.price, coalesce(sum(quantity),0) into _sub_total, _qty from public.subscription_lines where subscription_id = _sub;

  -- pick the single best eligible discount (no stacking)
  select * into d from public.discounts x
  where x.active and x.starts_on <= current_date and (x.ends_on is null or x.ends_on >= current_date)
    and (x.max_uses is null or x.used_count < x.max_uses)
    and _sub_total >= x.min_purchase and _qty >= x.min_quantity
    and (x.scope = 'subscription' or exists (select 1 from public.discount_products dp join public.subscription_lines sl on sl.product_id = dp.product_id where dp.discount_id = x.id and sl.subscription_id = _sub))
  order by case when x.discount_type = 'percentage' then _sub_total * x.value / 100 else x.value end desc
  limit 1;

  if d.id is not null then
    select coalesce(sum(sl.quantity * sl.unit_price),0) into _eligible_base from public.subscription_lines sl
      where sl.subscription_id = _sub and (d.scope = 'subscription' or sl.product_id in (select product_id from public.discount_products where discount_id = d.id));
    if d.scope = 'subscription' then _eligible_base := _eligible_base + p.price; end if;
    _disc_total := least(_eligible_base, round(case when d.discount_type = 'percentage' then _eligible_base * d.value / 100 else d.value end, 2));
    perform set_config('app.billing','on', true);
    update public.discounts set used_count = used_count + 1 where id = d.id and (max_uses is null or used_count < max_uses);
    if not found then _disc_total := 0; d := null; end if;
    perform set_config('app.billing','off', true);
  end if;

  -- plan base fee line
  if p.price > 0 then
    _line_disc := case when d.id is not null and d.scope = 'subscription' and _eligible_base > 0 then round(_disc_total * p.price / _eligible_base, 2) else 0 end;
    _allocated := _allocated + _line_disc;
    _rate := public.tax_rate_for(null, current_date);
    _line_tax := round((p.price - _line_disc) * _rate / 100, 2);
    insert into public.invoice_lines(invoice_id, product_id, description, quantity, unit_price, line_subtotal, discount_amount, tax_rate, tax_amount, line_total)
    values (_inv, null, 'Plan fee: ' || p.name, 1, p.price, p.price, _line_disc, _rate, _line_tax, p.price - _line_disc + _line_tax);
    _tax_total := _tax_total + _line_tax;
  end if;

  select count(*) into _n from public.subscription_lines sl where sl.subscription_id = _sub
    and d.id is not null and (d.scope = 'subscription' or sl.product_id in (select product_id from public.discount_products where discount_id = d.id));
  for l in select * from public.subscription_lines where subscription_id = _sub order by id loop
    _base_line := l.quantity * l.unit_price;
    _line_disc := 0;
    if d.id is not null and _eligible_base > 0 and (d.scope = 'subscription' or l.product_id in (select product_id from public.discount_products where discount_id = d.id)) then
      _i := _i + 1;
      if _i = _n then _line_disc := _disc_total - _allocated;  -- remainder to last line avoids rounding drift
      else _line_disc := round(_disc_total * _base_line / _eligible_base, 2); end if;
      _line_disc := least(_line_disc, _base_line);
      _allocated := _allocated + _line_disc;
    end if;
    _rate := public.tax_rate_for(l.product_id, current_date);
    _line_tax := round((_base_line - _line_disc) * _rate / 100, 2);
    insert into public.invoice_lines(invoice_id, product_id, description, quantity, unit_price, line_subtotal, discount_amount, tax_rate, tax_amount, line_total)
    values (_inv, l.product_id, l.description, l.quantity, l.unit_price, _base_line, _line_disc, _rate, _line_tax, _base_line - _line_disc + _line_tax);
    _tax_total := _tax_total + _line_tax;
  end loop;

  update public.invoices set subtotal = _sub_total, discount_amount = _allocated, tax_amount = _tax_total,
    total = greatest(_sub_total - _allocated + _tax_total, 0), confirmed_at = now() where id = _inv;
  if d.id is not null and _allocated > 0 then
    insert into public.discount_usages(discount_id, invoice_id, amount) values (d.id, _inv, _allocated);
  end if;

  update public.subscriptions set cycles_billed = cycles_billed + 1,
    next_billing_date = public.billing_date_for_cycle(start_date, billing_frequency, cycles_billed + 1), updated_at = now()
  where id = _sub;
  -- auto close / expiry
  update public.subscriptions set status = 'closed', next_billing_date = null
    where id = _sub and p.auto_close and p.auto_close_cycles is not null and cycles_billed >= p.auto_close_cycles;
  update public.subscriptions set next_billing_date = null
    where id = _sub and expiry_date is not null and next_billing_date > expiry_date;

  perform public.notify_user(c.user_id, 'invoice_created', 'New invoice for ' || s.subscription_number,
    'An invoice for the period ' || _pstart || ' to ' || _pend || ' has been issued.', '/app/invoices/' || _inv);
  perform public.log_audit('invoice_generated','invoice',_inv, jsonb_build_object('subscription', _sub, 'period_start', _pstart));
  return _inv;
end $$;

-- ===== billing run =====
create or replace function public.run_billing(_run_type text default 'manual')
returns uuid language plpgsql security definer set search_path = public as $$
declare _run uuid; s record; _inv uuid; _ok int := 0; _fail int := 0; _proc int := 0; _guard int;
begin
  if auth.uid() is not null and not public.is_staff(auth.uid()) then raise exception 'Not authorized'; end if;
  if auth.uid() is null and _run_type <> 'scheduled' then raise exception 'Not authorized'; end if;
  if not pg_try_advisory_xact_lock(hashtext('brightloop_billing')) then raise exception 'Another billing run is in progress'; end if;
  insert into public.billing_runs(run_type, triggered_by) values (_run_type, auth.uid()) returning id into _run;

  -- expire subscriptions past expiry
  for s in select id, status from public.subscriptions where status in ('active','paused') and expiry_date is not null and expiry_date < current_date loop
    update public.subscriptions set status = 'expired', next_billing_date = null where id = s.id;
    insert into public.subscription_events(subscription_id, event_type, from_status, to_status, note) values (s.id, 'expired', s.status, 'expired', 'Expired by billing run');
  end loop;

  -- overdue invoices
  update public.invoices set status = 'overdue', updated_at = now()
   where status in ('confirmed','partially_paid') and due_date < current_date and amount_paid < total;

  for s in select id, subscription_number from public.subscriptions where status = 'active' and next_billing_date is not null and next_billing_date <= current_date order by next_billing_date loop
    _guard := 0;
    -- catch up multiple missed periods, bounded
    while _guard < 24 and exists (select 1 from public.subscriptions where id = s.id and status = 'active' and next_billing_date is not null and next_billing_date <= current_date) loop
      _guard := _guard + 1; _proc := _proc + 1;
      begin
        _inv := public.generate_invoice_for_subscription(s.id);
        insert into public.billing_run_items(billing_run_id, subscription_id, invoice_id, status, message) values (_run, s.id, _inv, 'success', 'Invoice created');
        _ok := _ok + 1;
      exception when others then
        insert into public.billing_run_items(billing_run_id, subscription_id, status, message) values (_run, s.id, 'failed', sqlerrm);
        _fail := _fail + 1;
        exit;
      end;
    end loop;
  end loop;

  update public.billing_runs set processed = _proc, succeeded = _ok, failed = _fail, finished_at = now(),
    status = case when _fail > 0 then 'completed_with_errors' else 'completed' end where id = _run;
  if _fail > 0 then
    perform public.notify_staff('billing_failed', 'Billing run had failures', _fail || ' subscription(s) failed to bill.', '/app/billing');
  end if;
  perform public.log_audit('billing_run','billing_run',_run, jsonb_build_object('type',_run_type,'succeeded',_ok,'failed',_fail));
  return _run;
end $$;

-- ===== invoices =====
create or replace function public.cancel_invoice(_inv uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare i public.invoices;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorized'; end if;
  select * into i from public.invoices where id = _inv for update;
  if not found then raise exception 'Invoice not found'; end if;
  if i.status in ('paid','cancelled') then raise exception 'This invoice cannot be cancelled'; end if;
  if i.amount_paid > 0 then raise exception 'Reverse recorded payments before cancelling'; end if;
  update public.invoices set status = 'cancelled', cancelled_at = now(), updated_at = now() where id = _inv;
  perform public.log_audit('invoice_cancel','invoice',_inv, jsonb_build_object('reason',_reason));
end $$;

create or replace function public.confirm_invoice(_inv uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorized'; end if;
  update public.invoices set status = 'confirmed', confirmed_at = now(), updated_at = now() where id = _inv and status = 'draft';
  if not found then raise exception 'Only draft invoices can be confirmed'; end if;
  perform public.log_audit('invoice_confirm','invoice',_inv);
end $$;

create or replace function public.refresh_invoice_status(_inv uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _paid numeric; i public.invoices;
begin
  select * into i from public.invoices where id = _inv;
  select coalesce(sum(a.amount),0) into _paid from public.payment_allocations a join public.payments p on p.id = a.payment_id
    where a.invoice_id = _inv and p.status = 'recorded';
  update public.invoices set amount_paid = _paid, updated_at = now(),
    status = case when i.status in ('cancelled','draft') then i.status
                  when _paid >= i.total and i.total > 0 then 'paid'
                  when _paid > 0 and i.due_date < current_date then 'overdue'
                  when _paid > 0 then 'partially_paid'
                  when i.due_date < current_date then 'overdue'
                  else 'confirmed' end
  where id = _inv;
end $$;

-- ===== payments =====
create or replace function public.record_payment(_inv uuid, _amount numeric, _method public.payment_method, _date date, _reference text, _notes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare i public.invoices; _pay uuid; _uid uuid;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorized'; end if;
  select * into i from public.invoices where id = _inv for update;
  if not found then raise exception 'Invoice not found'; end if;
  if i.status in ('draft','cancelled','paid') then raise exception 'Payments cannot be recorded against a % invoice', i.status; end if;
  if _amount is null or _amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  _amount := round(_amount, 2);
  if _amount > i.total - i.amount_paid then raise exception 'Amount exceeds the outstanding balance of %', i.total - i.amount_paid; end if;
  if _date > current_date then raise exception 'Payment date cannot be in the future'; end if;
  insert into public.payments(customer_id, amount, method, payment_date, reference, notes, created_by)
  values (i.customer_id, _amount, _method, coalesce(_date, current_date), nullif(trim(_reference),''), _notes, auth.uid()) returning id into _pay;
  insert into public.payment_allocations(payment_id, invoice_id, amount) values (_pay, _inv, _amount);
  perform public.refresh_invoice_status(_inv);
  select user_id into _uid from public.customers where id = i.customer_id;
  perform public.notify_user(_uid, 'payment_recorded', 'Payment recorded for ' || i.invoice_number, 'A payment of ' || _amount || ' was recorded.', '/app/invoices/' || _inv);
  perform public.log_audit('payment_record','payment',_pay, jsonb_build_object('invoice',_inv,'amount',_amount,'method',_method));
  return _pay;
exception when unique_violation then
  raise exception 'A payment with this reference already exists for this method';
end $$;

create or replace function public.reverse_payment(_pay uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare p public.payments; a record;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Only administrators can reverse payments'; end if;
  if coalesce(trim(_reason),'') = '' then raise exception 'A reason is required'; end if;
  select * into p from public.payments where id = _pay for update;
  if not found or p.status <> 'recorded' then raise exception 'Payment not found or already reversed'; end if;
  update public.payments set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = _reason where id = _pay;
  for a in select invoice_id from public.payment_allocations where payment_id = _pay loop
    perform public.refresh_invoice_status(a.invoice_id);
  end loop;
  perform public.log_audit('payment_reverse','payment',_pay, jsonb_build_object('reason',_reason));
end $$;

-- ===== quotations =====
create or replace function public.create_quotation(_customer uuid, _plan uuid, _template uuid, _valid_until date, _lines jsonb, _notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _q uuid; l jsonb; _price numeric; _desc text; _sub numeric := 0; _tax numeric := 0; _qty int; p public.plans;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorized'; end if;
  if _lines is null or jsonb_array_length(_lines) = 0 then raise exception 'Add at least one product line'; end if;
  if _valid_until < current_date then raise exception 'Expiry date must be in the future'; end if;
  select coalesce(sum((x->>'quantity')::int),0) into _qty from jsonb_array_elements(_lines) x;
  p := public.validate_plan(_plan, current_date, _qty);
  insert into public.quotations(customer_id, plan_id, template_id, valid_until, notes, created_by)
  values (_customer, _plan, _template, _valid_until, _notes, auth.uid()) returning id into _q;
  for l in select * from jsonb_array_elements(_lines) loop
    if (l->>'quantity')::int <= 0 then raise exception 'Quantity must be positive'; end if;
    _price := round(coalesce(nullif(l->>'unit_price','')::numeric, public.variant_unit_price((l->>'product_id')::uuid, nullif(l->>'variant_id','')::uuid)),2);
    select pr.name || coalesce(' (' || v.attribute || ': ' || v.value || ')','') into _desc
      from public.products pr left join public.product_variants v on v.id = nullif(l->>'variant_id','')::uuid where pr.id = (l->>'product_id')::uuid;
    insert into public.quotation_lines(quotation_id, product_id, variant_id, description, quantity, unit_price, line_subtotal)
    values (_q, (l->>'product_id')::uuid, nullif(l->>'variant_id','')::uuid, _desc, (l->>'quantity')::int, _price, _price * (l->>'quantity')::int);
    _sub := _sub + _price * (l->>'quantity')::int;
    _tax := _tax + round(_price * (l->>'quantity')::int * public.tax_rate_for((l->>'product_id')::uuid, current_date) / 100, 2);
  end loop;
  _sub := _sub + p.price;
  _tax := _tax + round(p.price * public.tax_rate_for(null, current_date) / 100, 2);
  update public.quotations set subtotal = _sub, tax_amount = _tax, total = _sub + _tax where id = _q;
  perform public.log_audit('create','quotation',_q);
  return _q;
end $$;

create or replace function public.set_quotation_status(_q uuid, _status public.quotation_status)
returns void language plpgsql security definer set search_path = public as $$
declare q public.quotations;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorized'; end if;
  select * into q from public.quotations where id = _q for update;
  if q.status = 'converted' then raise exception 'Converted quotations cannot change'; end if;
  if _status = 'converted' then raise exception 'Use convert to create a subscription'; end if;
  if _status = 'accepted' and q.valid_until < current_date then raise exception 'Quotation has expired'; end if;
  update public.quotations set status = _status, updated_at = now() where id = _q;
  perform public.log_audit('quotation_' || _status, 'quotation', _q);
end $$;

create or replace function public.convert_quotation(_q uuid, _start date, _expiry date, _payment_terms integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare q public.quotations; _sub uuid; _lines jsonb;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorized'; end if;
  select * into q from public.quotations where id = _q for update;
  if not found then raise exception 'Quotation not found'; end if;
  if q.status = 'converted' or q.converted_subscription_id is not null then raise exception 'Quotation already converted'; end if;
  if q.status <> 'accepted' then raise exception 'Only accepted quotations can be converted'; end if;
  select jsonb_agg(jsonb_build_object('product_id', product_id, 'variant_id', variant_id, 'quantity', quantity, 'unit_price', unit_price)) into _lines
    from public.quotation_lines where quotation_id = _q;
  _sub := public.create_subscription(q.customer_id, q.plan_id, _start, _expiry, _payment_terms, _lines, 'From ' || q.quotation_number);
  update public.subscriptions set quotation_id = _q, status = 'confirmed' where id = _sub;
  insert into public.subscription_events(subscription_id, event_type, from_status, to_status, note, actor) values (_sub, 'confirm', 'draft', 'confirmed', 'Converted from ' || q.quotation_number, auth.uid());
  update public.quotations set status = 'converted', converted_subscription_id = _sub, updated_at = now() where id = _q;
  perform public.log_audit('quotation_convert','quotation',_q, jsonb_build_object('subscription',_sub));
  return _sub;
end $$;

-- ===== dashboard metrics =====
create or replace function public.dashboard_metrics(_from date default null, _to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorized'; end if;
  select jsonb_build_object(
    'customers', (select count(*) from customers where status = 'active'),
    'products', (select count(*) from products where status = 'active'),
    'active_plans', (select count(*) from plans where status = 'active'),
    'active_subs', (select count(*) from subscriptions where status = 'active'),
    'paused_subs', (select count(*) from subscriptions where status = 'paused'),
    'cancelled_subs', (select count(*) from subscriptions where status = 'cancelled'),
    'open_quotations', (select count(*) from quotations where status in ('draft','sent','accepted')),
    'upcoming_renewals', (select count(*) from subscriptions where status = 'active' and next_billing_date between current_date and current_date + 7),
    'mrr', (select coalesce(sum(case billing_frequency when 'daily' then total * 365 / 12.0 when 'weekly' then total * 52 / 12.0 when 'monthly' then total else total / 12.0 end),0) from subscriptions where status = 'active'),
    'invoiced', (select coalesce(sum(total),0) from invoices where status not in ('draft','cancelled') and (_from is null or invoice_date >= _from) and (_to is null or invoice_date <= _to)),
    'collected', (select coalesce(sum(amount),0) from payments where status = 'recorded' and (_from is null or payment_date >= _from) and (_to is null or payment_date <= _to)),
    'outstanding', (select coalesce(sum(total - amount_paid),0) from invoices where status in ('confirmed','partially_paid','overdue')),
    'overdue_count', (select count(*) from invoices where status = 'overdue' or (status in ('confirmed','partially_paid') and due_date < current_date)),
    'pending_invoices', (select count(*) from invoices where status in ('confirmed','partially_paid','overdue')),
    'status_distribution', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from subscriptions group by status) x),
    'revenue_trend', (select coalesce(jsonb_agg(row_to_json(t) order by t.month), '[]'::jsonb) from (
        select to_char(m, 'YYYY-MM') as month,
          (select coalesce(sum(total),0) from invoices where status not in ('draft','cancelled') and date_trunc('month', invoice_date) = m) as invoiced,
          (select coalesce(sum(amount),0) from payments where status = 'recorded' and date_trunc('month', payment_date) = m) as collected,
          (select count(*) from subscriptions where date_trunc('month', created_at) = m) as new_subs
        from generate_series(date_trunc('month', current_date) - interval '11 months', date_trunc('month', current_date), interval '1 month') m) t),
    'product_performance', (select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select pr.name, coalesce(sum(il.line_total),0) as revenue from invoice_lines il join invoices i on i.id = il.invoice_id and i.status not in ('draft','cancelled')
        join products pr on pr.id = il.product_id group by pr.name order by 2 desc limit 8) t)
  ) into r;
  r := r || jsonb_build_object('arr', (r->>'mrr')::numeric * 12);
  return r;
end $$;

-- ===== execute grants =====
revoke execute on all functions in schema public from public, anon;
grant execute on function public.has_role, public.is_staff, public.my_customer_id, public.set_user_role, public.variant_unit_price,
  public.create_subscription, public.transition_subscription, public.run_billing, public.cancel_invoice, public.confirm_invoice,
  public.record_payment, public.reverse_payment, public.create_quotation, public.set_quotation_status, public.convert_quotation,
  public.dashboard_metrics, public.billing_date_for_cycle, public.freq_interval to authenticated;

-- <<< End of 0001_business_logic.sql <<<

-- >>> Start of 0002_billing_cron.sql >>>
create extension if not exists pg_cron;
select cron.schedule('brightloop-daily-billing', '30 0 * * *', $$ select public.run_billing('scheduled'); $$);
-- <<< End of 0002_billing_cron.sql <<<

-- >>> Start of 0003_demo_mode_tables_and_generator.sql >>>

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

-- <<< End of 0003_demo_mode_tables_and_generator.sql <<<

-- >>> Start of 0004_email_logs_payment_transactions_import_batches.sql >>>

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  template text not null,
  subject text not null,
  status text not null default 'pending',
  provider text not null default 'resend',
  provider_id text,
  error text,
  idempotency_key text unique,
  meta jsonb not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

comment on column public.email_logs.status is 'pending | sent | failed | not_configured';

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id),
  customer_id uuid not null references public.customers(id),
  provider text not null default 'razorpay',
  order_id text unique,
  payment_id text,
  amount numeric not null,
  currency text not null default 'INR',
  status text not null default 'created',
  signature_verified boolean not null default false,
  payment_record_id uuid references public.payments(id),
  last_event_id text,
  raw jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.payment_transactions.status is 'created | paid | failed | refunded';

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  file_name text not null,
  total_rows integer not null default 0,
  imported integer not null default 0,
  failed integer not null default 0,
  skipped integer not null default 0,
  status text not null default 'completed',
  report jsonb not null default '[]',
  created_by uuid,
  created_at timestamptz not null default now()
);

grant select on public.email_logs to authenticated;
grant all on public.email_logs to service_role;
grant select on public.payment_transactions to authenticated;
grant all on public.payment_transactions to service_role;
grant select, insert on public.import_batches to authenticated;
grant all on public.import_batches to service_role;

alter table public.email_logs enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.import_batches enable row level security;

create policy "Admins read email logs" on public.email_logs for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Staff read payment transactions" on public.payment_transactions for select to authenticated using (public.is_staff(auth.uid()));
create policy "Customers read own payment transactions" on public.payment_transactions for select to authenticated using (customer_id = public.my_customer_id());
create policy "Admins manage import batches" on public.import_batches for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- <<< End of 0004_email_logs_payment_transactions_import_batches.sql <<<

-- >>> Start of 0005_demo_discount_products_and_generator_fix.sql >>>

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

-- <<< End of 0005_demo_discount_products_and_generator_fix.sql <<<

-- >>> Start of 0006_demo_dashboard_metrics_keys_and_verified_payment.sql >>>
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
-- <<< End of 0006_demo_dashboard_metrics_keys_and_verified_payment.sql <<<
