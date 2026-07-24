-- 931_interview_insight_section_overrides.sql
--
-- ETAP karty INSIGHT (decyzja właściciela 2026-07-23, pkt 1):
-- „każda sekcja Insightu dostaje pole do ręcznej edycji" (standard n-Type
-- §6.2–6.4). Do dziś treść Insightu była WYŁĄCZNIE generowana przez AI
-- (`content` / `*_json`), a jedyną drogą jej zmiany była pełna regeneracja
-- (`POST /interview/insights/:id/regenerate`) — czyli nadpisanie całości.
-- Ręczna redakcja pojedynczej sekcji nie miała gdzie usiąść.
--
-- ── DLACZEGO NOWA KOLUMNA, A NIE REUŻYCIE ISTNIEJĄCEJ ────────────────────────
-- Przejrzano wszystkie kolumny `interview_insights` (305 + 20260719_baseline_gap):
--   · content, executive_summary          — WYNIK generacji; nadpisywane przez
--                                           regenerate ⇒ ręczny tekst by zginął,
--   · themes/issues/opportunities/…_json  — struktury domenowe o twardym kształcie,
--   · generation_context_json             — wejście generacji (co AI dostało),
--   · section_completions                 — Record<string, boolean> (Mark Complete);
--                                           wciśnięcie tam tekstu złamałoby typ
--                                           i istniejących konsumentów.
-- Nie ma wolnego, semantycznie neutralnego miejsca ⇒ osobna kolumna JSON-w-TEXT,
-- ADDYTYWNA (NULL dla wszystkich istniejących wierszy = zero zmiany zachowania).
--
-- ── KSZTAŁT ─────────────────────────────────────────────────────────────────
--   { "<sectionId>": { "content": "<tekst>", "updatedAt": "<ISO>", "updatedBy": "<userId>" }, ... }
-- Klucz = render-id sekcji z `INSIGHT_SECTIONS` (InsightViewer.tsx), ten sam,
-- którego używa `section_completions` — jeden słownik id dla obu map.
--
-- ── BEZPIECZEŃSTWO ──────────────────────────────────────────────────────────
-- ADD COLUMN IF NOT EXISTS + TEXT NULL = brak przepisywania tabeli w Postgresie
-- (brak DEFAULT ⇒ metadata-only), brak locka na dane, brak rollbacku danych.
-- Kod serwera i tak trzyma lazy-guard (`ensureInsightSectionOverridesColumn`,
-- wzór `section_completions`), więc endpoint działa również zanim ta migracja
-- zostanie uruchomiona. Migracja jest formalnym zapisem schematu, nie warunkiem.
--
-- ★ NIEURUCHOMIONA na żadnej bazie (demo/prod) — do wykonania przez nadzorcę
--   sesji głównej wg skilla `consultify-promocja-demo`.

ALTER TABLE interview_insights
    ADD COLUMN IF NOT EXISTS section_overrides TEXT;

COMMENT ON COLUMN interview_insights.section_overrides IS
    'Ręczna redakcja treści sekcji Insightu (standard n-Type §6.2). JSON: { sectionId: { content, updatedAt, updatedBy } }. NULL = brak nadpisań, sekcja pokazuje wyłącznie treść z AI.';
