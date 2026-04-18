-- Feedback audit: ai-teresa-runtime cluster progress
-- Commit: d85b1d70f fix(ai-teresa-runtime): surface org interview answers + evidence in chat prompt
-- Scope: #1b81d375 CRIT, #2f5803b0 CRIT, #30592ee0 HIGH, #fa158b06 HIGH
-- Railway upload API was intermittently timing out at audit write time.
-- Commit is on origin/develop; deploy will pick up on next Railway availability.

BEGIN;

WITH items(id, label, root_cause, fix_note) AS (
  VALUES
    (
      '1b81d375-8461-4396-843a-81d0bf8fae30',
      'Aplix - dane z VTS',
      'Chat bound to org ''vts'' had no project_id, so _buildAssessmentContext returned null. organization_context_items (interview_answer rows, uploaded PDFs, manual notes) existed but were never read by the AI pipeline — searchOrgMemory was only wired into tests. resolvedContext.signals.interviewFindings was already pre-formatted but AIPipeline.buildOrganizationSection dropped the entire signals+evidence payload before assembling the prompt.',
      'Read last 60 organization_context_items scoped to the org (visibility organization/public), group into compact snapshot (8 Q&As, 5 evidence, 5 notes, 5 extractions, truncated), expose as contextItemsSample. Added prompt sections "Ustalenia z wywiadów" and "Dane zebrane od organizacji" so Teresa can quote actual tenant Q&As + reference uploaded evidence filenames.'
    ),
    (
      '2f5803b0-b99c-439e-8cd2-369b8031b889',
      'Brak danych Atelier',
      'Same mechanism as #1b81d375 — ateliertoys-demo org had no project-bound chat, so the tenant''s collected data never reached the prompt.',
      'Covered by the same aiContextBuilder + AIPipeline change. Atelier''s interview answers and uploads are now surfaced in the org section of every chat for that tenant.'
    ),
    (
      '30592ee0-612f-454a-8106-41719f337161',
      'Pliki - Teresa',
      'Uploaded files were persisted as organization_context_items(source_type=interview_evidence) but the chat prompt never listed them, so Teresa couldn''t acknowledge their existence. UI-language drift was a secondary symptom (Teresa replied in Polish regardless of UI locale — tracked separately via the i18n fix already shipped).',
      'Evidence titles (+ fileType) now appear under "Załączone dowody / pliki" in the system prompt. Teresa can now reference uploaded file names in answers.'
    ),
    (
      'fa158b06-45da-4c63-bd8e-4e23ffb5c87a',
      'Brak możliwości pracy na plikach w chat',
      'Teresa denied access to attached documents because the prompt had no awareness of organization_context_items evidence rows. Compounded: _buildAssessmentContext returned null for project-less chats.',
      'Evidence rows now flow into the prompt via contextItemsSample; Teresa can quote uploaded filenames and will no longer blanket-refuse document work. Deeper RAG-over-file-content remains a separate track (doc_ingestion bucket is surfaced too once ingestion writes rows into organization_context_items).'
    )
)
UPDATE feedback_items fi
SET
  status = 'IN_PROGRESS',
  updated_at = NOW(),
  metadata_json = (
    COALESCE(fi.metadata_json::jsonb, '{}'::jsonb)
    || jsonb_build_object(
      'workflow',
      jsonb_build_object(
        'timeline',
        COALESCE(fi.metadata_json::jsonb -> 'workflow' -> 'timeline', '[]'::jsonb)
        || jsonb_build_array(
          jsonb_build_object(
            'at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'actor', 'cto-agent',
            'event', 'IN_PROGRESS',
            'cluster', 'ai-teresa-runtime',
            'commit', 'd85b1d70f',
            'root_cause', items.root_cause,
            'fix', items.fix_note,
            'files', jsonb_build_array(
              'server/src/services/aiContextBuilder.ts',
              'server/src/services/ai/AIPipeline.ts'
            )
          )
        )
      )
    )
  )::text
FROM items
WHERE fi.id::text = items.id;

COMMIT;
