-- Z-63 / DEC-513: durable display name for Method Core sessions.
-- Additive and idempotent. Existing sessions remain NULL and keep the UI fallback.
ALTER TABLE public.method_sessions
  ADD COLUMN IF NOT EXISTS name text;
