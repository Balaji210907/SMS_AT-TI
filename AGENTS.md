# BrightLoop Subscription Management System - Architecture Guide

## Architecture Rules
- All financial and lifecycle writes (subscriptions, invoices, payments, quotations, billing runs, roles) go through SECURITY DEFINER Postgres functions in `public` that check roles themselves; why: atomic, idempotent, and enforced regardless of client.
- Catalog/config tables (products, plans, taxes, discounts, customers) are written directly from the client under admin/staff RLS; audit triggers log changes.
- Billing dates are computed from the subscription start date and cycle count (`billing_date_for_cycle`), never chained; why: avoids month-end drift.
- Invoices are unique per (subscription, period_start) and snapshot customer, price, tax rate and discount; why: retries never double-bill and history never changes.
- Recurring billing runs daily via pg_cron calling `run_billing('scheduled')`.
- Staff accounts are created by an admin-only server function that sets `app_metadata.invited_role`; the signup trigger assigns roles (first user becomes admin).
