# M10 — WYWIAD · FAZA 1: PRAWDA KODU

Audyt Harvard (Protokół V1), branch `feat/deliverables-light`, 2026-06-11. READ-ONLY.
Werdykt na podstawie kodu, nie dokumentacji. Inwentarz = hipoteza (15 poz.).

**Podsumowanie liczbowe (15 pozycji inwentarza):**
- REALNE: **13** (poz. 1-7, 9-13)
- MOCK/STUB: **0**
- ZEPSUTE: **0**
- UKRYTE (celowo): **1** (poz. 8 `pending_review`)
- CZĘŚCIOWE (flow tak / dedykowany artefakt nie): **1** (poz. 14 stepper)
- (poz. 15 = realne szablony; status „untracked" w inwentarzu = NIEAKTUALNY, seed JEST w gicie)

**Inference (poz.12): REALNE** — pełny pipeline LLM (`interviewInferenceService.executeInference`), strukturalny zod schema, persystencja do `interview_insights`, status running→completed/failed.
**Konwersacyjny AI (poz.11): REALNE** — `ConversationalPanel` (transkrypt GET/POST) + `ai-parse` LLM mapujący transkrypt na odpowiedzi.

---

## 1a. REALNE

| # | Pozycja | Dowód |
|---|---------|-------|
| 1 | Inbox / my_assignments | `interview.routes.ts:106-129` (`/assignments/my`, start, submit) → `InterviewController` → `InterviewAssignmentService` |
| 2 | Sesje (manager, bulk lifecycle) | `interview.routes.ts:51-99` (sessions CRUD + bulk + archive/restore/trash/untrash/delete) |
| 3 | Przydzielone + AssignInterviewModal | `InterviewAssignmentService.create` `InterviewAssignmentService.ts:393`; mirror-task do My Work `:1305` (tworzy realny rekord w `tasks`) |
| 4 | Szablony (TemplateBuilder, CRUD, publish, clone, AI evaluate-quality) | `interview.routes.ts:237-345` (templates: list/create/import-source/evaluate-quality/use/clone/archive/restore/default/questions CRUD) |
| 5 | Wnioski / Insights (gen AI, regenerate, statusy, eksport) | `regenerateInsight` `InterviewController.ts:7740`; eksport `exportInsight*` `:8030+`; `llmService.call` w wielu miejscach |
| 6 | InsightViewer (guard material_quality_json — fix 2026-06-09, NIE zgłaszany) | `InsightViewer.tsx` (385 KB) |
| 7 | Inicjatywy + InitiativeWizardModal `generate_from_evidence` | montaż `InterviewHub.tsx:12965` (`initialMode="generate_from_evidence"`) → `initiativeWizardService.ts:7` |
| 9 | InterviewWorkspace (AI per pytanie, eksport MD, evidence, notes, linked items) | `interview.routes.ts:356-465`; AI: `ai-suggest/ai-improve/ai-explain` `:369-375` |
| 10 | Tryby runtime (single_question / task_list / conversational + rekomendacja) | `RuntimeModeSelector.tsx`, `InterviewSingleQuestionRuntime.tsx` (126 KB) |
| 11 | Wywiad konwersacyjny AI | `ConversationalPanel.tsx:83/117/153` (transcript + ai-parse); handler `aiParseSessionAnswers` `InterviewController.ts:5982` (LLM structured, zod MappingSchema) |
| 12 | Inference runs | `interviewInferenceService.ts` cały (LLM `:204`, persist `:218`, status `:248/263`); kontroler `InterviewController.ts:8606-8645` (async execute, błąd→status failed) |
| 13 | Kontekst org + eksport + knowledge search | `/context` GET/PUT `:449-452`; `/sessions/:id/export` `:465`; `/knowledge/search` `:44` |

Cross-cutting REALNE: enterprise routes zamontowane `Gateway.ts:976` (`/api/interview-v4`) → `interviewEnterpriseService` (segmenty, kwoty, dystrybucje, findings, cohort/anonymity gating); findings→inicjatywa `interviewEnterpriseService.ts:497`.

## 1b. MOCK / STUB
**Brak.** Demo dataset (`interviewDemoData.ts`, 130 KB) istnieje, ale jest STRICTLY gated do jawnego toggla użytkownika (`shouldAllowDemoData` `api.ts:623`; brak backdoora localhost/email — `api.ts:606-613`). NIE jest cichym fallbackiem po błędzie: ścieżka ładowania ustawia `setIsUsingDemoData(false)` `InterviewHub.tsx:1392` i przy błędzie pokazuje JAWNY baner (`sessionsLoadError` `:1402`, `insightsLoadError` `:1418`), a nie demo. To poprawny wzorzec, nie mock-stub.

## 1c. ZEPSUTE
**Brak** zidentyfikowanych przycisków-zawsze-błąd ani rozjazdów kontraktu w zweryfikowanych przepływach. Drobna obserwacja (nie ZEPSUTE): ~35 bloków `catch`→`[]`/swallow w `InterviewController.ts` — większość zamierzona (np. 403 insights dla pilot-usera traktowany cicho jako „brak wniosków" `:1413-1417`; backward-compat legacy `user_id`). Do oceny w FAZIE 2 pod kątem maskowania błędów, ale nie łamią głównych flow.

## 1d. UKRYTE / MARTWY KOD
- **poz.8 `pending_review` (UKRYTE, celowo):** górny tab usunięty z `tabs` useMemo — `InterviewHub.tsx:2688` („Pending review top tab intentionally hidden before client delivery."). Logika filtra/typu nadal w kodzie (`:566-569`, `:856`, `:2343`, `:10294`, `:12436`) — gotowa do przywrócenia. Rekomendacja: pozostawić ukryte do decyzji o dostarczeniu klientowi; udokumentować jako feature-gated.
- Brak innego martwego kodu w zakresie M10 (w odróżnieniu od M11 Assessment, gdzie inwentarz wskazuje orphany — poza zakresem).

## 1e. Wiring FE ↔ BE ↔ DB

| Przepływ | FE | API | Handler/Service | DB | Status |
|----------|----|----|------------------|----|--------|
| Szablony CRUD + publish | TemplateBuilder.tsx | `/interview/templates*` `routes:237-345` | InterviewController (templates) | `interview_library_templates` | REALNE |
| Przydziały (fan-out) | AssignInterviewModal.tsx | `/assignments/*` `routes:106-202` | `InterviewAssignmentService.create:393` | `interview_assignments` + mirror `tasks:1305` | REALNE |
| Sesje lifecycle | InterviewHub/Workspace | `/sessions*` `routes:51-99` | InterviewController (sessions/bulk) | `interview_sessions` | REALNE |
| Generacja wniosków (inference) | InterviewHub Insights tab | `/inference/run`,`/runs` `routes:398-404` | `interviewInferenceService.executeInference` (LLM) | `interview_inference_runs`, `interview_insights` | REALNE |
| Konwersacyjny AI parse | ConversationalPanel.tsx | `/sessions/:id/ai-parse` `routes:381` | `aiParseSessionAnswers:5982` (LLM zod) | `interview_questions` (zapis odp.) | REALNE |
| Generacja inicjatyw | InitiativeWizardModal | wizard `initiatives.routes (pmo):106` | `initiativeWizardService` (`generate_from_evidence`) | `initiatives` | REALNE |
| Eksport wniosku→Tools | InsightViewer/Hub | `/interview/insights/:id/export*` `~8030` | InterviewController (tworzy `tool_sessions` `:8085+`) | `tool_sessions`, flaga `exported_to_tools` | REALNE |
| Eksport wniosku→Assessment | InsightViewer/Hub | jw. (target=assessment) | flaga `exported_to_assessment` + link do `assessments` | `interview_insights` | REALNE |

## 1f. Flagi (default BE komentarz vs RUNTIME)
W zakresie M10 **brak feature-flag w komponencie/kontrolerze Wywiadu** (grep `isFeatureEnabled`/`featureFlag` w `InterviewHub.tsx` = 0 trafień). Demo to nie flaga środowiskowa, lecz per-user toggle (`isDemoMode` z persisted store `demo:enabled`, `api.ts:609`). Gating dostępu = permissions RBAC (`canViewManaged/Insights/...`), nie flagi. (Flaga `assessmentInitiativesWizard` należy do M11 Assessment, poza zakresem.)

## 1g. Połączenia międzymodułowe
**WYJŚCIA:**
- Wnioski → Tools: `exportInsight` tworzy `tool_sessions` (tool_type `dynamic-swot`) `InterviewController.ts:8085+`. Status: REALNE.
- Wnioski → Assessment: eksport ustawia `exported_to_assessment`, linkuje `assessments` `:8045-8067`. Status: REALNE.
- Inicjatywy → M13: `generate_from_evidence` przez `initiativeWizardService`, montaż `InterviewHub.tsx:12965`. Status: REALNE.
- Findings (enterprise) → inicjatywa: `promoteFindingToInitiative` `interviewEnterpriseService.ts:497`. Status: REALNE.
- Przydział → My Work (tasks): `createMirrorTask` `InterviewAssignmentService.ts:1305` (INSERT do `tasks`). Status: REALNE.
- Eksport kontekstu → Outputs: `/sessions/:id/export` `routes:465`. Status: REALNE (handler obecny).

**WEJŚCIA:**
- Audyty M12 fan-out → szablony ankietowe: `auditProgramService.ts:416` woła kanoniczny `interviewAssignmentService.create` (idempotentnie) `auditProgramService.ts:31,352`. Status: REALNE (M12 za zamkniętą betą, ale ścieżka kodu pełna).
- Kontekst org: `organizationContextService.buildResolvedContext` używany w inference `interviewInferenceService.ts:140`. Status: REALNE.

---

## Status spornych pozycji
- **poz.8** — UKRYTE celowo, potwierdzone `InterviewHub.tsx:2688`.
- **poz.14** — flow 4-etapowy istnieje jako **flat tab bar gated permissionami** (Inbox/Sesje/Przydzielone/Szablony/Wnioski/Inicjatywy, `tabs` useMemo `:2631-2691`); **dedykowany przeprojektowany wizualny stepper 4-krokowy NIE istnieje** (0 trafień `Stepper/ProcessStep/StepIndicator`). Potwierdza inwentarz: „DZIAŁA jako flow / redesign brak".
- **poz.15** — szablony ankietowe = zwykłe szablony wywiadu (REALNE). Seed `seed-elkomtech-survey-templates.mjs` jest **TRACKED w gicie** (`git ls-files` = obecny, clean) — twierdzenie inwentarza „untracked" jest NIEAKTUALNE (drift dokumentacji).

## Inference / konwersacyjny AI — werdykt
Oba **REALNE**, LLM-backed, nie stub.

## TOP 5 findingów
- **P1** [doc-drift] Inwentarz: poz.15 seed „untracked" — w rzeczywistości tracked i czysty. Zaktualizować inwentarz.
- **P1** [doc-drift] Inwentarz: „interview.routes.ts (89 handlerów)" — plik ma 544 l.; realna liczba endpointów ~tuzin-y mniej (handlery delegowane do `InterviewController` 8647 l.). Liczba zawyżona, ale funkcje istnieją.
- **P1** [decyzja produktowa] poz.8 `pending_review` ukryty — martwa, ale kompletna logika filtra/widoku w kodzie; ryzyko cichego dryfu. Udokumentować jako świadomy feature-gate albo usunąć.
- **P2** [obserwacja] ~35 `catch`→swallow w `InterviewController.ts` — większość zamierzona; rekomendacja audytu FAZA 2 pod kątem ewentualnego maskowania realnych błędów (vs jawne banery, które są obecne na głównej ścieżce ładowania).
- **P2** [obserwacja] Eksport→Tools wykonuje `CREATE TABLE IF NOT EXISTS tool_sessions` defensywnie w runtime kontrolera `:8085` — wskazuje na obawy o dryf schematu staging/prod (zgodne z wcześniejszymi findingami schema-drift). Potwierdzić, że migracja tabeli istnieje na prod.

**Brak P0.** Główne przepływy M10 (szablony, przydziały, sesje, inference, konwersacyjny AI, generacja inicjatyw, eksport cross-module) są realne i okablowane FE↔BE↔DB.

Ścieżka pliku: `Harvard/modules/M10-wywiad/evidence/f1_code_truth.md`
