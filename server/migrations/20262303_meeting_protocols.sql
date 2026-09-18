-- MTG-2 rework etap 2a / DEC-607 (U-52, DEC-592 pkt 5) — protokół jest
-- DOKUMENTEM: wersjonowany, zatwierdzany, zamrożony po akcepcie prowadzącego.
--
-- Addytywna, idempotentna migracja z puli stanowiska D (20262300-20262319).
-- GO: KANAL.md [D] Wpis 100 (2026-09-17 20:36 CDT), „Zgoda na migracje".
--
-- Model wersji (P3 z PROPOZYCJA.md, rekomendacja przyjęta w KROK 0):
--   draft        — protokół wygenerowany z danych spotkania, edytowalny,
--   approved     — po akcepcie prowadzącego: wersja 1.0 ZAMROŻONA,
--   każda kolejna edycja zatwierdzonego tworzy NOWY wiersz 1.1 z erratą
--   (errata_note), poprzednia wersja zostaje nietknięta (historia wersji).
-- content_json = zrzut 8 bloków protokołu w chwili zapisu (archetyp B);
-- source_digest = skrót danych źródłowych do wykrywania rozjazdu po edycji.
-- [ODMROZENIE 08_MEETINGS DEC-607]

CREATE TABLE IF NOT EXISTS meeting_protocols (
    id                  TEXT PRIMARY KEY,
    organization_id     TEXT NOT NULL,
    meeting_id          TEXT NOT NULL,
    version             TEXT NOT NULL DEFAULT '1.0',
    status              TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'approved')),
    content_json        TEXT NOT NULL DEFAULT '{}',
    source_digest       TEXT,
    approved_by_user_id TEXT,
    approved_at         TEXT,
    errata_note         TEXT DEFAULT '',
    created_by          TEXT NOT NULL,
    created_at          TEXT DEFAULT (now()::text),
    updated_at          TEXT DEFAULT (now()::text),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

-- Jedna wersja protokołu na spotkanie (chroni przed duplikatem v1.0 itd.).
CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_protocols_meeting_version
    ON meeting_protocols (meeting_id, version);
CREATE INDEX IF NOT EXISTS idx_meeting_protocols_org
    ON meeting_protocols (organization_id);
CREATE INDEX IF NOT EXISTS idx_meeting_protocols_meeting
    ON meeting_protocols (meeting_id);
