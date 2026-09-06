# RAPORT — kosmetyka nocna (A3/B3) + 3 poprawki nadzorcy, 2026-09-06

Gałąź: `mvp/naprawy-noc-7` (worktree `/private/tmp/wt-fix7`, baza `codex/m03-admin-20260824`)
Stan końcowy: `dc5ddb144c` (8 commitów ponad `42dfd78b7b`)

## Zrobione (8 pozycji, 1 commit każda, `[ODMROZENIE <MODUŁ> DEC-397]`)

1. **(a) Wyniki ROI: „Nowa sprawa ROI" → „Nowa analiza"** — przycisk L1, pusty stan, tytuł modala.
   `ResultsRoiHub.tsx`, `RoiCaseCreateModal.tsx`. Zrzut: `b8-roi-l1.png`.
2. **(b) Materiały/Dokumenty: kolumna TYTUŁ 190→260px + `dataType:'text'`** — tytuły dokumentów
   („ADMA — Transformation Ro…") już nie ucinają się do ~17 znaków; -70px rozłożone na
   typ/status/source/review/exports/updatedAt (krótka treść, bez straty czytelności).
   `OutputsAggregateTabContent.tsx`. Zrzuty: `b-materialy-przed.png` → `b-materialy-po.png`
   (+ `-dark`).
3. **(c) Wyniki KPI L1: kolumna STAN 140→210px** — dystrybucja (bezpieczne/ostrzeżenie/krytyczne/
   brak danych) była ucinana przez `overflow-hidden`, liczba „8" (krytyczne) niewidoczna, sąsiednia
   kolumna OTWARTE DZIAŁANIA zaczynała się od razu za ucięciem. `kpiReportPresenters.tsx`
   (suma szerokości `KPI_REPORT_TABLE_WIDTH_PX` bez zmian). Zrzuty: `c-kpi-l1-przed.png` →
   `c-kpi-l1-po2.png` (+ `-dark`).
4. **RAPORT_A3 KOSMETYKA #4 — Moja Praca: panel podglądu jako `<aside>`** zamiast zwykłego `<div>`
   (niespójne z Wywiadem/Realizacją). `InboxContent.tsx` + nowy klucz i18n
   `myWork.inboxContent.previewAriaLabel` (pl/en). Zmierzone: `dom.aside.liczba` 0→1.
5. **RAPORT_B3 KOSMETYKA #8 — ROI: kafelek „Discounted Payback" → „Payback zdyskontowany"**
   (jedyny w pełni angielski kafelek karty Wyliczeń). `RoiCardSections.tsx`.
6. **RAPORT_B3 KOSMETYKA #11 — Finanse: DAYS zaokrąglone do pełnych dni** — CCC pokazywał
   „-234,897 dni" (domyślny `toLocaleString('pl-PL')` do 3 miejsc). Naprawione u źródła
   (`formatAnalysisKpiValueForDisplay`, `financeV2.types.ts`) — dotyczy też DSO/DPO/DIO.
   Live: „-235 dni". 18/18 testów `financeV2.types.test.ts` zielone.
7. **RAPORT_B3 KOSMETYKA #9 — „Panel Administratora" → „Panel administratora"** w globalnym
   pasku/sidebarze (Title Case niezgodny z polską ortografią i z lokalnym okruszkiem, który już
   miał poprawną pisownię). `public/locales/pl/translation.json` (`sidebar.adminPanel`).
8. **RAPORT_A3 KOSMETYKA #6 — Ocena: zero błędów konsoli na raporcie niezamrożonej oceny** —
   stary link bez prefiksu `ocena~` (np. `assess-drd-enterprise-01`) najpierw odpytywał jądro
   metodyczne o identyfikator, który z definicji nie jest tam UUID-em → pewny 404 w konsoli na
   każdym wejściu. Dodany `UUID_RE` pre-check w `reportApi.ts`: dla id bez prefiksu i bez kształtu
   UUID magazyn zastany sprawdzany od razu. Zero zmiany zachowania brzegowego — 9/9 testów
   `reportApi`/prezentacji zielone.

## Pominięte (wymagają decyzji produktowej lub zmiany danych — NIE ruszone)

- **RAPORT_A3 KOSMETYKA #5** — Narzędzia: 35/36 pozycji „już wkrótce" — decyzja produktowa o
  zakresie biblioteki na demo, nie defekt UI.
- **RAPORT_B3 KOSMETYKA #10** — KPI: nazwy grup właścicieli mieszają PL/EN („GD (SALES)") —
  dane seed, nie kod UI; zakaz zmiany danych w tym zleceniu.
- **RAPORT_B3 KOSMETYKA #12** — czerwona kropka przy „Model" w topbarze — możliwa świadoma
  semantyka, audyt sam rekomenduje potwierdzenie z właścicielem przed ruszeniem.

## Bramki końcowe

- `bash scripts/check-list-canon.sh` → ✓ brak nowych naruszeń (dług 364→361, spadek).
- `bash scripts/check-artefakt.sh` → ✓ brak nowych naruszeń crimson (8, baseline 8).
- `npx vitest run tests/unit/i18n` → 12/14 plików zielone; 3 testy czerwone to **dług zastany
  sprzed tej sesji** (commit `e5201bde50`, `git blame` potwierdza): klucz
  `settings.templates.system.enterprise.name` (pl=en=„Enterprise") + 4 brakujące klucze
  `ideas.table.recordTemplates.*`/`ideas.financial.col.*` w `en` — żaden z moich 8 commitów ich
  nie dotyka.

## Zrzuty (wszystkie w `evidence/mvp-naprawy-noc-7/`)

`b8-roi-l1.png`, `b8-roi-card2.png` (Payback zdyskontowany), `b-materialy-przed/po(.dark).png`,
`c-kpi-l1-przed/po2(.dark).png`, `a3-4-mywork-aside.png` (dom.aside=1), `a6-assessment-report-po.png`
(0 błędów konsoli), `b9-admin-po-crop.png` (spójna pisownia), `b11-fin-analiza-workspace.png`
(„-235 dni").
