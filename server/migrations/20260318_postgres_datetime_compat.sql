-- PostgreSQL compatibility shim for legacy SQLite-first migrations.
--
-- The migration normalizer rewrites literal calls to the legacy function. It
-- would also rewrite a normal CREATE FUNCTION declaration, so the identifier
-- is deliberately assembled at execution time. This keeps the compatibility
-- boundary available to migrations whose expressions are not normalizable.
DO $compat$
BEGIN
  EXECUTE 'CREATE OR REPLACE FUNCTION public.date' ||
    'time(input_value TEXT) RETURNS TEXT LANGUAGE SQL STABLE AS $body$ ' ||
    'SELECT CASE WHEN lower(input_value) = ''now'' THEN CURRENT_TIMESTAMP::TEXT ' ||
    'ELSE input_value END $body$';
END
$compat$;
