# VTS wave-2 — handoff (2026-06-10)

Klient: **VTS Group S.A.** (org `vts` w bazie produkcyjnej), producent HVAC, ekspansja USA + Data Centers.
Repo: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify`. Gałąź robocza: `feat/help-coverage-ai-knowledge` (staging = `origin/Londyn`).

## DOSTĘP DO BAZ (ważne — są 3 różne!)
- **PRODUKCJA = `centerbeam`** (tu są wszystkie dane VTS wave 2). Connection string:
  `railway variables --environment production --service Postgres --kv | grep DATABASE_PUBLIC_URL`
  Łączyć przez node `pg` z `ssl:{rejectUnauthorized:false}`. Zapisuj do `/tmp/.produrl`.
- `trolley` (= `.env`) i `caboose` (= `.env.staging.local`) to STAGING — NIE produkcja. Wdrożony staging-app (`demo.consultify.ai`) czyta trolley; lokalny backend-dev czyta caboose. Mają STARSZY schemat (brak kolumny `locale`, `org_members.role` bez 'USER').

## CO JEST GOTOWE NA PROD
1. **Rollout ankiety wave 2:** 130 kont (`users` org=vts, status `pending`, 126 USER + 4 ADMIN), 256 `interview_assignments` (general + process, projekt `vts-wave2`), 16 szablonów `interview_library_templates` (`%_w2_%`, PL/EN). Magic-link „open" działa end-to-end na prod (token w mailu, requireProfile). First-login kod wdrożony na prod. Lista kontrolna dla Mariusza Draguna (IT Mgr VTS) dostarczona — **on wysyła maile**.
2. **10 insightów** (`interview_insights` id `vts_w2_I1..I10`) + **15 inicjatyw** (`initiatives` id `vts_w2_IN1..IN15`, + dzieci `initiative_kpis`/`initiative_milestones`/`raid_items`/`initiative_stakeholders`). Wyciągnięte z PDF „Program Transformacji Cyfrowej VTS Group" (`~/Desktop/Software/Consultify/Raporty/`). Aktualnie na prod = wersja **10/10 (score 96, wszystkie pass)**, tytuły bez kwot, ugruntowane w metrykach Etapu 1.
3. **Warstwa programowa (Faza 2):** `report_builder_reports` id `vts_w2_program_report` + 6 sekcji (dashboard, model 5-etapowy, portfel, governance, appendix systemów, appendix uczestników).
4. **Fix bugu:** `src/components/Interview/InsightViewer.tsx` — `material_quality` mogło być stringiem → white-screen; zhardenowane (koercja do tablic). Commit `6bfd3a6f6e` (lokalnie, niepushowany). Dane na prod znormalizowane (role_coverage itd. = tablice).

## W LOCIE / DO DOKOŃCZENIA
- **Workflow „pełność" (deepening):** task `w3ejr9jx0`, run `wf_c4f8bd14-f3f`, script `.../workflows/scripts/vts-cards-10of10-wf_c8b24656-16b.js`. Cel: dociągnąć karty do ≥1350 słów (insight) / ≥1250 (inicjatywa) — bramka HF8. **Dwa razy zacinał się przy restarcie sesji.** Po zakończeniu: wyciągnij `top.result` z pliku `/private/tmp/.../tasks/w3ejr9jx0.output` → `/tmp/vts_10of10.json` → zapisz na prod (UPDATE insightów + UPDATE inicjatyw + DELETE/re-INSERT dzieci). Jeśli znów padnie: `Workflow({scriptPath, resumeFromRunId:"wf_c4f8bd14-f3f"})`.

## ZASADY ZAPISU NA PROD (constraints!)
- Insight JSON kolumny (`themes_json`, `issues_json`, ..., `material_quality_json`, `content`) to TEXT → `JSON.stringify`. `material_quality` MUSI mieć `role_coverage`/`department_coverage`/`missing_voices`/`limitations`/`recommended_followups` jako **tablice** (inaczej crash UI).
- Listy inicjatyw (`deliverables`, `scope_in`, `scope_out`, `success_criteria`, `kill_criteria`, `key_risks`) = TEXT z `JSON.stringify(array)`.
- `initiative_kpis.direction` ∈ {`HIGHER_IS_BETTER`,`LOWER_IS_BETTER`}. `raid_items.status`='OPEN'; `probability`/`impact` ∈ {LOW,MEDIUM,HIGH(,CRITICAL)} lub NULL; `response_strategy` ∈ {AVOID,TRANSFER,MITIGATE,ACCEPT,ESCALATE}. `initiative_stakeholders.raci_type` ∈ {R,A,C,I}. `report_builder_sections.enabled` = boolean (true, nie 1).
- Zawsze: transakcja BEGIN/COMMIT + zapis stanu „przed" do `/tmp/*_before.json`. DRY (ROLLBACK) przed realnym zapisem. created_by = `7f8ef469-f326-4527-890e-b2ecc7f224cf` (piotr.wisniewski@dbr77.com).
- Skrypty `.cjs` uruchamiaj z katalogu repo (ESM → rozszerzenie `.cjs`); `pg` jest w root `node_modules`.

## GOTCHA
- Workflow w tle GINIE przy restarcie sesji — po każdym dłuższym przebiegu sprawdź `…/tasks/<id>.output` (pusty = padł) i wznów z `resumeFromRunId`.
- Weryfikacja wizualna: backend-dev (port 3001) czyta caboose; żeby zobaczyć kartę w UI, zasiej dane testowe do caboose i zaloguj się przez `/api/auth/login`.

## NASTĘPNE KROKI (priorytet)
1. Dokończyć deepening (`w3ejr9jx0`) i zapisać fuller wersje na prod.
2. Dowód wizualny dla 1–2 inicjatyw (analogicznie do insightu).
3. Zielone światło dla Mariusza na wysyłkę magic linków (jeśli jeszcze nie poszło).
4. Drobne loose-endy: zweryfikować `jmeljan@vtsclima.com`; commit `6bfd3a6f6e` wdrożyć z najbliższym releasem.
