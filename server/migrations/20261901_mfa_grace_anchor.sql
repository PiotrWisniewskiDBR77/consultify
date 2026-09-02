-- =====================================================================
-- 20261901_mfa_grace_anchor.sql
-- =====================================================================
-- POWOD POWSTANIA (defekt 2026-09-02, zamkniete kolo logowania)
--   organizations.mfa_required odmawialo logowania kazdemu czlonkowi bez
--   drugiego skladnika (AuthController.login), a jedyna sciezka
--   skonfigurowania drugiego skladnika (/api/mfa/setup) stoi ZA tym
--   logowaniem. Wlasciciel nie mogl wejsc do wlasnego produktu.
--   organizations.mfa_grace_period_days istnialo od poczatku i bylo
--   zwracane w ciele ODMOWY jako "gracePeriodRemaining", ale nie bylo
--   ZADNEJ daty, od ktorej te dni mozna odliczyc — wiec karencja nigdy
--   nie dzialala, byla stala konfiguracyjna wpisana w odmowe.
--
-- CO ROBI TA MIGRACJA
--   Dodaje kotwice czasu: mfa_required_since. Od niej (a dokladniej od
--   pozniejszej z pary: kotwica organizacji / data zalozenia konta) liczy
--   sie karencja w server/src/services/mfaGracePolicy.ts.
--
-- BACKFILL (jedyny UPDATE, celowy i waski)
--   Organizacje, ktore JUZ maja mfa_required = 1, nie maja kotwicy —
--   powstala ona dopiero teraz. Bez backfillu ich czlonkowie zostaliby z
--   kotwica = data zalozenia konta, czyli z karencja wyczerpana w dniu
--   wdrozenia i z ta sama sciana co dzis. Backfill ustawia kotwice na
--   moment uruchomienia migracji: kazda taka organizacja dostaje pelne
--   mfa_grace_period_days na realne wdrozenie drugiego skladnika.
--   Organizacje z mfa_required = 0 nie sa ruszane (kotwice ustawi dopiero
--   wlaczenie wymogu).
--
-- BEZPIECZENSTWO: ADD COLUMN IF NOT EXISTS + jeden warunkowy UPDATE
--   ograniczony do wierszy mfa_required = 1 AND mfa_required_since IS NULL.
--   Zero DROP, zero zmiany typu istniejacej kolumny, idempotentne.
-- =====================================================================

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS mfa_required_since TIMESTAMP;

UPDATE organizations
   SET mfa_required_since = CURRENT_TIMESTAMP
 WHERE COALESCE(mfa_required, 0) = 1
   AND mfa_required_since IS NULL;
