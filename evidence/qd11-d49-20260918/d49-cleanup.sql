-- ============================================================================
-- QD11 / D-49 — Higiena danych pokazowych Northwind (RUNBOOK, idempotentny)
-- ----------------------------------------------------------------------------
-- Źródło długu: DLUG-PO-MVP.md D-49 (17.09), karty akcepty-wdr23 IS-2.png / RP1.png.
-- Mandat QD11 (KOLEJKI-DO-KONCA-20260918, kolumna Qoder D): "TYLKO symulacja na
-- kopii + skrypt idempotentny, kasowanie po słowie CTO; staging nietknięty".
--
-- Org: Northwind Manufacturing Ltd. = 468b234c-66c4-54e1-b626-5e0fb3a92f6a
--
-- KROK 0 (pomiar na kopii dumpu staging-pre-wdrozenie29-20260918T2052.dump):
--  (a) interview_questions: 2 wiersze z answer_text = 'asdf asdf qwerty nie wiem 123'
--      w sesji 13c932b0-e750-410c-996b-66a98f8fb234 ("Interview 9/16/2026";
--      "Process Pain Mapping" z karty = TEMAT szablonu, nie nazwa sesji w bazie):
--        233ae4ce-7069-4578-899c-f20fc0fcbb9d  ("Where do handoffs ... cause the most")
--        e563ed82-c572-4829-8206-158f3d2f5a96  ("What workarounds have you ... created")
--  (b) execution_report_snapshots: 1 wiersz 'Execution report — CTO smoke 17.09'
--        6099f51a-57a8-40ed-b3d3-966bb1565dd7  status=DRAFT definition_key=initiative-card
--      (karta D-49 cytowała id cb92a63b + status "Frozen" — w aktualnym dumpie ten id
--       NIE istnieje; autorytatywny fakt: 6099f51a, status DRAFT, subtitle payloadu
--       "Frozen snapshot of delivery data"). Tabela NIE ma dzieci FK → hard-delete bezpieczny.
--      Kolateral (NIE ruszać): 2 legit snapshoty NW — c3771f1b (weekly-exec, PUBLISHED),
--       ea011375 (program-health, DRAFT).
--
-- DECYZJE wymagające słowa CTO (skrypt implementuje wariant REKOMENDOWANY):
--  (a) treść zamiast śmieci: REKOMENDACJA = przepisać na spójne z istniejącym narrative
--      demo (VSM warehouse-outbound) odpowiedzi EN. Tekst PROPOZYCJI poniżej — do akceptu
--      lub edycji CTO. Alternatywa bez fabricacji: wyzerować answer_text i cofnąć status.
--  (b) przemianować CZY usunąć: REKOMENDACJA = USUNĄĆ (polityka "zero rekordów testowych",
--      DRAFT-duplikat opublikowanej treści, brak dzieci FK). Alternatywa: patrz blok RENAME.
--
-- Idempotencja: każdy warunek WHERE kotwiczy na WARTOŚCI ŚMIECI (a) lub na tytule
-- 'CTO smoke' (b) → 2. przebieg po wyczyszczeniu dopasuje 0 wierszy.
-- Kopia przed-zmiany: tabela d49_cleanup_backup (before-image jsonb).
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS d49_cleanup_backup (
  captured_at timestamptz NOT NULL DEFAULT now(),
  tbl         text        NOT NULL,
  row_id      text        NOT NULL,
  row_json    jsonb       NOT NULL
);

-- ---- (a) backup before-image of the 2 junk answers -------------------------
INSERT INTO d49_cleanup_backup (tbl, row_id, row_json)
SELECT 'interview_questions', q.id::text, to_jsonb(q)
FROM public.interview_questions q
WHERE q.organization_id = '468b234c-66c4-54e1-b626-5e0fb3a92f6a'
  AND q.answer_text = 'asdf asdf qwerty nie wiem 123'
  AND q.id IN ('233ae4ce-7069-4578-899c-f20fc0fcbb9d','e563ed82-c572-4829-8206-158f3d2f5a96');

-- ---- (b) backup before-image of the CTO smoke snapshot ---------------------
INSERT INTO d49_cleanup_backup (tbl, row_id, row_json)
SELECT 'execution_report_snapshots', s.id::text, to_jsonb(s)
FROM public.execution_report_snapshots s
WHERE s.organization_id = '468b234c-66c4-54e1-b626-5e0fb3a92f6a'
  AND s.id = '6099f51a-57a8-40ed-b3d3-966bb1565dd7'
  AND s.title ILIKE '%CTO smoke%';

-- ---- (a) REWRITE junk answers with proposed EN content (CTO to approve) -----
UPDATE public.interview_questions
SET answer_text = 'The goods-in to putaway handoff and the pick-release-to-line handoff cause the most delay. Picks wait on batch release scheduling, and outbound staging exists purely as a buffer against truck scheduling variance.',
    updated_at  = now()
WHERE organization_id = '468b234c-66c4-54e1-b626-5e0fb3a92f6a'
  AND id = '233ae4ce-7069-4578-899c-f20fc0fcbb9d'
  AND answer_text = 'asdf asdf qwerty nie wiem 123';

UPDATE public.interview_questions
SET answer_text = 'Shift leads keep a manual spreadsheet of fast-moving SKUs because the WMS slots them behind slow-moving stock, and the goods-out team re-sequences picks by hand to cut travel distance.',
    updated_at  = now()
WHERE organization_id = '468b234c-66c4-54e1-b626-5e0fb3a92f6a'
  AND id = 'e563ed82-c572-4829-8206-158f3d2f5a96'
  AND answer_text = 'asdf asdf qwerty nie wiem 123';

-- ---- (b) DELETE the CTO smoke snapshot (RECOMMENDED variant) ---------------
DELETE FROM public.execution_report_snapshots
WHERE organization_id = '468b234c-66c4-54e1-b626-5e0fb3a92f6a'
  AND id = '6099f51a-57a8-40ed-b3d3-966bb1565dd7'
  AND title ILIKE '%CTO smoke%';

-- ---- (b) ALTERNATIVE: RENAME instead of delete (CTO uncomment, comment DELETE above)
-- UPDATE public.execution_report_snapshots
-- SET title = 'Northwind 2027 — initiative card snapshot, week 37'
-- WHERE organization_id = '468b234c-66c4-54e1-b626-5e0fb3a92f6a'
--   AND id = '6099f51a-57a8-40ed-b3d3-966bb1565dd7'
--   AND title ILIKE '%CTO smoke%';

COMMIT;
