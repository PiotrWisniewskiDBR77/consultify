-- PostgreSQL compatibility shim for legacy SQLite-first migrations that use
-- DEFAULT (datetime('now')). New migrations must use CURRENT_TIMESTAMP/NOW().

CREATE OR REPLACE FUNCTION public.datetime(input_value TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT CASE
    WHEN lower(input_value) = 'now' THEN CURRENT_TIMESTAMP::TEXT
    ELSE input_value
  END
$$;
