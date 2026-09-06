# RAPORT — naprawy nocne 2 (MVP 06.09)

Gałąź: `mvp/naprawy-noc-2` (worktree `/private/tmp/wt-fix2`, baza: `/private/tmp/m03` HEAD
`9e3bdbd1f8`). 4 commity, po jednym na defekt (poza defektem 4, dołączonym do commitu defektu 2 —
oba dotyczą tego samego pliku/audytu-punktu na tym samym ekranie).

Stanowisko pomiaru: własny vite w worktree, port **3092**, proxy na wspólny serwer `127.0.0.1:4100`
(org DBR77, seed z `/private/tmp/stanowisko-noc/`). Sesja: kopia `auth.json` → `auth-fix2.json`.

## Defekt 1 — Ocena: raport dla „Finalne" nie istnieje (BLOKER)

**Plik:** `src/utils/assessmentOutputArtifactsFlag.ts` (default `false`→`true`),
`src/routes/AppRoutes.tsx`, `src/components/assessment/AssessmentOutputsTab.tsx`.
**Commit:** `dd857e2ca4`.

`isAssessmentOutputArtifactsEnabled()` domyślnie `false` → obie trasy
(`/assessment/outputs/:id/report`, `.../presentation`) zawsze przekierowywały na
`/assessment?tab=outputs`, niezależnie od statusu assessmentu. Zmiana: default `true` w kodzie
(decyzja CTO z zlecenia), z opt-out awaryjnym przez `?ff_assessmentOutputArtifacts=0` /
localStorage.

**Uwaga A50 (macierz DRD → DRDMatrixGrid, nie AreaMatrixTable):** sprawdzone — komponent faktycznie
routowany (`AssessmentReportView` → `AssessmentReportDocument`) już używa `DRDMatrixReadOnly`
(opakowanie `DRDMatrixGrid`), NIE `AreaMatrixTable`. Zero zmiany potrzebnej — to było już naprawione
wcześniej (inna sesja).

**Czy raport renderuje treść?** Trasa działa poprawnie (zrzut `02-raport-flaga-ON-not-found.png`),
ale org DBR77 ma **0 method-core Outputów** (`GET /api/method/outputs` → `{"outputs":[],"total":0}`)
mimo 4 „assessmentów" (legacy sesje) ze statusem APPROVED/100%. To ten sam kształt błędu co
Inicjatywy (dwa równoległe magazyny danych — legacy `assessments`/`assessment_reports` vs
method-core `outputs`/`sessions`, seed poszedł do złego). **Nie naprawione tutaj** — osobna decyzja
architektoniczna, poza zakresem „włącz flagę". Na fikcyjnym outputId trasa poprawnie pokazuje
uczciwy stan „Nie znaleziono zamrożonego Outputu" po polsku, bez crasha.

## Defekt 2 — Ocena: pusty stan „No insights yet" po angielsku (BLOKER)

**Plik:** `public/locales/{pl,en}/translation.json`.
**Commit:** `dc9f12cafb`.

Brakujące klucze `assessment.outputs.emptyState.{title,description}` — dodane. Rodzina (grep):
dopisano też brakujące `assessment.outputs.forbidden.*` i `assessment.lineage.{forbidden,error,
unrecognized}.*` (ten sam wzorzec pustego/błędnego stanu w `ArtifactLineagePanel.tsx`).

## Defekt 4 — Ocena: zakładka „AI Triage" ucięta na 1440 (KOSMETYKA)

**Plik:** `src/components/assessment/AssessmentMenu3ActionBar.tsx`, `AssessmentHub.tsx`.
**Commit:** `dc9f12cafb` (razem z defektem 2 — ten sam ekran/audyt-punkt sąsiedni).

Przyczyna: `AssessmentMenu3ActionBar` owijał CAŁY wiersz (chipy + przycisk AI) w jeden
`overflow-x-auto` kontener zamiast dać scroll TYLKO chipom (wzorzec `StandardModuleBar`) — prawy
`shrink-0` z przyciskiem AI był częścią tego samego scrolla i w domyślnej pozycji wystawał poza
viewport. Naprawiono układ + dodano `t('assessment.hub.aiTriage', 'AI Triage')` z polskim
tłumaczeniem „AI Triaż" (literał był twardo po angielsku, poza i18n).

## Defekt 3 — Realizacja: kolumna TYP = surowy kod „EXE" (BLOKER)

**Plik:** nowy `src/labels/executionTypeLabels.ts`, `src/components/Execution/ExecutionHub.tsx`.
**Commit:** `de4fea049a`.

`getTypeCode()` mapowała teoretyczne klucze enum na 3-literowe kody; realne `initiative.axis`
(„Digital Processes", „Cybersecurity", „AI Maturity"...) nie trafiały w mapę → fallback `'EXE'` na
KAŻDYM wierszu. Nowy `executionTypeLabel()` dopasowuje po słowie kluczowym (case-insensitive),
fallback „Nieznany typ" (wzór `capacityUnitLabels.ts`). Naprawiono DWA miejsca (rodzeństwo — grep
`getTypeCode`): kolumna TYP w tabeli ORAZ `doc.subType` w `handleOpenDocument`, który zasila etykietę
zakładki otwartego dokumentu w `DynamicTabs.tsx` (ten sam kod wyciekał tam też).

**Pomiar rezydualny:** na lokalnym seedzie initiatives fazy realizacji mają `axis: null` — kolumna
dziś pokazuje „Nieznany typ" jednolicie (zrzut `09-execution-PO-pelna.png`). To NADAL usuwa BLOKER
(koniec z kodem wewnętrznym), ale pełne pokrycie wymaga populacji `axis` w seedzie (poza zakresem).

## Defekt 5 — Wywiad: 3 sesje o nazwie „Wywiad"

**Plik:** `src/components/Interview/InterviewHub.tsx`, `public/locales/{pl,en}/translation.json`.
**Commit:** `99ce8b780d`.

Dwie przyczyny: (a) `handleNewSession` wstawiał twardy angielski literał `Interview ${date}`,
ignorując `isPolish` — naprawione przez `t('interview.hub.newSessionDefaultName', ...)`; (b)
`getAssignmentTitle` (Skrzynka) spadał do gołego „Wywiad" gdy `template` puste (backend nigdy go
nie osadza) — dopisano `dueAt` jako odróżnik (NIE `createdAt` — identyczny dla całego seed-batcha).
Zrzuty PRZED/PO: `05-interview-PRZED.png` (3× identyczne) → `06-interview-PO.png` (3× różne) →
`08-interview-nowa-sesja-modal.png` (modal „Wywiad 06/09/2026").

## Testy i bramki

- `src/components/assessment/__tests__/AssessmentOutputsTab.test.tsx` — 11/11.
- `src/routes/__tests__/assessmentOutputArtifactsRoute.test.tsx` — 8/8 (przepisane z OFF→ON default).
- `src/labels/__tests__/executionTypeLabels.test.ts` — 5/5 (nowy).
- 4× `src/components/Execution/__tests__/*.test.tsx` — 13/13.
- `src/components/Interview/__tests__/InterviewHub.smoke.test.tsx` — 14/14.
- `src/components/Interview/__tests__/interviewDefaultSessionNames.pinOnSource.test.ts` — 3/3 (nowy).
- `tests/unit/i18n/i18nTrescPolska.test.ts` — 2/2 (ratchet nie rośnie).
- `bash scripts/check-list-canon.sh` — OK (dług spadł o 3).
- `bash scripts/check-artefakt.sh` — OK (dług nie rośnie).
- esbuild per plik dotknięty — czyste (exit 0) wszędzie.

## Co NIE naprawione (uczciwie)

- Assessment: org DBR77 ma 0 method-core Outputów — flaga działa, ale nie ma dziś żadnego
  realnego wiersza do otwarcia z kebaba Wnioski (dual-store bug, jak Inicjatywy).
- Execution: `axis` jest `null` na initiatives fazy realizacji w lokalnym seedzie — TYP pokaże
  „Nieznany typ" dopóki seed nie dostanie realnych wartości osi.
- Nie zmierzone: dark theme, 1280/1920px, przepływy klikane pełne (poza zakresem tego zlecenia).
