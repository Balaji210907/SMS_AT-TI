create extension if not exists pg_cron;
select cron.schedule('brightloop-daily-billing', '30 0 * * *', $$ select public.run_billing('scheduled'); $$);