-- Tester round 2 — Jan Kowalski @ Aplix staging, Chrome, post-fix regression run (2026-04-18)
--
-- 17 findings from a single staging test session. Where Jan wrote
-- "po poprawkach nadal występuje" we mark the row as a regression via
-- workflow.timeline so the Superadmin Feedback drawer shows the history
-- vs. the original cluster.
--
-- Clusters in use (adds 3 new ones on top of the 10 already seeded):
--   chat-history     — conversation list, folders, trash, move-to-folder
--   chat-sources     — source citations / RAG snippets rendering
--   chat-quality     — Quick-savings correctness, TTS quality
-- Plus the reusable existing clusters:
--   i18n-teresa, ai-teresa-runtime, ui-chat, superadmin-infra
--
-- All rows:
--   organization_id = 'system' (reporter tests across orgs)
--   user_id         = cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3 (jan.kowalski@dbr77.com)
--   feedback_type   = 'BUG'
--   status          = 'NEW'   (post-fix regressions still open)
--   source_env      = 'staging'
--   owner           = 'cursor'

BEGIN;

-- =====================================================================
-- CRITICAL — data / privacy impact
-- =====================================================================

-- #5 Trash: infinite loading, after refresh conversations+folders vanish,
-- only some come back. Risk of temporary data loss.
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  '3a41921c-1210-4ac6-92d8-3b4a599be835',
  'system',
  'cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3',
  'BUG',
  'Kosz chatu: niekończące się "Loading conversations…", po refresh konwersacje i foldery znikają',
  E'Staging Aplix, Chrome, post-fix run.\n\nSteps:\n1. Chat → Trash\n2. Strona zostaje w stanie "Loading conversations…" w nieskończoność\n3. Refresh — wszystkie konwersacje i foldery znikają z widoku\n4. Po kilku chwilach część wraca samoistnie\n\nImpact: użytkownik widzi utratę danych, co podważa zaufanie do chata. Część rzeczywiście się nie odzyskuje.',
  'NEW', 'critical', 'CRITICAL', 'staging',
  jsonb_build_object(
    'app_env', 'staging',
    'route_path', '/chat/trash',
    'browser', 'Chrome',
    'tester', 'jan.kowalski@dbr77.com',
    'workflow', jsonb_build_object(
      'owner', 'cursor', 'cluster', 'chat-history', 'source', 'cursor',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(jsonb_build_object(
        'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'actor', 'cursor-cto-triage-2026-04-18',
        'action', 'intake',
        'details', 'Intake from staging regression test round 2 by jan.kowalski'
      ))
    )
  )::text,
  '2026-04-18 07:00:00', NOW(), 'chat-history', 'cursor', NOW()
);

-- #17 Quick savings mixes threads across conversations (context bleed)
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  '4408f355-369d-4175-8f42-656fdc3c0fdb',
  'system',
  'cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3',
  'BUG',
  'Quick savings miesza wątki między konwersacjami (context bleed)',
  E'Staging Aplix, Chrome, post-fix run.\n\nFunkcja Quick savings zwraca treści z innych konwersacji niż ta, w której została uruchomiona. Ryzyko ujawnienia danych pomiędzy sesjami/klientami.\n\nWymaga pilnej weryfikacji retrievera i scope''u konwersacji w pipeline (czy filtr conversation_id faktycznie jest wpinany).',
  'NEW', 'critical', 'CRITICAL', 'staging',
  jsonb_build_object(
    'app_env', 'staging',
    'route_path', '/chat',
    'browser', 'Chrome',
    'tester', 'jan.kowalski@dbr77.com',
    'workflow', jsonb_build_object(
      'owner', 'cursor', 'cluster', 'chat-quality', 'source', 'cursor',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(jsonb_build_object(
        'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'actor', 'cursor-cto-triage-2026-04-18',
        'action', 'intake',
        'details', 'Intake: Quick savings mixes threads — possible privacy/scoping bug'
      ))
    )
  )::text,
  '2026-04-18 07:15:00', NOW(), 'chat-quality', 'cursor', NOW()
);

-- =====================================================================
-- HIGH — regressions after fix
-- =====================================================================

-- #1 Historical conversations can't be opened (regression)
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  '2ee998d3-0345-4503-bc35-df63c0b15850',
  'system',
  'cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3',
  'BUG',
  'Historyczne konwersacje widoczne, ale nie można ich otworzyć (REGRESSION)',
  E'Staging Aplix, Chrome, post-fix run.\n\nLista historycznych konwersacji się renderuje, ale klik w item nie ładuje treści. Po wcześniejszych poprawkach — nadal nie działa.',
  'NEW', 'high', 'HIGH', 'staging',
  jsonb_build_object(
    'app_env', 'staging', 'route_path', '/chat', 'browser', 'Chrome',
    'tester', 'jan.kowalski@dbr77.com', 'regression', true,
    'workflow', jsonb_build_object(
      'owner', 'cursor', 'cluster', 'chat-history', 'source', 'cursor',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(jsonb_build_object(
        'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'actor', 'cursor-cto-triage-2026-04-18', 'action', 'regression',
        'details', 'Tester reports prior fix did not land on staging'
      ))
    )
  )::text,
  '2026-04-18 07:01:00', NOW(), 'chat-history', 'cursor', NOW()
);

-- #2 EN UI, PL answers + Teresa claims PL is preferred (regression, known cluster)
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  '1176ad36-f4a9-4a5b-9bd1-e2f415ead682',
  'system',
  'cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3',
  'BUG',
  'Teresa odpowiada po polsku mimo EN UI i twierdzi, że preferowany to PL (REGRESSION)',
  E'Staging Aplix, Chrome, post-fix run.\n\nJęzyk UI: EN. Teresa: odpowiedzi po polsku + komunikat "preferowany język to polski". Po poprawkach z rundy 1 — nadal występuje.',
  'NEW', 'high', 'HIGH', 'staging',
  jsonb_build_object(
    'app_env', 'staging', 'route_path', '/chat', 'browser', 'Chrome',
    'tester', 'jan.kowalski@dbr77.com', 'regression', true,
    'workflow', jsonb_build_object(
      'owner', 'cursor', 'cluster', 'i18n-teresa', 'source', 'cursor',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(jsonb_build_object(
        'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'actor', 'cursor-cto-triage-2026-04-18', 'action', 'regression',
        'details', 'Locale bug persists post-fix; confirms i18n-teresa is still open'
      ))
    )
  )::text,
  '2026-04-18 07:02:00', NOW(), 'i18n-teresa', 'cursor', NOW()
);

-- #9 Mixed PL/EN answers (regression)
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  '5dda2701-9513-4c22-9856-3699da495361',
  'system',
  'cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3',
  'BUG',
  'Chat odpowiada mieszanym PL/EN (REGRESSION)',
  E'Staging Aplix, Chrome, post-fix run.\n\nW obrębie jednej odpowiedzi pojawiają się fragmenty PL i EN na przemian. Po poprawkach — nadal występuje.',
  'NEW', 'high', 'HIGH', 'staging',
  jsonb_build_object(
    'app_env', 'staging', 'route_path', '/chat', 'browser', 'Chrome',
    'tester', 'jan.kowalski@dbr77.com', 'regression', true,
    'workflow', jsonb_build_object(
      'owner', 'cursor', 'cluster', 'i18n-teresa', 'source', 'cursor',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(jsonb_build_object(
        'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'actor', 'cursor-cto-triage-2026-04-18', 'action', 'regression',
        'details', 'Mixed PL/EN output — same cluster as #2'
      ))
    )
  )::text,
  '2026-04-18 07:09:00', NOW(), 'i18n-teresa', 'cursor', NOW()
);

-- #8 Chat can't see attached files (regression)
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  'f590c4fc-76a8-493d-a35a-18439fc0b8f1',
  'system',
  'cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3',
  'BUG',
  'Chat nie widzi załączonych plików (REGRESSION)',
  E'Staging Aplix, Chrome, post-fix run.\n\nZałączone pliki są widoczne w UI, ale Teresa odpowiada że ich nie ma / nie potrafi otworzyć. Po poprawkach — nadal występuje.',
  'NEW', 'high', 'HIGH', 'staging',
  jsonb_build_object(
    'app_env', 'staging', 'route_path', '/chat', 'browser', 'Chrome',
    'tester', 'jan.kowalski@dbr77.com', 'regression', true,
    'workflow', jsonb_build_object(
      'owner', 'cursor', 'cluster', 'ai-teresa-runtime', 'source', 'cursor',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(jsonb_build_object(
        'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'actor', 'cursor-cto-triage-2026-04-18', 'action', 'regression',
        'details', 'File-visibility bug not resolved post-fix'
      ))
    )
  )::text,
  '2026-04-18 07:08:00', NOW(), 'ai-teresa-runtime', 'cursor', NOW()
);

-- #11 Chat can't see attached web page (regression)
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  'e196a572-9c45-47b1-a6d7-2ccff803def2',
  'system',
  'cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3',
  'BUG',
  'Chat nie widzi podpiętej strony internetowej do konwersacji (REGRESSION)',
  E'Staging Aplix, Chrome, post-fix run.\n\nDo konwersacji podpięto URL jako źródło. Teresa twierdzi, że nie widzi strony. Po poprawkach — nadal występuje.',
  'NEW', 'high', 'HIGH', 'staging',
  jsonb_build_object(
    'app_env', 'staging', 'route_path', '/chat', 'browser', 'Chrome',
    'tester', 'jan.kowalski@dbr77.com', 'regression', true,
    'workflow', jsonb_build_object(
      'owner', 'cursor', 'cluster', 'ai-teresa-runtime', 'source', 'cursor',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(jsonb_build_object(
        'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'actor', 'cursor-cto-triage-2026-04-18', 'action', 'regression',
        'details', 'URL attachment ingestion not seen by LLM post-fix'
      ))
    )
  )::text,
  '2026-04-18 07:11:00', NOW(), 'ai-teresa-runtime', 'cursor', NOW()
);

-- #10 Add link — typing one letter loses focus (regression)
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  'ee34bf23-513c-45e1-8b95-72470763cf64',
  'system',
  'cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3',
  'BUG',
  'Add link: focus wypada po każdej literze — nie można wpisać adresu (REGRESSION)',
  E'Staging Aplix, Chrome, post-fix run.\n\nKrok "Add link": po wpisaniu jednej litery trzeba ponownie kliknąć w pole żeby wpisać kolejną. Fatalny UX, blokuje dodawanie URL.\n\nPodejrzenie: komponent re-mountuje się przy każdym onChange (niestabilny key / parent re-render / stan w niewłaściwym miejscu).',
  'NEW', 'high', 'HIGH', 'staging',
  jsonb_build_object(
    'app_env', 'staging', 'route_path', '/chat', 'browser', 'Chrome',
    'tester', 'jan.kowalski@dbr77.com', 'regression', true,
    'workflow', jsonb_build_object(
      'owner', 'cursor', 'cluster', 'ui-chat', 'source', 'cursor',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(jsonb_build_object(
        'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'actor', 'cursor-cto-triage-2026-04-18', 'action', 'regression',
        'details', 'Likely re-mount on each keystroke; investigate input key/stable parent'
      ))
    )
  )::text,
  '2026-04-18 07:10:00', NOW(), 'ui-chat', 'cursor', NOW()
);

-- =====================================================================
-- MEDIUM
-- =====================================================================

-- #3 Can't delete folders in chat history (regression)
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  '407a17df-9b42-46c7-8ad2-3ac3f76711e4',
  'system',
  'cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3',
  'BUG',
  'Nie można usuwać folderów w historii chatu (REGRESSION)',
  'Staging Aplix, Chrome, post-fix run. Klik w usuń folder → brak akcji. Po poprawkach — nadal występuje.',
  'NEW', 'high', 'MEDIUM', 'staging',
  jsonb_build_object(
    'app_env', 'staging', 'route_path', '/chat', 'browser', 'Chrome',
    'tester', 'jan.kowalski@dbr77.com', 'regression', true,
    'workflow', jsonb_build_object(
      'owner', 'cursor', 'cluster', 'chat-history', 'source', 'cursor',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(jsonb_build_object(
        'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'actor', 'cursor-cto-triage-2026-04-18', 'action', 'regression',
        'details', 'Folder delete does nothing; backend handler likely disconnected'
      ))
    )
  )::text,
  '2026-04-18 07:03:00', NOW(), 'chat-history', 'cursor', NOW()
);

-- #4 Can't add conversation to folder (regression)
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  '84f6e58f-24b7-4ddc-a63d-98aa305b3393',
  'system',
  'cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3',
  'BUG',
  'Nie można dodać konwersacji do folderu (REGRESSION)',
  'Staging Aplix, Chrome, post-fix run. Flow "dodaj konwersację do folderu" nie kończy się przypisaniem. Po poprawkach — nadal występuje.',
  'NEW', 'high', 'MEDIUM', 'staging',
  jsonb_build_object(
    'app_env', 'staging', 'route_path', '/chat', 'browser', 'Chrome',
    'tester', 'jan.kowalski@dbr77.com', 'regression', true,
    'workflow', jsonb_build_object(
      'owner', 'cursor', 'cluster', 'chat-history', 'source', 'cursor',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(jsonb_build_object(
        'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'actor', 'cursor-cto-triage-2026-04-18', 'action', 'regression',
        'details', 'Sibling of #3 — folder CRUD endpoints need audit'
      ))
    )
  )::text,
  '2026-04-18 07:04:00', NOW(), 'chat-history', 'cursor', NOW()
);

-- #14 Move to folder — can't assign conversation (regression)
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  'fb2d4e30-fb7f-45ad-b52d-1e74e6e8b4bb',
  'system',
  'cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3',
  'BUG',
  'Move to folder: przypisanie konwersacji nie działa (REGRESSION)',
  'Staging Aplix, Chrome, post-fix run. Z poziomu rozmowy opcja "Move to folder" — wybór folderu nie skutkuje przypisaniem. Po poprawkach — nadal występuje.',
  'NEW', 'high', 'MEDIUM', 'staging',
  jsonb_build_object(
    'app_env', 'staging', 'route_path', '/chat', 'browser', 'Chrome',
    'tester', 'jan.kowalski@dbr77.com', 'regression', true,
    'workflow', jsonb_build_object(
      'owner', 'cursor', 'cluster', 'chat-history', 'source', 'cursor',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(jsonb_build_object(
        'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'actor', 'cursor-cto-triage-2026-04-18', 'action', 'regression',
        'details', 'Move-to-folder from conversation drawer fails silently'
      ))
    )
  )::text,
  '2026-04-18 07:14:00', NOW(), 'chat-history', 'cursor', NOW()
);

-- #15 Move to folder — search closes the modal
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  '45e50d65-e7da-4cb1-8302-627ab39862f7',
  'system',
  'cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3',
  'BUG',
  'Move to folder: kliknięcie w wyszukiwarkę folderów zamyka modal',
  'Staging Aplix, Chrome. W modalu Move-to-folder kliknięcie w input "szukaj folderu" zamyka całe okno.\n\nPodejrzenie: outside-click handler łapie klik na input, który renderowany jest poza portalem.',
  'NEW', 'high', 'MEDIUM', 'staging',
  jsonb_build_object(
    'app_env', 'staging', 'route_path', '/chat', 'browser', 'Chrome',
    'tester', 'jan.kowalski@dbr77.com',
    'workflow', jsonb_build_object(
      'owner', 'cursor', 'cluster', 'chat-history', 'source', 'cursor',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(jsonb_build_object(
        'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'actor', 'cursor-cto-triage-2026-04-18', 'action', 'intake',
        'details', 'New issue, not previously reported'
      ))
    )
  )::text,
  '2026-04-18 07:15:30', NOW(), 'chat-history', 'cursor', NOW()
);

-- #6 Links to websites in sources
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  '1cbe2baa-06b1-4e13-ace2-7d2928f02c95',
  'system',
  'cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3',
  'BUG',
  'Źródła w konwersacji zawierają linki do zewnętrznych stron',
  E'Staging Aplix, Chrome. W sekcji "źródła" odpowiedzi pojawiają się linki do stron www. Czy to powinno być? Jeśli tak — wymaga walidacji allowlist/oznaczenia jako external. Jeśli nie — RAG wpuszcza materiały spoza dozwolonych źródeł.',
  'NEW', 'high', 'MEDIUM', 'staging',
  jsonb_build_object(
    'app_env', 'staging', 'route_path', '/chat', 'browser', 'Chrome',
    'tester', 'jan.kowalski@dbr77.com',
    'workflow', jsonb_build_object(
      'owner', 'cursor', 'cluster', 'chat-sources', 'source', 'cursor',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(jsonb_build_object(
        'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'actor', 'cursor-cto-triage-2026-04-18', 'action', 'intake',
        'details', 'Needs product call: should web links appear in sources?'
      ))
    )
  )::text,
  '2026-04-18 07:06:00', NOW(), 'chat-sources', 'cursor', NOW()
);

-- #7 "Source 2; rag_2; [2]" not clickable (regression)
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  '05b77280-557b-4e0a-b0c4-3863ae501ac2',
  'system',
  'cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3',
  'BUG',
  'Cytaty źródeł ("Source 2; rag_2; [2]") nie są klikalne (REGRESSION)',
  'Staging Aplix, Chrome, post-fix run. Inline citations w odpowiedzi Teresy mają formę "Source 2; rag_2; [2]" ale nie są klikalne — nie otwierają karty źródła. Po poprawkach — nadal występuje.',
  'NEW', 'high', 'MEDIUM', 'staging',
  jsonb_build_object(
    'app_env', 'staging', 'route_path', '/chat', 'browser', 'Chrome',
    'tester', 'jan.kowalski@dbr77.com', 'regression', true,
    'workflow', jsonb_build_object(
      'owner', 'cursor', 'cluster', 'chat-sources', 'source', 'cursor',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(jsonb_build_object(
        'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'actor', 'cursor-cto-triage-2026-04-18', 'action', 'regression',
        'details', 'Citation renderer outputs raw text instead of linked chip'
      ))
    )
  )::text,
  '2026-04-18 07:07:00', NOW(), 'chat-sources', 'cursor', NOW()
);

-- #16 Quick savings — [numbers] without source name
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  '3c5b87cf-6cc2-4ac5-9fea-bdeeb56b9422',
  'system',
  'cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3',
  'BUG',
  'Quick savings pokazuje przypisy [numery] bez nazwy źródła',
  'Staging Aplix, Chrome. Odpowiedzi Quick savings zawierają same numery przypisów ([1], [2]) bez metadanych co to jest za źródło — użytkownik nie może zweryfikować.',
  'NEW', 'high', 'MEDIUM', 'staging',
  jsonb_build_object(
    'app_env', 'staging', 'route_path', '/chat', 'browser', 'Chrome',
    'tester', 'jan.kowalski@dbr77.com',
    'workflow', jsonb_build_object(
      'owner', 'cursor', 'cluster', 'chat-sources', 'source', 'cursor',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(jsonb_build_object(
        'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'actor', 'cursor-cto-triage-2026-04-18', 'action', 'intake',
        'details', 'Citation metadata missing for Quick-savings mode'
      ))
    )
  )::text,
  '2026-04-18 07:16:00', NOW(), 'chat-sources', 'cursor', NOW()
);

-- #12 TTS unnatural/robotic (regression)
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  '25dae9b4-ae03-4aa0-b607-3b4ae41daeb6',
  'system',
  'cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3',
  'BUG',
  'Funkcja czytania tekstu (TTS) brzmi robotycznie (REGRESSION)',
  'Staging Aplix, Chrome, post-fix run. TTS brzmi nienaturalnie. Po poprawkach — nadal występuje. Należy sprawdzić czy używany głos/model jest zgodny z planem (np. gpt-realtime / wysokiej jakości).',
  'NEW', 'medium', 'MEDIUM', 'staging',
  jsonb_build_object(
    'app_env', 'staging', 'route_path', '/chat', 'browser', 'Chrome',
    'tester', 'jan.kowalski@dbr77.com', 'regression', true,
    'workflow', jsonb_build_object(
      'owner', 'cursor', 'cluster', 'chat-quality', 'source', 'cursor',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(jsonb_build_object(
        'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'actor', 'cursor-cto-triage-2026-04-18', 'action', 'regression',
        'details', 'TTS quality still subpar; verify voice model/config'
      ))
    )
  )::text,
  '2026-04-18 07:12:00', NOW(), 'chat-quality', 'cursor', NOW()
);

-- #13 Daily brief shows VTS tasks (context/org scoping)
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  '5d9b15f7-91a2-46f0-9a87-b10e467c5977',
  'system',
  'cf8141f8-96a4-4c7b-ad28-b5e3a41f07d3',
  'BUG',
  '"Dzienny brief" pokazuje zadania powiązane z VTS (mylny kontekst)',
  E'Staging Aplix, Chrome. Po kliknięciu w "Dzienny brief" wyświetlają się zadania z VTS zamiast z aktualnego orga użytkownika.\n\nRyzyko: context/org scoping nie działa — podobna klasa problemu jak #17 Quick savings (context bleed).',
  'NEW', 'high', 'MEDIUM', 'staging',
  jsonb_build_object(
    'app_env', 'staging', 'route_path', '/chat', 'browser', 'Chrome',
    'tester', 'jan.kowalski@dbr77.com',
    'workflow', jsonb_build_object(
      'owner', 'cursor', 'cluster', 'chat-quality', 'source', 'cursor',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(jsonb_build_object(
        'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'actor', 'cursor-cto-triage-2026-04-18', 'action', 'intake',
        'details', 'Org/tenant scoping issue — likely shares root cause with Quick-savings bleed'
      ))
    )
  )::text,
  '2026-04-18 07:13:00', NOW(), 'chat-quality', 'cursor', NOW()
);

COMMIT;
