-- i18n-teresa cluster: mark 7 items as IN_PROGRESS with fix commit reference.
--
-- Fix commit: 01db3a879 "fix(ai/i18n-teresa): enforce UI language across AIPipeline prompt chain"
-- Branch:     develop
-- Deploy:     railway up --detach --service consultify --environment staging (2026-04-18)
-- Build ID:   893b7766-7527-4cc3-b520-72dd5e38c9b6
--
-- Next: verify on staging (Aplix, Chrome, EN UI). If green → status=RESOLVED.

BEGIN;

UPDATE feedback_items SET
  status = 'IN_PROGRESS',
  workflow_updated_at = NOW(),
  metadata_json = (
    jsonb_set(
      jsonb_set(
        COALESCE(metadata_json::jsonb, '{}'::jsonb),
        '{workflow}',
        COALESCE(metadata_json::jsonb->'workflow', '{}'::jsonb)
          || jsonb_build_object(
            'owner', 'cursor',
            'source', 'cursor',
            'branch', 'develop',
            'commit', '01db3a879',
            'deployTargets', jsonb_build_array('staging'),
            'deployStatus', 'in-flight',
            'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ),
        true
      ),
      '{workflow,timeline}',
      COALESCE(metadata_json::jsonb->'workflow'->'timeline', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'actor', 'cursor-cto-i18n-fix-2026-04-18',
          'action', 'fix',
          'details', 'Commit 01db3a879: removed Polish "Preferowany język" memory leak, replaced conflicting auto-detect rules, made persona default en, plumbed request.language into AIPipeline, strict [LANGUAGE INSTRUCTION] now last directive. Deployed to staging (build 893b7766).'
        )),
      true
    )
  )::text
WHERE id IN (
  'eb4ad332-9677-4391-9f4b-016855fb8296',
  '34439bbc-2730-45b1-99d4-91ff5ffb2de8',
  '1291ee7a-60a1-41fc-9bd5-b9ad6a82c84d',
  'e9a84e7f-280d-4b4f-a9ec-f804e1b5501a',
  '81b674c9-c8be-4cc2-bdf4-b12761d12dba',
  '1176ad36-f4a9-4a5b-9bd1-e2f415ead682',
  '5dda2701-9513-4c22-9856-3699da495361'
);

COMMIT;
