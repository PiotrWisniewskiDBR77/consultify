-- Audits — kernel metodyczny (Audit Pack → Program → Evidence → Finding →
-- Corrective Action → Verification → Output → Report → Initiative Proposal).
--
-- DLACZEGO:
-- Przed tą migracją moduł Audits miał wyłącznie płaski kontener `audit_programs`
-- (definicja programu + luźny JSON `config`) oraz dwie martwe tabele `audits` /
-- `audit_findings` (zero czytelników w kodzie). Nie istniał żaden obiekt
-- reprezentujący kryterium, dowód, wykonany test, ustalenie, odpowiedź
-- właściciela, działanie korygujące ani weryfikację skuteczności. Audyt dawał
-- się więc wykonać wyłącznie jako ankieta — czyli dokładnie to, czego karta
-- uzgodnienia MOD-AGR-04 zabrania (`docs/program/WEEKEND_COMPLETION_2026-08-01/
-- AGREEMENTS/04_AUDITS_REVIEW.md` §1, §9, §23).
--
-- Ta migracja wprowadza pełny łańcuch obronności:
--   criterion → question → evidence request → evidence → auditor test →
--   conclusion → conformity → finding → management response → corrective
--   action → verification → closure
-- oraz rejestr źródeł normatywnych z prawami/licencją, bez którego nie wolno
-- opublikować pakietu jako `VERIFIED_NORMATIVE`.
--
-- FORWARD-ONLY I ADDYTYWNA: każda instrukcja to CREATE TABLE IF NOT EXISTS /
-- ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS, więc ponowne
-- uruchomienie jest no-opem, a wycofanie polega na jej nieaplikowaniu (istniejące
-- wiersze `audit_programs` działają dalej z NULL-owymi referencjami do pakietu i
-- są traktowane przez odczyt jako `legacy`).
--
-- NAZEWNICTWO: prefiks `20260813_` umieszcza plik w fazie DATED runnera
-- `server/scripts/migrate.postgres.ts` (po całej fazie NUMBERED i po wszystkich
-- wcześniejszych plikach dated). Numer < 500 byłby cicho pominięty przez
-- `isSqliteOnlyMigration()` — dokładnie tak, jak dziś pomijane są
-- `044_multi_framework_audit.sql` i `046_compliance.sql`.
--
-- WIELOTENANTOWOŚĆ: repo nie używa RLS w żadnej tabeli; izolacja jest
-- aplikacyjna (`WHERE organization_id = ?`). Każda tabela poniżej niesie
-- `organization_id`, aby ten wzorzec dało się egzekwować i testować deny-path.

-- ---------------------------------------------------------------------------
-- 0. Domknięcie istniejącego korzenia
-- ---------------------------------------------------------------------------
-- `audit_programs` nie miała dotąd wersjonowanego DDL — powstawała leniwie w
-- `auditProgramService.ensureSchema()` oraz jednorazowo w zrzucie
-- `20260719_baseline_gap.sql`. Powtarzamy tu jej definicję (IF NOT EXISTS), aby
-- kolejne ALTER-y były bezpieczne na instalacji od zera niezależnie od tego,
-- czy serwis zdążył się uruchomić.

CREATE TABLE IF NOT EXISTS audit_programs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  objective TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  preset TEXT,
  config TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_programs_org
  ON audit_programs (organization_id);

-- ---------------------------------------------------------------------------
-- 1. Rejestr źródeł normatywnych
-- ---------------------------------------------------------------------------
-- Bez wiersza w tej tabeli pakiet nie może zostać opublikowany jako
-- normatywny. `rights_status` i `verification_status` są rozdzielone celowo:
-- organizacja może mieć prawa do dokumentu, którego mapowanie nie zostało
-- jeszcze zatwierdzone przez eksperta — i odwrotnie.

CREATE TABLE IF NOT EXISTS audit_norm_sources (
  id TEXT PRIMARY KEY,
  organization_id TEXT,                    -- NULL = źródło systemowe/globalne
  source_key TEXT NOT NULL,                -- stabilny klucz, np. 'iso-19011'
  title TEXT NOT NULL,
  publisher TEXT,
  source_version TEXT,                     -- edycja/rok wydania, np. '2018'
  source_kind TEXT NOT NULL DEFAULT 'internal_procedure',
    -- normative_standard | internal_procedure | checklist | regulation | demonstration
  rights_status TEXT NOT NULL DEFAULT 'not_verified',
    -- licensed | owned_internal | public_reference | not_verified | not_permitted
  rights_note TEXT,
  license_reference TEXT,
  source_uri TEXT,
  material_id TEXT,                        -- dokument źródłowy w Materials
  material_version TEXT,
  effective_from DATE,
  effective_to DATE,
  verification_status TEXT NOT NULL DEFAULT 'EVIDENCE_MISSING',
    -- VERIFIED_NORMATIVE | INTERNAL_FRAMEWORK | DEMONSTRATION | LEGACY | EVIDENCE_MISSING
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  verification_note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- COALESCE, bo NULL nie koliduje w zwykłym UNIQUE — dwa źródła globalne o tym
-- samym kluczu przeszłyby niezauważone.
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_norm_sources_key
  ON audit_norm_sources (COALESCE(organization_id, '__global__'), source_key, COALESCE(source_version, '__none__'));
CREATE INDEX IF NOT EXISTS idx_audit_norm_sources_org
  ON audit_norm_sources (organization_id);

-- ---------------------------------------------------------------------------
-- 2. Audit Pack — wersjonowany przepis na audyt
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_packs (
  id TEXT PRIMARY KEY,
  organization_id TEXT,                    -- NULL = pakiet systemowy
  pack_key TEXT NOT NULL,                  -- tożsamość stabilna między wersjami
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  summary TEXT,
  purpose TEXT,
  source_id TEXT REFERENCES audit_norm_sources (id) ON DELETE SET NULL,
  source_version TEXT,
  classification TEXT NOT NULL DEFAULT 'EVIDENCE_MISSING',
    -- VERIFIED_NORMATIVE | INTERNAL_FRAMEWORK | DEMONSTRATION | LEGACY | EVIDENCE_MISSING
  publication_status TEXT NOT NULL DEFAULT 'draft',
    -- draft | in_review | published | deprecated
  scope TEXT,
  objectives TEXT,
  audit_type TEXT,                         -- compliance | process | supplier | internal | due_diligence
  required_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_competencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  workflow JSONB NOT NULL DEFAULT '{}'::jsonb,
  finding_taxonomy JSONB NOT NULL DEFAULT '[]'::jsonb,
  severity_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  decision_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  sampling_guidance TEXT,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  report_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  corrective_action_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  verification_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_duration_days INTEGER,
  recurrence_default TEXT,
  effective_from DATE,
  effective_to DATE,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  expert_approved_by TEXT,
  expert_approved_at TIMESTAMPTZ,
  expert_approval_note TEXT,
  published_by TEXT,
  published_at TIMESTAMPTZ,
  deprecated_at TIMESTAMPTZ,
  supersedes_pack_id TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_packs_key_version
  ON audit_packs (COALESCE(organization_id, '__global__'), pack_key, version);
CREATE INDEX IF NOT EXISTS idx_audit_packs_org_status
  ON audit_packs (organization_id, publication_status);
CREATE INDEX IF NOT EXISTS idx_audit_packs_classification
  ON audit_packs (classification);

-- Hierarchia kryteriów pakietu. `requirement_text` jest WŁASNYM sformułowaniem
-- wymagania, nie kopią treści normy — `source_reference` wskazuje miejsce w
-- źródle, dzięki czemu audyt zachowuje traceability bez reprodukcji dokumentu
-- objętego prawami autorskimi.
CREATE TABLE IF NOT EXISTS audit_pack_criteria (
  id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL REFERENCES audit_packs (id) ON DELETE CASCADE,
  parent_id TEXT,
  ordinal INTEGER NOT NULL DEFAULT 0,
  ref_code TEXT,                           -- np. 'A.5.1'
  node_kind TEXT NOT NULL DEFAULT 'criterion',
    -- domain | clause | control | criterion
  title TEXT NOT NULL,
  requirement_text TEXT,
  source_reference TEXT,
  audit_question TEXT,
  expected_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  audit_procedure TEXT,
  sampling_guidance TEXT,
  applicability_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  weight NUMERIC,
  suggested_owner_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_pack_criteria_pack
  ON audit_pack_criteria (pack_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_audit_pack_criteria_parent
  ON audit_pack_criteria (parent_id);

-- ---------------------------------------------------------------------------
-- 3. Program audytowy — rozszerzenie istniejącego korzenia
-- ---------------------------------------------------------------------------

ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS pack_id TEXT;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS pack_key TEXT;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS pack_version INTEGER;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS lifecycle_state TEXT;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS scope_text TEXT;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS scope_json JSONB;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS criteria_snapshot_at TIMESTAMPTZ;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS planned_start DATE;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS planned_end DATE;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS program_owner_id TEXT;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS lead_auditor_id TEXT;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS recurrence TEXT;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS previous_program_id TEXT;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS closed_by TEXT;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS closure_note TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_programs_pack
  ON audit_programs (organization_id, pack_id);
CREATE INDEX IF NOT EXISTS idx_audit_programs_lifecycle
  ON audit_programs (organization_id, lifecycle_state);

-- Role w programie. Segregation of duties jest egzekwowana w warstwie serwisu,
-- ale musi mieć tu swoje dane: kto jest audytowanym, kto zatwierdza, kto
-- weryfikuje skuteczność i czy zadeklarował niezależność.
CREATE TABLE IF NOT EXISTS audit_program_members (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  member_role TEXT NOT NULL,
    -- program_owner | lead_auditor | auditor | technical_expert | auditee
    -- | evidence_owner | reviewer | action_owner | administrator | viewer
  scope_note TEXT,
  independence_declared BOOLEAN NOT NULL DEFAULT FALSE,
  conflict_note TEXT,
  competence_note TEXT,
  assigned_by TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_program_members
  ON audit_program_members (program_id, user_id, member_role);
CREATE INDEX IF NOT EXISTS idx_audit_program_members_org
  ON audit_program_members (organization_id, program_id);
CREATE INDEX IF NOT EXISTS idx_audit_program_members_user
  ON audit_program_members (organization_id, user_id);

-- ---------------------------------------------------------------------------
-- 4. Snapshot kryteriów w programie + praca audytora
-- ---------------------------------------------------------------------------
-- To jest jądro obronności audytu. Każdy wiersz trzyma OSOBNO: wymaganie,
-- odniesienie do źródła, pytanie, oczekiwany dowód, wykonaną procedurę, próbę,
-- wynik testu, notatkę, wniosek audytora i decyzję o zgodności. Zlanie tych
-- pól w jedną „odpowiedź" zamieniłoby audyt w ankietę.
--
-- Snapshot (a nie FK do `audit_pack_criteria`) jest celowy: publikacja nowej
-- wersji pakietu nie może po cichu zmienić trwającego audytu.

CREATE TABLE IF NOT EXISTS audit_program_criteria (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  pack_criterion_id TEXT,
  parent_id TEXT,
  ordinal INTEGER NOT NULL DEFAULT 0,
  ref_code TEXT,
  node_kind TEXT NOT NULL DEFAULT 'criterion',
  title TEXT NOT NULL,

  -- snapshot z pakietu
  requirement_text TEXT,
  source_reference TEXT,
  audit_question TEXT,
  expected_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  audit_procedure TEXT,
  sampling_guidance TEXT,
  mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  weight NUMERIC,

  -- stosowalność
  applicable BOOLEAN NOT NULL DEFAULT TRUE,
  not_applicable_reason TEXT,

  -- przypisania
  assigned_auditor_id TEXT,
  assigned_auditee_id TEXT,

  -- praca audytee
  auditee_response TEXT,
  auditee_responded_by TEXT,
  auditee_responded_at TIMESTAMPTZ,

  -- praca audytora (rozdzielona co do pola)
  procedure_performed TEXT,
  sample_description TEXT,
  test_performed TEXT,
  test_result TEXT,                        -- pass | fail | partial | inconclusive
  auditor_note TEXT,
  auditor_conclusion TEXT,
  conformity_status TEXT NOT NULL DEFAULT 'not_tested',
    -- not_tested | conforming | nonconforming | observation
    -- | opportunity_for_improvement | not_applicable | evidence_insufficient
  concluded_by TEXT,
  concluded_at TIMESTAMPTZ,

  work_status TEXT NOT NULL DEFAULT 'open',
    -- open | evidence_requested | evidence_received | tested | concluded
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_program_criteria_program
  ON audit_program_criteria (organization_id, program_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_audit_program_criteria_status
  ON audit_program_criteria (organization_id, program_id, conformity_status);
CREATE INDEX IF NOT EXISTS idx_audit_program_criteria_parent
  ON audit_program_criteria (parent_id);

-- ---------------------------------------------------------------------------
-- 5. Evidence request i Evidence
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_evidence_requests (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  criterion_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  expected_evidence_kind TEXT,
  requested_from_user_id TEXT,
  requested_by TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open',
    -- open | responded | fulfilled | overdue | cancelled
  task_id TEXT,                            -- projekcja do My Work
  fulfilled_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_evidence_requests_program
  ON audit_evidence_requests (organization_id, program_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_evidence_requests_criterion
  ON audit_evidence_requests (criterion_id);
CREATE INDEX IF NOT EXISTS idx_audit_evidence_requests_assignee
  ON audit_evidence_requests (organization_id, requested_from_user_id, status);

-- Materials jest właścicielem pliku; Audits jest właścicielem UŻYCIA pliku jako
-- dowodu. Dlatego trzymamy wskazanie konkretnej wersji materiału oraz hash
-- migawki — późniejsza zmiana pliku nie może niejawnie zmienić podstawy
-- historycznego ustalenia (MOD-AGR-04 §15).
CREATE TABLE IF NOT EXISTS audit_evidence (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  criterion_id TEXT,
  request_id TEXT,
  evidence_kind TEXT NOT NULL DEFAULT 'document',
    -- document | interview_answer | observation | system_export | screenshot
    -- | interview_statement | note | sample
  title TEXT NOT NULL,
  description TEXT,

  -- provenance
  material_id TEXT,
  material_version TEXT,
  interview_assignment_id TEXT,
  external_reference TEXT,
  content_snapshot TEXT,
  content_hash TEXT,
  source_system TEXT,

  provided_by TEXT,
  provided_at TIMESTAMPTZ,
  captured_by TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_from DATE,
  period_to DATE,

  -- ocena audytora
  sufficiency TEXT,                        -- sufficient | insufficient | unknown
  reliability TEXT,                        -- reliable | questionable | unknown
  currency_status TEXT,                    -- current | outdated | unknown
  supports_conformity BOOLEAN,             -- NULL = nieoceniony; FALSE = dowód przeczący
  review_note TEXT,
  accepted BOOLEAN,
  accepted_by TEXT,
  accepted_at TIMESTAMPTZ,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_evidence_program
  ON audit_evidence (organization_id, program_id);
CREATE INDEX IF NOT EXISTS idx_audit_evidence_criterion
  ON audit_evidence (criterion_id);
CREATE INDEX IF NOT EXISTS idx_audit_evidence_request
  ON audit_evidence (request_id);

-- ---------------------------------------------------------------------------
-- 6. Findings
-- ---------------------------------------------------------------------------
-- Nowa tabela zamiast rozszerzania martwej `audit_findings`: tamta wiąże się z
-- tabelą `audits` (inny, porzucony korzeń) i nie ma organizacji ustaleń wobec
-- kryterium. `audit_findings` pozostaje nietknięta jako legacy; mapowanie
-- realizuje warstwa odczytu.

CREATE TABLE IF NOT EXISTS audit_program_findings (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  criterion_id TEXT,
  reference_code TEXT,

  statement TEXT NOT NULL,                 -- ustalenie
  requirement_text TEXT,                   -- stan oczekiwany
  condition_text TEXT,                     -- stan stwierdzony
  source_reference TEXT,
  gap_text TEXT,
  objective_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,  -- lista audit_evidence.id
  contradicting_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,

  classification TEXT NOT NULL DEFAULT 'nonconforming',
    -- wartość z taksonomii pakietu; kernel nie narzuca jednej listy
  severity TEXT,                           -- informational | low | medium | high | critical
  risk_text TEXT,
  impact_text TEXT,
  recommendation TEXT,

  root_cause TEXT,
  root_cause_method TEXT,
  root_cause_confirmed BOOLEAN NOT NULL DEFAULT FALSE,

  status TEXT NOT NULL DEFAULT 'draft',
    -- draft | in_review | confirmed | response_pending | remediation_in_progress
    -- | verification_pending | closed | risk_accepted | rejected
  owner_user_id TEXT,                      -- Finding Owner (strona audytowana)
  author_id TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  sent_back_at TIMESTAMPTZ,
  sent_back_by TEXT,
  send_back_reason TEXT,

  ai_proposed BOOLEAN NOT NULL DEFAULT FALSE,
  ai_rationale TEXT,
  ai_confidence NUMERIC,

  residual_risk TEXT,
  residual_risk_accepted_by TEXT,
  residual_risk_accepted_at TIMESTAMPTZ,
  residual_risk_note TEXT,

  recurring_from_finding_id TEXT,
  closed_at TIMESTAMPTZ,
  closed_by TEXT,
  closure_decision TEXT,                   -- closed_verified | risk_accepted | withdrawn
  closure_note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_program_findings_program
  ON audit_program_findings (organization_id, program_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_program_findings_criterion
  ON audit_program_findings (criterion_id);
CREATE INDEX IF NOT EXISTS idx_audit_program_findings_owner
  ON audit_program_findings (organization_id, owner_user_id);

CREATE TABLE IF NOT EXISTS audit_management_responses (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT 'accept',
    -- accept | partially_accept | reject | request_clarification
  statement TEXT NOT NULL,
  responded_by TEXT,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'submitted',
    -- draft | submitted | accepted | returned
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_management_responses_finding
  ON audit_management_responses (organization_id, finding_id);

-- ---------------------------------------------------------------------------
-- 7. Działania naprawcze i weryfikacja
-- ---------------------------------------------------------------------------
-- `action_kind` rozdziela korekcję skutku od działania korygującego przyczynę —
-- to rozróżnienie jest wymogiem MOD-AGR-04 §17 i bez niego „naprawa" nie da się
-- odróżnić od zamiecenia problemu.

CREATE TABLE IF NOT EXISTS audit_corrective_actions (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  action_kind TEXT NOT NULL DEFAULT 'corrective_action',
    -- correction | containment | corrective_action | preventive_action
  title TEXT NOT NULL,
  description TEXT,
  owner_user_id TEXT,
  due_date DATE,
  priority TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',
    -- proposed | approved | in_progress | implemented | verified | rejected | cancelled | overdue
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,

  task_id TEXT,                            -- read-back z My Work
  initiative_id TEXT,                      -- read-back z Initiatives
  proposal_id TEXT,                        -- lokalny Initiative Proposal Draft

  implementation_evidence_id TEXT,
  implemented_at TIMESTAMPTZ,
  implemented_by TEXT,
  implementation_note TEXT,

  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_corrective_actions_finding
  ON audit_corrective_actions (organization_id, finding_id);
CREATE INDEX IF NOT EXISTS idx_audit_corrective_actions_owner
  ON audit_corrective_actions (organization_id, owner_user_id, status);

CREATE TABLE IF NOT EXISTS audit_verifications (
  id TEXT PRIMARY KEY,
  corrective_action_id TEXT,
  finding_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  verification_kind TEXT NOT NULL DEFAULT 'effectiveness',
    -- implementation | effectiveness
  method TEXT,                             -- document_review | observation | resample | kpi | revisit
  planned_date DATE,
  performed_at TIMESTAMPTZ,
  performed_by TEXT,
  evidence_id TEXT,
  result TEXT,                             -- effective | partially_effective | not_effective | inconclusive
  note TEXT,
  independence_ok BOOLEAN,
  independence_note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_verifications_finding
  ON audit_verifications (organization_id, finding_id, verification_kind);
CREATE INDEX IF NOT EXISTS idx_audit_verifications_action
  ON audit_verifications (corrective_action_id);

-- ---------------------------------------------------------------------------
-- 8. Output (niezmienny) i Report (deliverable)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_outputs (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash TEXT,
  pack_id TEXT,
  pack_version INTEGER,
  finalized_by TEXT,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_by TEXT,
  superseded_at TIMESTAMPTZ,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_outputs_program_version
  ON audit_outputs (program_id, version);
CREATE INDEX IF NOT EXISTS idx_audit_outputs_org
  ON audit_outputs (organization_id, program_id);

CREATE TABLE IF NOT EXISTS audit_reports (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  output_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  report_kind TEXT NOT NULL DEFAULT 'audit_report',
    -- audit_report | remediation_progress
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
    -- draft | in_review | approved | published | superseded
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash TEXT,
  template_key TEXT,
  language TEXT,
  audience TEXT,
  confidentiality TEXT,
  material_id TEXT,                        -- eksport w Materials
  generated_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  superseded_by TEXT,
  snapshot_date DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_reports_program
  ON audit_reports (organization_id, program_id, report_kind);
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_reports_program_kind_version
  ON audit_reports (program_id, report_kind, version);

-- ---------------------------------------------------------------------------
-- 9. Initiative Proposal Drafts (lokalne, przed rejestracją)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_initiative_proposals (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  title TEXT NOT NULL,
  problem_statement TEXT,
  systemic_cause TEXT,
  intended_outcome TEXT,
  scope TEXT,
  priority TEXT,
  proposed_owner_id TEXT,
  timeframe TEXT,
  dependencies TEXT,
  success_measures JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_finding_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  verification_link TEXT,
  confidence NUMERIC,
  status TEXT NOT NULL DEFAULT 'draft',
    -- draft | sent_to_candidates | registered | deferred | dismissed
  registered_initiative_id TEXT,
  registered_at TIMESTAMPTZ,
  feedback_note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_initiative_proposals_program
  ON audit_initiative_proposals (organization_id, program_id, status);

-- ---------------------------------------------------------------------------
-- 10. Ścieżka audytowa domeny i propozycje Teresy
-- ---------------------------------------------------------------------------
-- Techniczny `audit_events` obsługuje platformę; ta tabela zapisuje zdarzenia
-- BIZNESOWE audytu (kto zmienił kryterium, wniosek, severity, kto zatwierdził)
-- w postaci czytelnej dla raportu i dla kontroli niezależności.

CREATE TABLE IF NOT EXISTS audit_domain_events (
  id TEXT PRIMARY KEY,
  program_id TEXT,
  organization_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  actor_role TEXT,
  summary TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_domain_events_program
  ON audit_domain_events (organization_id, program_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_domain_events_entity
  ON audit_domain_events (entity_type, entity_id);

-- Teresa: Intent → Preview → Human confirmation → Commit → Settle.
-- Propozycja nigdy nie zmienia rekordu docelowego sama z siebie; commit jest
-- osobnym, autoryzowanym krokiem, a `preview` przechowuje dokładnie ten
-- fragment, który zobaczył człowiek.
CREATE TABLE IF NOT EXISTS audit_ai_proposals (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
    -- criterion | evidence_request | finding | corrective_action | report_section | note
  target_id TEXT,
  intent TEXT NOT NULL,
  proposal JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale TEXT,
  confidence NUMERIC,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
    -- pending | accepted | rejected | superseded | expired
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  committed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audit_ai_proposals_program
  ON audit_ai_proposals (organization_id, program_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_ai_proposals_target
  ON audit_ai_proposals (target_type, target_id);
