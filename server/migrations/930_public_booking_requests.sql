-- 930_public_booking_requests.sql
-- #24c — Publiczny widget booking (Calendly-like, lead-gen).
--
-- ADDYTYWNA, NIE-AUTO-APPLY. Numer 9xx CELOWO poza wzorcem auto-runnera
-- DatabaseInitializer (`/^(7\d{2}|\d{8})_.*\.sql$/`), więc NIE uruchamia się
-- przy starcie. Odpalić ręcznie na TROLLEY/demo dopiero po akcepcie Piotra.
--
-- Przechowuje zgłoszenia rezerwacji od NIEZALOGOWANYCH osób z publicznej strony
-- /book/:consultantSlug. Nie dotyka v8_calendar_items (rezerwacja = "tentative"
-- lead, nie zaakceptowane wydarzenie w kalendarzu konsultanta).

CREATE TABLE IF NOT EXISTS public_booking_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  consultant_slug TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  topic TEXT,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  timezone TEXT DEFAULT 'Europe/Warsaw',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | cancelled
  notified_channel TEXT,                  -- 'email' | 'stored' (jak dostarczono info)
  source_utm TEXT,                        -- opcjonalna atrybucja lead-gen (JSON string)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_public_booking_org
  ON public_booking_requests(organization_id);

CREATE INDEX IF NOT EXISTS idx_public_booking_slug_start
  ON public_booking_requests(consultant_slug, start_at);

CREATE INDEX IF NOT EXISTS idx_public_booking_status
  ON public_booking_requests(status);
