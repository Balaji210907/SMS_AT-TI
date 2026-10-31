
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
