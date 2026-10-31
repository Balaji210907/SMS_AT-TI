
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
