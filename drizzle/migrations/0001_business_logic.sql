
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
