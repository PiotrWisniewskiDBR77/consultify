-- RED-C W4 (odbiór 2026-07-19): DEPRECATED router /api/assessment-workflow
-- (server/src/routes/assessment/assessment-workflow.routes.ts — NIE -v2, wciąż
-- zamontowany w Gateway.ts i wołany przez żywe FE komponenty: WorkflowStatusBar,
-- VersionHistoryPanel, AxisCommentsPanel, ActivityLogPanel, SubmitForReviewModal,
-- ReviewFeedbackPanel, useAssessmentCollaboration, useAssessmentWorkflow,
-- MultiFrameworkStageGateModal, useMultiFrameworkStore, src/services/api.ts)
-- 500-uje na KAŻDYM endponcie, bo req.user.organizationId jest tekstowe
-- (np. 'odbior--org-0001'), a assessment_workflows.organization_id jest INTEGER
-- (odziedziczone z martwej migracji 010_assessment_workflow.sql.sql, powielone
-- w 20260716_odbior_500_fixes.sql) → Postgres 22P02 invalid input syntax for
-- integer na KAŻDYM query z WHERE/INSERT organization_id.
--
-- Reszta systemu (organizations.id, assessments.organization_id,
-- assessment_initiative_batches.organization_id, projects.id,
-- assessments.project_id) jest TEXT — assessment_workflows jest jedyną tabelą
-- z tym typem. Tabela jest pusta na demo/parity (0 wierszy) — bezpieczna migracja
-- typu bez ryzyka utraty danych (integer->text jest lossless castem, USING
-- pokrywa też ewentualne dane).
--
-- Druga część (RED-C W4, initiative-batches): GET /api/assessment-workflow-v2/
-- :assessmentId/initiative-batches (server/src/routes/assessment-workflow-v2.routes.ts)
-- czyta b.methodology_id / b.include_chat_context / b.generated_by — kolumny,
-- których NIE MA na demo/parity (żywa tabela ma tylko kolumny z migracji 730 +
-- ręcznych hotfixów: organization_id/batch_name/status/initiatives_count/
-- created_by/updated_at/report_id/run_id) → Postgres 42703 undefined column.
-- Migracje 293/505/512 (SSOT-owe źródło tych kolumn) NIGDY nie odpaliły —
-- numeracja poza regexem DatabaseInitializer /^(7\d{2}|\d{8})_/, więc kod z
-- kolumnami z tamtych plików jest fantomem. Fix: dodać brakujące kolumny
-- addytywnie (zgodnie z oryginalnym zamiarem 293/505/512), zamiast przepisywać
-- zapytanie na kolumny, które nie niosą tej samej semantyki (methodology_id
-- /include_chat_context/generated_by nie mają dziś żadnego odpowiednika w
-- realnym schemacie — to metadane historii generowania batcha, nie da się ich
-- bezpiecznie zmapować na batch_name/created_by).
--
-- Prefiks daty (8 cyfr) → wpada w autorun DatabaseInitializer /^(7\d{2}|\d{8})_/.

ALTER TABLE assessment_workflows ALTER COLUMN organization_id TYPE TEXT USING organization_id::text;
ALTER TABLE assessment_workflows ALTER COLUMN project_id TYPE TEXT USING project_id::text;

ALTER TABLE assessment_initiative_batches ADD COLUMN IF NOT EXISTS methodology_id TEXT;
ALTER TABLE assessment_initiative_batches ADD COLUMN IF NOT EXISTS include_chat_context INTEGER DEFAULT 1;
ALTER TABLE assessment_initiative_batches ADD COLUMN IF NOT EXISTS generated_by TEXT;
