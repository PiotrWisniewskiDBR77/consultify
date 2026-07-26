-- 20260726: Users interface language preference (P0.3 Materiały — plan dokończenia)
--
-- PROBLEM: język UI był ustalany wyłącznie na urządzeniu (i18next
-- detection.order: localStorage -> navigator -> htmlTag, patrz src/i18n.ts).
-- Konto usera NIE MIAŁO żadnego pola z językiem interfejsu, więc polskie
-- konto na przeglądarce z locale=en-* / pustym localStorage dostawało 100%
-- angielski ekran mimo że tłumaczenia PL są kompletne.
--
-- ROZWIĄZANIE: nowa kolumna users.language staje się SSOT wyższego
-- priorytetu: konto > localStorage > navigator. Kolumna jest opcjonalna
-- (NULL = brak jawnej preferencji), więc dotychczasowe zachowanie
-- (localStorage/navigator) zostaje bez zmian dopóki użytkownik/konto nie
-- ma zapisanej wartości. Zapis następuje: (a) automatycznie przy pierwszej
-- ręcznej zmianie języka w ustawieniach, (b) ręcznie przez ekran ustawień
-- języka — patrz src/services/languagePreference.ts (changeLanguageAndPersist)
-- i src/services/languagePreference.ts (syncLanguageFromAccount, wołane z
-- App.tsx przy bootstrapie sesji).
--
-- Additive + idempotentna (ADD COLUMN IF NOT EXISTS). Serwer ma też runtime
-- self-healing odpowiednik w ensureUsersProfileColumns()
-- (server/src/controllers/UserController.ts) — ta migracja jest kanoniczna
-- dla środowisk ze schema-managed deployem (nazwa pliku pasuje do wzorca
-- auto-run `^(7\d{2}|\d{8})_.*\.sql$`, patrz DatabaseInitializer.ts:3198).

ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT;

-- Częściowy indeks — tylko konta z jawną preferencją (większość wierszy
-- zostanie NULL przez długi czas po wdrożeniu).
CREATE INDEX IF NOT EXISTS idx_users_language ON users (language) WHERE language IS NOT NULL;
