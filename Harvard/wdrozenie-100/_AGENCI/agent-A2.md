# ZLECENIE — Agent A2 · Klaster: Interview + Tools + Assessment + Audits
**Wznów:** [`_PROTOKOL.md`](_PROTOKOL.md) → to zlecenie → [`_STATUS.md`](_STATUS.md) → spec.
**Branch/worktree:** `reskin/A2/wave-<n>`

## Własność wyłączna (pliki)
`src/components/Interview/**` · `src/components/DiscoveryTools/**` · `src/views/discovery-tools/**` · `src/components/assessment/**` · `src/components/Audit/**`

## Zadania per fala
- **Fala 1 (Listy §14):** Interview (Sesje/Inbox/Assigned/Templates) · Tools Library · Assessment lista · Audits lista → Parity Gate §14.7.
- **Fala 2 (Artefakty §11.2+§13):** Interview Session (C-wariant konwersacyjny) · Discovery Tool (A, editor-shell) · **Tool detail page — ZAPROJEKTOWAĆ OD ZERA** (serce konsultingu, nigdy nie robione UI) · Assessment Session (D matryca) · **podłączyć DRDReportTemplate + zbudować DRDAssessmentMap** · Assessment Report (B) · Audit Report (B).
- **Fala 3 (Instrumenty §15):** macierze/mapy Assessment (SIRI/ADMA/DRD), heatmapy.
- **Fala 5 (Light).**

## Znane bugi (z walkthrough)
- Interview Menu 2 pill regresja (A-2) · multi-select (A-1) · Tools Edit Columns dramat (A-4, komponent z Fali 0) · Tools kebab za mało (A-6) · **Tools>Initiatives panel pokazuje bibliotekę zamiast inicjatyw (P1 bug renderowania)** · Assessment Edit Columns stare · Assessment brak ramek Menu 3 (A-3) · **Assessment session = generyczny „Shared Workbench" zamiast macierzy — podłączyć wizualizacje** · generator inicjatyw modal = lime green spoza palety.

## RAPORTY
<!-- Fala X · ekran · pliki · DoD · pominięte -->

### Fala 1 · sesja 2026-07-02 · branch `reskin/A2/wave-1` (7 commitów kodu + ten raport)

**Ekrany objęte:** Interview listy (Inbox/Assigned/Sessions/Templates/Insights/Initiatives — wszystkie w `InterviewHub.tsx`) · Assessment lista (`AssessmentTable.tsx`, `MyAssessmentsList.tsx`) · modal „Generuj inicjatywy" (`InitiativesGenerationWizardModal.tsx`) · Audits lista (`AuditsHub.tsx`) · Tools widoki kategorii (`src/views/discovery-tools/*.tsx`).

**Zrobione:**
1. **Migracja tokenów c.*** (mechaniczna, z guardem na warianty `hover:`/`/opacity`): `bg-white dark:bg-navy-900`→`bg-c-surface` · `bg-slate-50 dark:bg-navy-950`→`bg-c-bg` · `text-slate-500 dark:text-slate-400`→`text-c-text-muted` · `text-slate-900 dark:text-white|slate-100` + `text-navy-900 dark:text-white`→`text-c-text` · `text-slate-700|800 dark:text-slate-200`→`text-c-text-secondary` · `border-slate-200 dark:border-navy-700`→`border-c-border-subtle`. 8 plików, ~250 linii.
2. **Crimson-leak (InterviewHub):** wszystkie fokusy `*ring-primary-500*`→`ring-c-focus` (38 użyć po zmianie), `focus:border-primary-500`→`c-focus-solid`; **checkbox multi-select fill** crimson→`bg-navy-900` (1:1 wzorzec MyWork `MyTasksListContent`); **selection wierszy** (Insights/Templates/Initiatives) crimson→neutral+`var(--c-info)` accent (SYS-1); selected karta szablonu→neutral.
3. **Assessment lista:** tekstowe filtry „All/Draft/In Review/Approved"→**Menu 3 counter-chipy** (import `MENU_3_CHIP_ACTIVE/INACTIVE` + `Menu3Badge` z SSOT `ModuleMenu3.tsx`); status `AWAITING_APPROVAL` crimson→blue (chip statusu ≠ crimson); akcje wiersza i hover ikon→neutral; fokusy→`c-focus` (też `MyAssessmentsList`).
4. **Modal „Generuj inicjatywy" (lime-green bug):** emerald CTA→**standard primary** (navy-900/white↔`#F4F7FB`/navy-950, dokładny wzorzec `Button.tsx` variant `primary`); fokusy pól→`c-focus`; selekcja kart trybu→neutral; spinner→neutral; checkboxy→navy+`c-focus`. **Zostawiony emerald:** banner sukcesu po wygenerowaniu (semantyka success — zgodna z `c.success`).
5. **Audits:** lista już w dużej mierze na tokenach; jedyny leak (label presetu `text-primary-600`)→`text-c-text-muted`.
6. **Tools widoki kategorii:** back-linki `hover:text-primary-600`→neutral; inline-edit fokus→`c-focus-solid`.

**Menu 2 pill (regresja A-2) — LUKA, nie naprawiona lokalnie (CANON §3):** taby Interview renderuje **wspólny** `src/components/shared/ModuleHub/ModuleNavBar.tsx` (linie ~120-136: `TAB_BASE/TAB_ACTIVE` = underline `border-b-2`, komentarz powołuje się na VISUAL_STANDARD §5.5). InterviewHub nie ma własnych tabów Menu 2 — fix = podmiana `TAB_INACTIVE/TAB_ACTIVE` na `MENU_2_TAB_INACTIVE/ACTIVE` z `ModuleMenu3.tsx` **w pliku shared** (dotknie wszystkie moduły na ModuleHub). To robota/decyzja agenta Fundament — nie tworzyłem lokalnego wariantu i nie dotykałem shared.

**Multi-select (A-1) — diagnoza per tabela:**
- **Interview (wszystkie zakładki):** multi-select **JEST wired** — lokalne tabele (nie FilterableTable; 6 komentarzy w kodzie „wymaga re-architektury"): własne checkboxy + `selectedAssignmentIds/SessionIds/TemplateIds/InsightIds/InitiativeIds` + bulk bar F2 („N zaznaczonych · Odznacz · Archiwizuj/Usuń…" na `MENU_3_ACTION_NEUTRAL`). Checkbox był reveal-on-hover z crimson fill — po fixie navy; jeśli walkthrough widział „brak multi-select", prawdopodobnie hover-reveal (opacity-0) maskował afordancję. Do weryfikacji na żywo.
- **Tools (Library/Sessions/Outputs):** 3× `FilterableTable` **bez `selection` prop** i bez żadnego stanu selekcji w hubie → multi-select martwy. Wiring = nowy stan + handlery + bulk bar F2 z realnymi akcjami (archive/delete API) — NIE trywialne. **Uwaga:** plik to `src/components/Discovery/DiscoveryToolsHub.tsx` — **poza własnością A2** (moje: `DiscoveryTools/**`, `views/discovery-tools/**`). Wymaga przydziału (Strateg).
- **Assessment (AssessmentHub, 2× FilterableTable):** bez `selection` prop, zero stanu selekcji → jw., nietrywialne (bulk akcje wymagają API archive/delete). `AssessmentTable.tsx` to surowy `<table>` oznaczony `§27-todo` migracji do FilterableTable — Fala 2+.
- **Audits (AuditsHub):** FilterableTable bez `selection` prop, brak stanu selekcji; `buildRowActions` ma akcje per-wiersz reużywalne w bulk — ale to feature-work, nie re-skin.

**Edit Columns (A-4/A-Assessment):** w moich plikach NIE ma lokalnych paneli edit-columns z czerwonymi eye/CAPS — Interview ma własny popover „ustawienia widoku" (checkboxy, bez Eye-ikon, bez CAPS — OK po fixie fokusów); huby Assessment/Tools nie mają żadnego konfiguratora kolumn (AssessmentHub FilterableTable nawet bez `persistKey`). Czerwone eye = `src/components/Admin/shared/ColumnSelector.tsx` ~250-258 (`text-primary-600 bg-primary-100`) — **wciąż crimson mimo Fali 0**, plik poza moim klastrem → luka dla Fundamentu.

**Zostawione świadomie (wątpliwe / poza mandatem):**
- `text-primary-500` jako wskaźnik „filtr kolumny aktywny" w nagłówkach lokalnych tabel Interview (~15 użyć) — shared `FilterableTable.tsx:152` używa identycznie `text-primary-400`; zmiana tylko u mnie = rozjazd. Decyzja systemowa (proponuję `c-info`).
- `text-primary-600` jako check-color natywnych checkboxów — identyczne w shared FilterableTable (172/461/566); jw.
- `hover:border-primary-400` na checkboxach — dokładnie ten wzorzec ma referencja MyWork; zostawione dla 1:1 parity.
- Brand-chipy AI w Interview (5140/6163/9647) i brandowe kafle/gradienty w Tools widokach (`bg-primary-100` icon-boxy, `from-primary-500` gradienty) — brand momenty / robota Fali 2 (karty), nie mechaniczna.
- `bg-white dark:bg-navy-950` (inputy) — brak tokenu 1:1 (surface-light/bg-dark mix).
- Emerald banner sukcesu w modalu generatora (semantyka success).

**Znane bugi ze zlecenia — status:** Menu 2 pill→LUKA shared (wyżej) · multi-select→diagnoza per tabela (wyżej) · lime-green modal→**FIXED** · Assessment brak ramek Menu 3 (A-3)→**nie reprodukowalne w kodzie**: `AssessmentMenu3ActionBar` używa SSOT `MENU_3_*` + `getMenu3AiButtonClass` (oba z ramkami); możliwe że uwaga sprzed Fali 0 albo dot. innej powierzchni — do weryfikacji na żywo · Tools>Initiatives pokazuje bibliotekę (P1)→w `Discovery/DiscoveryToolsHub.tsx`, poza własnością, nie ruszane · Tools kebab (A-6)→jw., poza własnością.

**DoD:** zmiany = wyłącznie klasy CSS + importy istniejących eksportów (czytane przed importem); grep-sanity na literówki czysty; **build NIE odpalony** (worktree bez node_modules, zlecenie: zero npm) — wymaga `npm run build` + wizualnej weryfikacji light/dark przed odbiorem. `_STATUS.md` nie zaznaczone (scaffold _AGENCI nie istnieje na base tego brancha — żyje na `feat/deliverables-w1`; ten plik przyniesiony z 7337791aea, by raport commitować).
