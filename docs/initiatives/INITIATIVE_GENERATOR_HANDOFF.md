# Generator Inicjatyw — HANDOFF (stan pracy + plan)

> Przekazanie dla kolejnego agenta kodującego. Czytaj w kolejności:
> 1. [INITIATIVE_FORMULA.md](./INITIATIVE_FORMULA.md) — *co i dlaczego* (SSOT doktryny).
> 2. [INITIATIVE_GENERATOR_BUILD.md](./INITIATIVE_GENERATOR_BUILD.md) — *jak budujemy* (fazy + checklista audytu).
> 3. Ten plik — *gdzie jesteśmy i co dalej*.
> Data: 2026-06-07. Branch: `Londyn`.

## TL;DR
Budujemy **Generator Inicjatyw**: jedno wejście („Zaproponuj inicjatywę") wywoływane wszędzie tak
samo z `source`; robi przebieg **„Zaproponuj"** (czyta źródło + organizację + **siatkę istniejących
inicjatyw**) i zwraca **zestaw propozycji** z relacją do siatki (nie „1 inicjatywę"). Człowiek triażuje
na **Tablicy propozycji**. Nowe → charter-lite → DRAFT; zmiany istniejących → *suggested change* z
mini-bramką. Doktryna: MECE · Kerzner · Kaplan-Norton · McKinsey Five Frames.

## ⚠️ Ograniczenia (PRZECZYTAJ ZANIM ZACZNIESZ KODOWAĆ)
1. **Inny agent przebudowuje równolegle** `InterviewHub.tsx`, `InsightViewer.tsx`,
   `InitiativeDocumentView.tsx` (+ prawdopodobnie serwisy inicjatyw). **NIE edytuj jego plików.**
   Buduj **addytywnie** (nowe pliki) + cienki kontrakt props. Sprawdź `git status` przed startem —
   pliki z `M`, których nie tworzyłeś, są jego.
2. **Higiena commitów:** commituj **tylko swoje pliki** (`git add <konkretne ścieżki>`), NIGDY
   `git add -A`. (Raz InterviewHub trafił do staging z jego sesji — wyłapane i cofnięte.)
3. **`DB_MANAGED_SCHEMA=off`** → nowe kolumny tylko guarded lazy ALTER (`getTableColumns()`+`cols.has()`),
   zero migracji. Charter mapuje na istniejące pola; impact/effort siedzą w tagach do czasu decyzji.
4. **Tani stack AI (bez OpenAI), bywa timeout** → AI nigdy nie blokuje tworzenia; degraduj gracefully.
5. **RBAC:** create inicjatyw działa dla org-roli `user`. (Interview insight-generate było 403 dla
   ADMIN — naprawione, commit `f5f72a25a3`, fallback per-permission w `permissionService.ts`.)
6. **Repo w GDrive** → uważaj na markery konfliktu. **Format commita** kończy:
   `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.
7. **RULE właściciela:** każda zmiana UI → podgląd w przeglądarce + screenshot; nigdy „done" na samym tsc/eslint.

## Co zrobione (zacommitowane, zaudytowane ✅)
| Faza | Co | Commit | Dowód |
|---|---|---|---|
| 1 | **InitiativeCharterWizard** — single, charter-lite, 3 kroki, żywy impact×effort 2×2, gate preview, tworzy DRAFT z lineage | `888942b3e1` | zweryfikowany live, realny DRAFT utworzony |
| 2 | **proposalReconciliation** — rdzeń: 8 relacji + MECE coverage (czysty, deterministyczny) + testy | `d52fbdb7ee` | **12/12 vitest**, tsc+eslint czyste |
| 3 | **InitiativeProposalBoard** — Tablica propozycji: plakietki relacji, akcje per typ, evidence drawer, coverage strip | `a6677bfb74` | zweryfikowany live (luka „data_quality" widoczna) |
| — | SSOT Formuła + Five Frames + plan budowy/audytu | `8f0c762a61`,`85a3ca47c7` | — |
| — | RBAC fix (insight generation 403→200) | `f5f72a25a3` | live: 403→utworzono insight |

## Runda audytowa — wynik (Fazy 1–3)
- ☑ **Zero edycji plików drugiego agenta** — `git show --stat` na 6 commitach: dotykają tylko
  `proposalReconciliation.ts(.test)`, `InitiativeProposalBoard.tsx`, `InitiativeCharterWizard.tsx`,
  `permissionService.ts`, docs.
- ☑ **Testy** `tests/unit/initiatives/proposalReconciliation.test.ts` — 12/12 (po jednym na relację + coverage).
- ☑ **tsc** `--noEmit` czyste; **eslint** czyste dla 3 nowych plików.
- ☑ **Doktryna odzwierciedlona:** relacje §5 (8 typów), MECE coverage (luki+nakładania), one-funnel
  DRAFT + gate preview (§6), Five Frames jako oś (§1).
- ☑ **Weryfikacja wizualna:** Charter (3 kroki, 2×2 live) i Proposal Board (plakietki, drawer, gap) —
  screenshoty w wątku sesji. Temp-mounty cofnięte (App.tsx czysty, 0 śladów `TEMP-`).

## Co zostało (czeka na styk z przebudową agenta)
- **Faza 0 — wpięcie wejścia.** Jeden przycisk „Zaproponuj inicjatywę" w hubach/insighcie
  (`InsightViewer`, `InitiativesHub`, `InterviewHub`) → otwiera kreator z `source`+`mode`.
  **Edytuje pliki agenta → rób PO jego przebudowie.**
- **Faza 2b — silnik backend „Zaproponuj".** Dziś rdzeń (`proposalReconciliation`) jest po stronie
  klienta i deterministyczny. Docelowo: endpoint czytający source+org+siatkę, opcjonalnie AI do
  generacji kandydatów, ale **klasyfikacja relacji może zostać w `proposalReconciliation`**.
  Rozszerz istniejące `server/src/services/initiativeWizardService.ts` /
  `initiativeSimilarityService.ts` o relacje evidence-only/konflikt/re-priorytet (NIE nadpisuj —
  dodaj). Koordynuj z agentem.
- **Faza 4 — suggested changes.** Typ `SuggestedChange` + lista/akceptacja u właściciela inicjatywy +
  mini-bramka (przyjmij/odrzuć). Zmiana istniejącej NIGDY od ręki.
- **Faza 5 — coverage/MECE + wave.** Widok „luki pokrycia celów" (z `coverage`) + układanie w fale (WIP).

## Pliki, które stworzyłem (twoje punkty zaczepienia)
- `src/services/initiatives/proposalReconciliation.ts` — `classifyProposalRelation()`,
  `reconcileProposals()`, typy `CandidateInput`/`ExistingInitiative`/`ClassifiedProposal`/`CoverageReport`.
- `tests/unit/initiatives/proposalReconciliation.test.ts` — wzór testów (vitest; **dodawaj `git add -f`**, bo `/tests/` jest w .gitignore a i tak tracked).
- `src/components/Initiatives/Wizard/InitiativeProposalBoard.tsx` — props: `{proposals, coverage, source, onAcceptNew, onAcceptChange, onDismiss, isPolish}`.
- `src/components/Initiatives/Wizard/InitiativeCharterWizard.tsx` — props: `{isOpen, onClose, onCreated, projectId, source, isPolish}`.

## Reuse (nie pisz od nowa)
- Shell wizardów: `src/components/shared/WizardModal/*` (kanon, kontrolowany: `steps[]`+`activeStepIndex`+`onComplete`+`nextDisabled`).
- Create: `createInitiativeWriteTruth()` (`src/services/initiativeWriteTruth.ts`) → POST `/initiatives`, status DRAFT.
- Walidacja: `CreateInitiativeSchema` (`server/src/validators/initiative.validators.ts`).
- Bramki SSOT: `server/src/constants/initiativeStatuses.ts` (13 statusów + GATE_PERMISSIONS).
- Similarity/dedup: `server/src/services/initiativeSimilarityService.ts`, `src/utils/initiativeDuplicateDetection.ts`.
- Priorytet 2×2: `src/components/MyWork/table/IdeaScoringModel.tsx`, `mindmap/AIPriorityRecommender.tsx`.

## 5 otwartych decyzji produktowych (do domknięcia z właścicielem — NIE rozstrzygać samemu)
1. Owner+KPI wymagane już w DRAFT czy dopiero przy promocji do REVIEW?
2. Quick-create: zabić w module inicjatyw (łapanie pomysłów → stub w MyWork) czy zostawić?
3. Tryb Charter/Portfolio: auto wg kontekstu czy świadomy wybór? (właściciel skłaniał się ku „auto wg source")
4. Impact/effort: w tagach (zero migracji) czy dedykowane kolumny (guarded ALTER)?
5. Generator proponuje zmiany na biegnących (extend/re-priorytet) — **TAK** (właściciel potwierdził:
   „asystent portfela, nie tylko kreator"); zmiana zawsze jako suggested-change z mini-bramką.

## Jak weryfikować (dla ciebie)
- Test rdzenia: `npx vitest run tests/unit/initiatives/proposalReconciliation.test.ts`
- Lint: `npx eslint <plik>` (autofix: `--fix`); typy: `npx tsc --noEmit -p tsconfig.json` (wolne, cała apka).
- UI bez wpięcia: tymczasowy mount w `App.tsx` za flagą `localStorage.getItem('__x')==='1'`
  (NIE hash — app ma hash-routing i go nadpisuje), screenshot, **cofnij temp-mount**. Backend hot-reloaduje (`tsx watch`).

## Środowisko testowe (przydatne)
- Demo org ma 0 sesji wywiadów na starcie. Włącz **„Open Sample Workspace"** (menu konta) — ale
  sesje i tak trzeba utworzyć (jest szablon „Standard Work" itd.). Insight-generation działa po RBAC-fix.
- Preview: `mcp Claude_Preview` serverId z `preview_start` (był `consultify-dev` → port 3000).

## Następny rekomendowany krok dla ciebie
Poczekaj aż przebudowa drugiego agenta wyląduje (sprawdź `git log`/`git status`). Potem: **Faza 0**
(wpięcie „Zaproponuj inicjatywę" → otwiera `InitiativeCharterWizard` w trybie single z `source` z
insightu) jako pierwszy widoczny E2E, następnie **Faza 4** (suggested-changes). Po każdej fazie:
checklista audytu w `INITIATIVE_GENERATOR_BUILD.md` + screenshot + commit tylko swoich plików.
