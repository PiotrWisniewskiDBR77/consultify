-- ============================================================================
-- Migration: 20260624_initiative_status_normalize.sql
-- Uspójnienie F1.12 — Normalizacja statusów inicjatyw + CHECK constraint
-- ----------------------------------------------------------------------------
-- CEL:
--   1. Doprowadzić kolumnę initiatives.status do jednej, kanonicznej listy
--      wartości (UPPERCASE) zgodnej z enumem InitiativeStatus w
--      server/src/constants/initiativeStatuses.ts.
--   2. Wypełnić title/name dla istniejących wierszy (F1.13) — żaden z tych
--      pól nie może być pusty, jeśli drugie jest wypełnione.
--   3. Założyć CHECK constraint pilnujący kanonicznej listy statusów, aby
--      przyszłe zapisy nie wprowadzały śmieci (np. 'step3', '', NULL).
--
-- WAŻNE — KOLEJNOŚĆ:
--   Backfill (kroki 1–2) MUSI wykonać się PRZED założeniem CHECK constraint
--   (krok 3). W przeciwnym razie ALTER TABLE ... ADD CONSTRAINT odrzuci
--   istniejące, niekanoniczne wiersze i cała migracja padnie. Dzięki
--   wcześniejszemu backfillowi w momencie zakładania constraintu wszystkie
--   wiersze są już zgodne — CHECK nie wywali istniejących danych.
--
-- BEZPIECZEŃSTWO / WDROŻENIE:
--   - Migracja jest IDEMPOTENTNA: backfille są warunkowe (WHERE), a CHECK
--     constraint zakładany jest tylko jeśli jeszcze nie istnieje (DO-block,
--     bo Postgres nie wspiera ADD CONSTRAINT IF NOT EXISTS).
--   - STOSOWAĆ NAJPIERW NA STAGING (caboose), zweryfikować liczby wierszy
--     dotknięte backfillem i dopiero potem na produkcji (centerbeam) — i to
--     wyłącznie za osobną, jawną zgodą.
--   - Lista kanoniczna (13 wartości, UPPERCASE) — SSOT
--     server/src/constants/initiativeStatuses.ts (enum InitiativeStatus):
--       DRAFT, PENDING_REVIEW, REVIEW, PROMOTED, PLANNING, APPROVED,
--       SCHEDULED, EXECUTING, BLOCKED, DONE, TRACKING, CANCELLED, ARCHIVED
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- KROK 0: Normalizacja wielkości liter.
-- Statusy są przechowywane UPPERCASE, ale na wszelki wypadek normalizujemy
-- istniejące wartości do UPPER() zanim ocenimy ich kanoniczność. To zapewnia,
-- że 'draft' / 'Draft' nie zostaną błędnie potraktowane jako nieprawidłowe.
-- ----------------------------------------------------------------------------
UPDATE initiatives
SET status = UPPER(status)
WHERE status IS NOT NULL
  AND status <> UPPER(status);

-- ----------------------------------------------------------------------------
-- KROK 1: Backfill nieprawidłowych statusów -> DRAFT.
-- Obejmuje: NULL, pusty string, znany śmieciowy 'step3' oraz każdą wartość
-- spoza listy kanonicznej (po normalizacji UPPER z kroku 0).
-- ----------------------------------------------------------------------------
UPDATE initiatives
SET status = 'DRAFT'
WHERE status IS NULL
   OR status = ''
   OR status = 'step3'
   OR UPPER(status) NOT IN (
        'DRAFT', 'PENDING_REVIEW', 'REVIEW', 'PROMOTED', 'PLANNING',
        'APPROVED', 'SCHEDULED', 'EXECUTING', 'BLOCKED', 'DONE',
        'TRACKING', 'CANCELLED', 'ARCHIVED'
      );

-- ----------------------------------------------------------------------------
-- KROK 2: Backfill title <-> name (F1.13 dla istniejących wierszy).
-- title kanonicznym polem wyświetlanym, name polem legacy. Uzupełniamy
-- brakujące z drugiego, gdzie tylko jedno jest wypełnione.
-- ----------------------------------------------------------------------------
UPDATE initiatives
SET title = name
WHERE (title IS NULL OR title = '')
  AND name IS NOT NULL
  AND name <> '';

UPDATE initiatives
SET name = title
WHERE (name IS NULL OR name = '')
  AND title IS NOT NULL
  AND title <> '';

-- ----------------------------------------------------------------------------
-- KROK 3: CHECK constraint pilnujący kanonicznej listy statusów.
-- Zakładany tylko jeśli jeszcze nie istnieje (idempotencja). Po wykonaniu
-- kroków 1–2 wszystkie wiersze są zgodne, więc constraint NIE odrzuci danych.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'initiatives_status_check'
  ) THEN
    ALTER TABLE initiatives
      ADD CONSTRAINT initiatives_status_check
      CHECK (
        UPPER(status) IN (
          'DRAFT', 'PENDING_REVIEW', 'REVIEW', 'PROMOTED', 'PLANNING',
          'APPROVED', 'SCHEDULED', 'EXECUTING', 'BLOCKED', 'DONE',
          'TRACKING', 'CANCELLED', 'ARCHIVED'
        )
      );
  END IF;
END $$;

COMMIT;
