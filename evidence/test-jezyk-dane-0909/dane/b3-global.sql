\pset pager off
with tab as (
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'organization_id' and a.attnum>0
  where c.relkind = 'r'
), m as (
  select relname,
    (xpath('/row/c/text()', query_to_xml(
      format($f$select count(*) c from public.%I where organization_id::text = '468b234c-66c4-54e1-b626-5e0fb3a92f6a'$f$, relname),
      false, true, '')))[1]::text::bigint as n
  from tab
)
select relname, n from m where n > 0 order by n desc, relname;
