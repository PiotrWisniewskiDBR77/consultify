-- Workflow Engine — draft→review→approved dla ARTEFAKTÓW na approval_assignments (HP-7)
-- SSOT: Harvard/wdrozenie-100/_PLAN_HARVEY_PARITY_2026-07-11.md §Blok B (HP-6/HP-7/HP-9)
--
-- AUDYT (HP-6, przed napisaniem tej migracji):
--   * approval_assignments dziś niesie WYŁĄCZNIE zatwierdzenia propozycji akcji AI
--     (proposal_id -> action_decisions), egzekwowane przez slaService.ts (cron,
--     jedyny AKTYWNY caller — server/src/cron/Scheduler.ts) i workqueueService.ts
--     (CRUD assignApproval/acknowledgeApproval/completeApproval — ZERO aktywnych
--     callerów poza samym plikiem, potwierdzone grepem).
--   * PMO stage-gates (stageGateService.ts, READINESS/DESIGN/PLANNING/EXECUTION/
--     CLOSURE_GATE) mieszkają w OSOBNEJ tabeli `stage_gates` (INSERT w
--     stageGateService.ts:420) — approval_assignments NIE jest przez nie używana.
--     Wniosek: rozszerzenie poniżej ma ZERO powierzchni nakładania z PMO gates,
--     bo PMO gates nie czyta/pisze tej tabeli w ogóle.
--   * Migracja 905_artifact_evidence.sql (Evidence Layer, HP-D) wspomina wzorzec
--     "zwornik D4 rozszerza approval_assignments (subject_type/subject_id)" jako
--     ZAPOWIEDŹ, ale żadna migracja 900-930 / 2026* faktycznie tej kolumny nie
--     dodała (potwierdzone grepem po całym server/migrations/) — brak kolizji.
--
-- BUDOWA (HP-7): dyskryminator `assignment_kind` ('project_gate' — wartość
-- domyślna, zachowuje znaczenie wszystkich istniejących wierszy — | 'artifact')
-- + polimorficzna para artifact_type/artifact_id (nullable, wypełniana tylko
-- dla assignment_kind='artifact'). Katalog artifact_type otwarty, spójny z
-- artifact_evidence (905) — bez CHECK constraint, żeby nowy archetyp SPEC-A
-- nie wymagał migracji schematu.
--
-- Defensywnie: ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS na każdym
-- kroku — fresh-replay bezpieczny, no-op na środowisku gdzie już zastosowane.

ALTER TABLE approval_assignments
  ADD COLUMN IF NOT EXISTS assignment_kind TEXT NOT NULL DEFAULT 'project_gate';

ALTER TABLE approval_assignments
  ADD COLUMN IF NOT EXISTS artifact_type TEXT;

ALTER TABLE approval_assignments
  ADD COLUMN IF NOT EXISTS artifact_id TEXT;

-- Belt-and-suspenders: gdyby kolumna powstała na starszym silniku bez wsparcia
-- dla inline DEFAULT na ADD COLUMN (nie dotyczy PG/SQLite nowoczesnych, ale
-- zgodnie z doktryną hartowania migracji 07-14 — nie zakładamy). No-op tam,
-- gdzie DEFAULT już zadziałał.
UPDATE approval_assignments
   SET assignment_kind = 'project_gate'
 WHERE assignment_kind IS NULL;

CREATE INDEX IF NOT EXISTS idx_approval_assignments_kind
  ON approval_assignments(assignment_kind);

CREATE INDEX IF NOT EXISTS idx_approval_assignments_artifact
  ON approval_assignments(artifact_type, artifact_id);
