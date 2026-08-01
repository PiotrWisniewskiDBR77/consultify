---
doc_id: ASM-001A-discovery-synthesis
truth_type: verified-as-is
status: draft-for-codex-review
owner: claude-line-a
depends_on: ASM-001
base_sha: c522a861839f54d0f26baa918566589aab3f6f6b
branch: feat/asm-001a-drd-form-matrix-roundtrip
last_reviewed: 2026-08-01
---

# ASM-001A — Fala 1 Discovery Synthesis

Cztery równoległe read-only agenty (route/runtime, schema/data, frontend
state, tenant/security) przeszły `wt-asm001a` @ base SHA. Poniżej scalona
mapa, root causes, macierz własności plików i plan testów przed Falą 2.

## Route → Component → Handler → API → Service → DB → read-back (stan dziś)

| Krok | Dziś | Luka |
| --- | --- | --- |
| `/assessment` i 6 aliasów | wszystkie montują `AssessmentHub` bez propsów, brak rozróżnienia po segmencie ścieżki | brak |
| Taby Hub | tylko 3: `list`/`reports`/`initiatives`, `initialTab='list'`, **zero** `?tab=` URL sync | trzeba zbudować od zera (nie ma czego rozszerzać) |
| Library | `TemplateLibrary.tsx` istnieje, ale to inicjatywy-szablony (zła domena), zero importerów — martwy kod | nowy cienki adapter, NIE fork TemplateLibrary |
| Definicje DRD | `GET /api/v8/assessment/definitions/:methodologyId` istnieje w backendzie, zwraca draft+published+deprecated | zero frontendowego callera; brak filtra `published` |
| Create | `NewAssessmentModal` → `POST /api/v8/assessment`, **bez** definitionId/version w payloadzie ani w kolumnie | backend real gap: trzeba dodać przypięcie definicji przy create |
| Editor open | `/assessment/:framework/:assessmentId` → `AssessmentSessionEditorView`, `loadCoreAssessmentSession` GET, fallback V2 na `[400,403,404,405,501]` | działa, provenance nie jest pokazywana w UI |
| Save | `scheduleSave` → PUT, sukces = tylko odpowiedź PUT, **brak GET read-back** | real gap: trzeba dodać explicit read-back |
| Reopen | świeży GET, brak cache dla `answers` | działa poprawnie już dziś |
| Form↔Matrix | dzielą JEDEN `answers` state w rodzicu (realne), ale Matrix **nigdy nie pokazuje `targetLevel`** i istnieją 3 niezależne formuły completion (header/klient, DRDForm własna, DRDMatrixSession własna) | real gap: Matrix target display + jedna completion (server-derived) |
| Completion | 100% liczone w kliencie, serwer tylko persystuje cudzą liczbę | real gap: backend musi liczyć server-side dla DRD |

## Root causes

1. **Tabs nigdy nie miały URL jako źródła prawdy** — `activeTab` żyje wyłącznie w lokalnym state Hub, routing nie przekazuje segmentu. Nie naprawimy tego "przy okazji" — to jest właśnie zadanie ASM-001A.
2. **Create-from-definition nigdy nie został zbudowany** — backend endpoint definicji istnieje od dawna (P28 workbench), ale create flow assessmentu i definicje nigdy się nie spotkały; workbench auto-bootstrapuje `published` definicję po cichu zamiast wymuszać jawny publish+select. To jest realna luka kontraktu, nie tylko UI.
3. **Completion nigdy nie miał jednego właściciela** — trzy niezależne implementacje (klient×2 + trust-the-client backend) powstały niezależnie przy budowie Form/Matrix/header. Naprawa wymaga jednego server-derived punktu prawdy, bez ruszania SIRI/ADMA/CMMI/Lean (ich domyślne zachowanie zostaje, gate po `assessmentType==='DRD'`).

## Macierz własności plików (writer allowlist)

### Frontend writer (jeden aktywny writer)
- `src/components/assessment/AssessmentHub.tsx` — 5 tab ids, `library` default, `?tab=` sync, `list→processes` compat mapping
- `src/components/assessment/library/AssessmentLibraryTab.tsx` (NOWY) — cienki adapter nad `StandardTable`, czyta published DRD definition
- `src/services/api/v8/assessment.ts` — typed client: `listPublishedDefinitions`, `createAssessmentFromDefinition` (payload z definitionId+version)
- `src/views/AssessmentSessionEditorView.tsx` — GET read-back po save, provenance badge (V8/degraded), spięcie z server completion dla DRD, widoczny toast przy błędzie autosave (dziś cichy fail)
- `src/components/assessment/drd/DRDMatrixSession.tsx` — wyświetlenie `targetLevel` obok `achievedLevel`
- `src/hooks/useFeatureFlags.tsx` — rejestracja `assessmentFiveSurfacesV1` (default `false`) — jedyny shared-registry touch, addytywny wpis
- testy: `tests/component/assessment/*`, browser script w `dev-render/` lub `tests/browser/`

### Backend writer (jeden, tylko bo discovery potwierdził realną lukę kontraktu)
- `server/src/routes/v8/assessment.routes.ts` — `POST /` przyjmuje i waliduje `definitionId+version` (istnieje/published/org-visible, reject inaczej); `GET/PUT /:id` zwraca server-derived `completionPercent` dla `assessmentType==='DRD'` (inne frameworki bez zmian)
- `server/src/services/assessment/AssessmentDefinitionService.ts` — dodanie wąskiej metody `getPublishedDefinition(methodologyId, version?)` (addytywnie, bez zmiany istniejących metod)
- `server/src/services/assessment/drdCompletion.ts` (NOWY) — czysta funkcja `computeDrdCompletion(areas)`, jednostkowo testowalna
- testy: `server/src/routes/v8/__tests__/assessment.routes.test.ts` (rozszerzenie), nowy real-PG acceptance script

**Zero nowych migracji** — `assessment_definition_id/version` już istnieją w `assessments` (migracja `021_p28_definition_versions.sql`), `assessment_definitions` już istnieje. Migracja `932` nie istnieje w repo — potwierdzone, nie dotykamy.

**Zero zmian w**: `AppRoutes.tsx` (tab logic czyta `?tab=` wewnątrz Hub, nie z route path), locale plikach (istniejące tab labels są już hardcoded stringami, nie i18n key — nowe taby idą tym samym wzorcem), `tests/acceptance/schema.mjs`, migracji 932, Initiative/Execution writerów, My Work/Decision, demo seeds.

## Znalezione alternatywne write paths (dla adwersarza w Fali 4)

- `AssessmentHub.handleRowAction('duplicate'|'delete')` i `AssessmentManagePanel`/`InitiativesGenerationWizardModal`/`InitiativesManagementPanel` biją bezpośrednio w `/assessment-workflow-v2`, część przez goły `fetch()` (`InitiativesManagementPanel.tsx`) — nie są w scope zmiany, ale muszą przejść przez ASM-001A bez regresji (deep-linki Reports/Initiatives mają nadal działać).
- Legacy `/api/assessment-workflow` (V1, `org-default` fail-open fallback) i `/api/assessments-v4` (`x-organization-id` header trust fallback) — POTWIERDZONE luki bezpieczeństwa, ale w modułach poza DRD Form/Matrix roundtrip. NIE naprawiane w tym pakiecie (poza zakresem CLAUDE.md: nie naprawiaj pobocznych problemów) — zgłoszone jako follow-up.

## Potwierdzone luki bezpieczeństwa — decyzja zakresu

| Luka | W zakresie ASM-001A? | Decyzja |
| --- | --- | --- |
| Brak wymuszenia `published` definition na create | **TAK** — jawne acceptance criterion | Naprawia backend writer |
| Completion nie jest server-derived | **TAK** — jawne acceptance criterion | Naprawia backend writer (tylko DRD) |
| Brak capability-check na V8 create/edit (viewer może tworzyć/edytować) | NIE — dotyczy całego modułu Assessment, nie tylko DRD Library slice; naprawa dotknęłaby wszystkich frameworków i byłaby scope creep | Flagowane jako follow-up dla Codex, NIE naprawiane tu |
| Brak optimistic locking (last-write-wins na równoległym PUT) | NIE — nie jest w "Zakres" ASM-001A, nie ma acceptance criterion o atomic write | Testowane i udokumentowane w Fali 3 jako known-behavior, NIE naprawiane |
| `assessments-v4` `x-organization-id` header trust fallback | NIE — inny moduł (findings/CAPA), zero powiązania z DRD Form/Matrix | Flagowane jako follow-up dla Codex |
| `assessment-workflow` V1 `org-default` fail-open | NIE — deprecated V1, brak DRD Form/Matrix zależności | Flagowane jako follow-up dla Codex |

## Test plan (przed Falą 3, potwierdzony przez discovery)

Real-PG contract: `published DRD definition → POST assessment (definitionId+version) → PUT answers.drd.areas → GET assessment → assert definition/version + answers + server completion + org scope`.

Negative controls (z audytu bezpieczeństwa, patrz agent 4):
1. org B token + org A assessmentId → GET/PUT/workbench/* → 404 (nie 403, nie 200)
2. create z `definitionId` nieopublikowanej/nieistniejącej/obcej org → reject
3. reopen po save → Matrix pokazuje identyczne achieved/target + completion co Form
4. V8 500/403/404/405/501 → legacy fallback → UI pokazuje "degraded" badge (nie milczy)
5. dwie równoległe karty PUT → udokumentować last-write-wins (nie naprawiamy, tylko potwierdzamy że nie ma false-success)

## Otwarte pytanie do Codex (nie blokuje startu Fali 2)

`CURRENT_MVP_CONTROL.md` (2026-08-01) opisuje "Linia A" jako `mw-core-001`
(Inbox→Task). Ten pakiet ASM-001A jest NOWĄ, osobną linią A dla Assessment —
zgodnie z jawnym poleceniem otwierającym tę sesję ("Jesteś głównym agentem
nowej Linii A"). Dokument sterujący nie odzwierciedla jeszcze tego
przypisania nazw. Nie blokuje pracy, ale warto zaktualizować
`CURRENT_MVP_CONTROL.md` po odbiorze, żeby "Linia A" nie oznaczała dwóch
różnych pakietów w dokumentacji.
