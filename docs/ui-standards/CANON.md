# Consultify UI/UX — CANON

> **JEDYNY AUTORYTET I JEDYNY FRONT** dla wszystkich decyzji UI/UX.
> Wersja: **v3.1** — konsolidacja 2026-06-14, remediation po czwartym audycie 2026-08-02 (§2.1, §9).
> Kto stosuje: każdy dev, każdy agent AI, każde code review.

To jest jedyny dokument, który **ogłasza** standard. Wszystko inne w `docs/ui-standards/` jest albo **warstwą szczegółu** podległą temu kanonowi, albo **archiwum historii** (`_archive/`). Jeśli czegoś tu nie ma — patrz właściwa warstwa (§7). Jeśli nie ma nigdzie, zastosuj `THEORETICAL_PHASE_CLOSURE_2026-08-02.md`: decyzje systemowe rozstrzygaj przez kanon, a właściciela angażuj wyłącznie w nieredukowalne decyzje biznesowe.

---

## 0. Status i autorytet

Ten kanon zastępuje jako **autorytet** cztery wcześniejsze dokumenty, które rozmazywały prawo po wielu plikach:

| Dokument | Co wnosił | Status |
|---|---|---|
| `README.md` | indeks + „nie wymyślaj standardów" | → rola indeksu przejęta przez §7; pozostaje jako nawigacja pomocnicza |
| `CONSULTIFY_UI_UX_GOLDEN_STANDARD.md` | treść produktowo-wizualna | → treść dystrybuowana do warstw `00–03`; **ważna do końca migracji**, oznaczona banerem |
| `CONSULTIFY_UI_UX_OPERATING_STANDARD.md` | governance / kontrakt pracy | → wcielone do §3–§5 i §8 |
| `UI_UX_CANON_V3.md` | legacy v3 (21 reguł MUST) | → kontekst historyczny; brak unikalnej treści ponad warstwy |

**Zasada przejściowa:** dopóki migracja treści do warstw nie jest zakończona (Faza 2), powyższe pliki **pozostają ważne jako szczegół** — ale nawigację i rozstrzyganie konfliktów prowadzimy **wyłącznie przez ten kanon**.

---

## 1. Żelazna zasada

> **Ekrany funkcjonalne nie wymyślają wyglądu. Składają zatwierdzone komponenty Consultify.**
> *Feature screens do not own visual design. Feature screens compose approved components.*

Z tej zasady wynika wszystko poniżej. Nowy „lokalny" wygląd w ekranie funkcjonalnym = `unapproved UI` = kandydat do refactoru, nie standard.

---

## 2. Hierarchia prawdy (rozstrzyganie konfliktów)

Gdy dokumenty/kod są sprzeczne, obowiązuje kolejność:

1. **`CANON.md`** (ten plik) — najwyższy autorytet.
2. **Warstwy szczegółu** — `00-foundation` → `01-shell-layout` → `02-components` → `03-modules`. Doprecyzowują kanon, nie nadpisują go.
3. **Kod SSOT** — pliki implementacji wymienione w §6. Egzekwują reguły w runtime.
4. **Implementacje referencyjne** — ekrany jawnie wskazane jako wzorzec w docs.
5. **`_archive/`** — kontekst historyczny (plany, audyty, evidence, superseded). **NIGDY autorytet.**

> **Reguła rozstrzygania:** jeśli kod robi Y, a standard mówi X — to kod jest kandydatem do refactoru. **Nie tworzymy trzeciego wariantu.**

### 2.1 Konflikt między dokumentami tego samego poziomu (dodane 2026-08-02)

Hierarchia z §2 rozstrzyga konflikty **między warstwami**. Czwarty audyt (2026-08-02) wykazał, że najgroźniejsze sprzeczności powstawały **wewnątrz jednego poziomu** — bo dwa dokumenty deklarowały się jako „jedyne źródło prawdy" dla tego samego ekranu. Obowiązuje więc dodatkowo:

1. **Anatomia ekranu listowego** (co, ile, w jakiej kolejności: Menu 1/2/3, tabela, pstryczek, kebab, preview, kanban) → **`TRIADA_KANON.md`**. Ustanowiony przez właściciela na żywych ekranach; `03-modules/TABLE_AND_PREVIEW_CANON.md` opisuje **mechanikę i szczegół implementacyjny** tej anatomii i nie może jej redefiniować.
2. **Anatomia ekranu-artefaktu** → **`ARTIFACT_ANATOMY_STANDARD.md`** (SPEC-A). Analogicznie: warstwy `02-components` doprecyzowują, nie nadpisują.
3. **Wartości liczbowe** (wymiary, wysokości, radiusy, z-index, motion) → **`00-foundation/FOUNDATION_TOKEN_CONTRACT.md`**. Wyjątek: gdy kanon anatomii podaje wartość dla **konkretnej powierzchni**, a kontrakt tokenów dla **klasy powierzchni**, to nie jest konflikt — to dwie różne powierzchnie i obie wartości obowiązują (wzorzec: preview listowy `clamp(340px, 28%, 480px)` vs prawy panel artefaktu 360 px / 320–420 px).
4. **Semantyka koloru i fokus** → `00-foundation/color-system.md` + `FOUNDATION_TOKEN_CONTRACT.md` §7, przy czym **zakazy z `TRIADA_KANON.md` §A10 są nienaruszalne**: crimson (`primary-*` = `#85182F`) nigdy jako fokus, stan aktywny, zaznaczenie ani CTA zwykłego modułu; fokus zawsze `--c-focus` (niebieski).

**Zakaz roszczenia do wyłączności:** żaden dokument warstwy `00–03` nie może napisać o sobie „jedyne źródło prawdy" dla obszaru, który ma już właściciela wskazanego wyżej. Takie zdanie jest błędem redakcyjnym do usunięcia, nie ustanowieniem autorytetu.

**Rozbieżność doc↔kod nie jest rozstrzygana przez wybór ładniejszej wartości.** Zmierz ją (grep + liczba plików), zapisz w [`_DOC_CODE_DELTA_REGISTER.md`](_DOC_CODE_DELTA_REGISTER.md) i rozstrzygnij jawnie, wskazując, która strona ma dług.

---

## 3. Governance — protokół zmiany standardu

Standard ewoluuje **świadomie**, nigdy przez improwizację.

### 3.1 Procedura nowego komponentu/wzorca
Gdy zatwierdzone komponenty nie pasują:
1. **Nie** buduj lokalnego UI w ekranie jako finalnego rozwiązania.
2. Opisz problem: czego brakuje, w jakich ekranach, jaki workflow tego wymaga.
3. Zaproponuj zakres: rozszerzenie komponentu / nowy primitive / nowy composed / nowy shell / jednorazowy wyjątek migracyjny.
4. **Dopisz regułę do właściwej warstwy** (`00–03`). Nie zakładaj konkurencyjnego pliku-autorytetu.
5. Dopiero po decyzji użyj komponentu w ekranie.

### 3.2 Protokół zmiany (MUST)
- Zmiana standardu = edycja właściwej warstwy **+ wpis w changelogu** (§9). Bez tworzenia „vN".
- **Luka** w standardzie = oznaczona jawnie w dokumencie (`świadoma luka`), nie wypełniana nowym samowolnym plikiem.
- **Integralność referencji:** przed usunięciem/przeniesieniem JAKIEGOKOLWIEK pliku — `grep -rl` grafu referencji (FROZEN_LAYOUTS, READMEs, kanony). Zero martwych linków. **Egzekwowane automatycznie:** `npm run docs:links` (skanuje wszystkie względne linki `.md` w tym katalogu, exit 1 przy martwym). Uruchom przed każdym PR ruszającym dokumenty standardów.

### 3.3 Proces review / approval
Każda migracja ekranu/komponentu: (1) opisz obecny stan, (2) porównaj z kanonem, (3) decyzja: approved / approved-with-correction / rejected / needs-new-standard, (4) zaktualizuj docs jeśli decyzja tworzy nową regułę, (5) wdroż tylko zatwierdzony zakres, (6) zamroź wzorzec jako referencję.

---

## 4. Zachowania UX nienaruszalne (MUST NOT)

### 4.1 Honest UI — zakazane
fake success · silent fail · nieskończony spinner bez recovery · raw backend error jako jedyny komunikat · `[object Object]` · `NaN` / `Infinity` / `Invalid Date` · stack trace w UI · „Something went wrong" gdy można podać lepszy stan.

### 4.2 Save state ≠ lifecycle state
`Saved / Saving / Save failed` = trwałość danych. `Draft / In Review / Approved / Generated / Failed` = lifecycle. Nie mieszaj.

### 4.3 Akcje destrukcyjne
wariant danger + confirm modal + jasna nazwa skutku + brak side-effectu bez potwierdzenia + toast/error po wyniku.

### 4.4 Governance / AI actions
bez silent execution · bez ukrytego uczenia · bez automatycznej trwałej zmiany danych bez decyzji użytkownika · zawsze audyt po mutacji.

### 4.5 Control bars / toolbary
Dokładnie **jeden Command Row** (Menu 3) pod topbarem. Toolbary nie dublują Module Topbar, nie tworzą 2./3. rzędu, nie hostują AI actions (te = prawa strona Menu 3). Kontrolki widoku (zoom timeline itp.) żyją w View-local Toolbar, wewnątrz powierzchni widoku.

---

## 5. Definition of Done dla pracy UI

Zmiana UI jest „done" tylko gdy: używa zatwierdzonego shell/wzorca · przyciski zgodne z taksonomią · Menu 2/3 respektowane · brak dodatkowego rzędu toolbara · AI actions we właściwym miejscu · anatomia table/card/timeline/preview zgodna ze standardem · dark i light czytelne · stany empty/loading/error uczciwe · uprawnienia/locked respektowane · etykiety domenowe i zrozumiałe · **brak nowego lokalnego języka wizualnego**.

---

## 6. Doc ↔ Kod binding (egzekwowalne SSOT)

Każda egzekwowalna reguła wskazuje swój **jedyny** plik implementacji:

| Reguła / obszar | Kod SSOT | Warstwa-doc |
|---|---|---|
| Typografia L1–L5, N, Q | `src/styles/typography.ts` | `03-modules/BLOCK_TYPES_CANON.md` |
| Semantyka kolorów (tokeny) | `src/index.css` (`--c-*`) | `00-foundation/color-system.md` |
| Mapowanie statusów (runtime) | `src/constants/statusColors.ts` (`getStatusStyle`, `getPriorityStyle`) | `00-foundation/light-mode-readability.md` |
| Preview action buttons — komponent (rows/overflow, portal, pozycjonowanie) | `src/components/shared/PreviewPane/PreviewActionBar.tsx` (`PreviewActionBar`) | `03-modules/TABLE_AND_PREVIEW_CANON.md` §7.3b |
| Preview action buttons — klasy pigułki/warianty koloru | `src/components/shared/PreviewPane/previewStyles.ts` (`PREVIEW_PILL_BASE`, `PillColorScheme`, `actionPillClass`) | `03-modules/TABLE_AND_PREVIEW_CANON.md` §7.3b |
| Menu 3 chipy / AI buttons | `src/components/shared/ModuleHub/menu3ActionButtonStyles.ts` + `src/components/shared/ModuleMenu3.tsx` | `03-modules/module-hub-standard.md` |
| Row actions (kebab) | `src/components/shared/RowActionsMenu.tsx` (`RowActionSection`) | `03-modules/TABLE_AND_PREVIEW_CANON.md` §9 |
| Field-level AI | `src/components/shared/NModeLayout/FieldAIButton.tsx` | `03-modules/BLOCK_TYPES_CANON.md` §B4 |
| Toolbar artefaktu (shell) | `NMODE_TOOLBAR_SHELL_CLASS` + `NModeToolbar.tsx` | `01-shell-layout/n-mode-card-standard.md` |
| N-mode layout (cały kit) | `src/components/shared/NModeLayout/` | `01-shell-layout/presentation-modes.md` |
| Motion (≤220ms, scoped, zero bounce) | `npm run lint:motion` / `:ci` (`server/scripts/check-motion-compliance.ts` + `.motion-baseline.json`) | `00-foundation/visual-language.md` §9 |
| Kolor / light-mode (NIE grep-lint — patrz §18) | VISUAL SWEEP (`docs/qa/MASTER_VISUAL_QA_CATALOG.md`) + `scripts/audit-ui-compliance.js` | `00-foundation/light-mode-readability.md` §18 |
| Fokus = `--c-focus`, nigdy `primary-*`/crimson | `npm run lint:focus` / `:ci` (`scripts/check-focus-canon.sh` + `.focus-baseline.json`) | `00-foundation/FOUNDATION_TOKEN_CONTRACT.md` §7 · `TRIADA_KANON.md` §A10 |
| Rozbieżności doc↔kod (zmierzone) | `_DOC_CODE_DELTA_REGISTER.md` (wpis wymaga polecenia pomiaru + liczby) | `00-foundation/FOUNDATION_TOKEN_CONTRACT.md` §11 |

**Reguła:** nowa egzekwowalna reguła w kanonie = musi wskazać (lub utworzyć) swój kod SSOT. Reguła bez bindingu jest tylko intencją.

---

## 7. Nawigacja (master index)

```
docs/ui-standards/
├── CANON.md                  ← TEN PLIK — jedyny autorytet i front
├── UI_UX_IMPLEMENTATION_STANDARD.md ← kompletny kontrakt implementacji i odbioru ekranów
├── MODULE_UI_UX_COMPLIANCE_MATRIX.md ← 19 modułów: spec · evidence · status zgodności
├── THEORETICAL_PHASE_CLOSURE_2026-08-02.md ← decyzje właścicielskie zamknięte, remediation dokumentacji otwarte
├── SKEPTICAL_DOCUMENTATION_ACCEPTANCE_AUDIT_2026-08-02.md ← niezależny odbiór i blokery P0
├── DOCUMENTATION_REACCEPTANCE_2026-08-02.md ← PASS FOR IMPLEMENTATION po zamknięciu P0
├── DEEP_SKEPTICAL_AUDIT_ROUND_3_2026-08-02.md ← trzeci audyt jakości i zgodności z kodem
├── FINAL_DOCUMENTATION_ACCEPTANCE_2026-08-02.md ← aktualny odbiór 9,6/10
├── CLAUDE_DOCUMENTATION_HANDOFF.md ← instrukcja zewnętrznego review
├── TRIADA_KANON.md           ← ★★★ SSOT ekranów LISTOWYCH (Menu·Tabela·Preview·Kanban) — patrz §7.1
├── 00-foundation/            ← tokeny, kolor, typografia, język wizualny, motion
├── 01-shell-layout/          ← app shell, topbar, tryby D/N/C, artifact shell
├── 02-components/            ← katalog WSZYSTKICH komponentów współdzielonych
├── 03-modules/               ← kanony: tabele+preview, bloki, insight, inicjatywa, timeline
├── FROZEN_LAYOUTS.md         ← aneks: układy ZAMROŻONE (nie zmieniaj bez decyzji PO/CTO)
└── _archive/                 ← historia: plany migracji, audyty, evidence (NIE prawo)
```

### 7.1 SSOT poza warstwami 00-03 (ustanowione po v3.0 — dopisane tu, żeby nawigacja nie kłamała)

- **[`TRIADA_KANON.md`](TRIADA_KANON.md)** — ★★★ absolutny kanon ekranów LISTOWYCH (Menu 1/2/3 · Tabela · Preview · Kanban), ustanowiony przez właściciela 2026-07-04 na żywych ekranach My Work. Implementacja: `src/components/standard/` (StandardModuleBar · StandardTable · StandardPreview). Uzupełnia (nie konkuruje z) `03-modules/TABLE_AND_PREVIEW_CANON.md`. Egzekwowanie: `scripts/check-list-canon.sh`.
- **[`ARTIFACT_ANATOMY_STANDARD.md`](../../Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md)** — SSOT ekranów-ARTEFAKTÓW (SPEC-A: Canvas·Dokument·Rekord·Matryca·Deck), analogiczny do TRIADA dla list. **Uwaga lokalizacji:** żyje poza tym drzewem, w `Harvard/wdrozenie-100/` (nie `docs/ui-standards/`) — historyczny artefakt organizacji repo, nie przenosimy bez osobnej decyzji. Egzekwowanie: `scripts/check-artefakt.sh`.
- **[`DOKTRYNA_GESTOSCI.md`](DOKTRYNA_GESTOSCI.md)** — kanoniczna doktryna gęstości (`APPROVED_SPEC`): progressive disclosure, limity regionów, zakaz pustki, dubli i płaskiego wysypu.
- **[`_DOC_CODE_DELTA_REGISTER.md`](_DOC_CODE_DELTA_REGISTER.md)** — rejestr **zmierzonych** rozbieżności dokumentacja↔kod (§2.1). Wpis wymaga polecenia pomiaru, liczby i ścieżki; zakaz wpisów opartych na deklaracji lub pamięci. Metoda wzorowana na `BRAND_EXPORT_CANON.md` §0.
- **[`00-foundation/BRAND_EXPORT_CANON.md`](00-foundation/BRAND_EXPORT_CANON.md)** — ★★★ zatwierdzony SSOT eksportów-do-klienta (PPTX·DOCX·XLSX·PDF), analogiczny do TRIADA/ARTIFACT_ANATOMY. **Status: APPROVED_SPEC; bramka B-P5 zamknięta 2026-08-02.** Kod generatorów wymaga jeszcze konwergencji w zadaniach VF3-2/3/4. Uzupełnia `docs/product/DELIVERABLE_FORMATTING_SPEC.md`.

### Warstwy szczegółu
- **[`UI_UX_IMPLEMENTATION_STANDARD.md`](UI_UX_IMPLEMENTATION_STANDARD.md)** — kompletny, przekrojowy kontrakt ekranu: shell, listy, preview, N-mode, artefakty, wizardy, stany, AI, a11y, responsive, Visual QA i DoD.
- **[`MODULE_UI_UX_COMPLIANCE_MATRIX.md`](MODULE_UI_UX_COMPLIANCE_MATRIX.md)** — operacyjna macierz 19 modułów, funkcji My Work, evidence i decyzji odbiorowych.
- **[`STRUCTURE_AND_MIGRATION.md`](STRUCTURE_AND_MIGRATION.md)** — docelowa organizacja, zasady migracji oraz zakaz uznawania nieodebranych screenshotów za referencję.
- **[`THEORETICAL_PHASE_CLOSURE_2026-08-02.md`](THEORETICAL_PHASE_CLOSURE_2026-08-02.md)** — rejestr zatwierdzonych decyzji właścicielskich; warstwa dokumentacyjna ma status `NEEDS_REMEDIATION`.
- **[`SKEPTICAL_DOCUMENTATION_ACCEPTANCE_AUDIT_2026-08-02.md`](SKEPTICAL_DOCUMENTATION_ACCEPTANCE_AUDIT_2026-08-02.md)** — niezależny odbiór dokumentacji, wynik `FAIL`, sześć blokerów P0 i kryteria ponownego odbioru.
- **[`DOCUMENTATION_REACCEPTANCE_2026-08-02.md`](DOCUMENTATION_REACCEPTANCE_2026-08-02.md)** — ponowny niezależny odbiór po remediation: `PASS FOR IMPLEMENTATION`, 8,8/10; wyraźnie oddziela gotową specyfikację od nieodebranego runtime.
- **[`DEEP_SKEPTICAL_AUDIT_ROUND_3_2026-08-02.md`](DEEP_SKEPTICAL_AUDIT_ROUND_3_2026-08-02.md)** — trzeci audyt: dryf doc↔kod i ogólność kart wykryte oraz naprawione.
- **[`FINAL_DOCUMENTATION_ACCEPTANCE_2026-08-02.md`](FINAL_DOCUMENTATION_ACCEPTANCE_2026-08-02.md)** — aktualny odbiór `PASS FOR IMPLEMENTATION`, 9,6/10.
- **[`CLAUDE_DOCUMENTATION_HANDOFF.md`](CLAUDE_DOCUMENTATION_HANDOFF.md)** — kolejność czytania i zadanie dla niezależnego recenzenta.
- **[`00-foundation/ICONOGRAPHY_AND_ACTION_STANDARD.md`](00-foundation/ICONOGRAPHY_AND_ACTION_STANDARD.md)** — jedna biblioteka ikon, rozmiary, stałe znaczenia i kontrakt toolbar/kebab/prawy klik/AI.
- **[`00-foundation/FOUNDATION_TOKEN_CONTRACT.md`](00-foundation/FOUNDATION_TOKEN_CONTRACT.md)** — normatywne wartości typografii, spacingu, wymiarów, ikon, regionów, elevation, z-index, motion, viewportów i kontrastu; rozstrzyga konflikty liczbowe.
- **[`00-foundation/CONTENT_LOCALE_AND_MICROCOPY_STANDARD.md`](00-foundation/CONTENT_LOCALE_AND_MICROCOPY_STANDARD.md)** — PL/EN, ton, błędy, formaty, overflow, pseudo-locale i AI copy.
- **[`02-components/PRIMITIVE_INTERACTION_CONTRACT.md`](02-components/PRIMITIVE_INTERACTION_CONTRACT.md)** — normatywna semantyka, klawiatura, focus, dismiss, portal i testy primitives.
- **[`02-components/COMPONENT_RUNTIME_BINDING_REGISTRY.md`](02-components/COMPONENT_RUNTIME_BINDING_REGISTRY.md)** — 26 rodzin powiązanych z realnymi ścieżkami kodu.
- **[`02-components/COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md`](02-components/COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md)** — unikalne kryteria akceptacji 26 rodzin.
- **[`MVP_END_TO_END_UX_FLOWS.md`](MVP_END_TO_END_UX_FLOWS.md)** — backbone i przepływy end-to-end My Work oraz przejścia między modułami.
- **[`COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`](COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md)** — wymagane fixture, baseline, a11y i status odbioru wszystkich 26 rodzin.
- **[`02-components/families/README.md`](02-components/families/README.md)** — 26 rodzin komponentów; pierwsze pięć ma kompletne karty `APPROVED_SPEC`, pozostałe jawne karty `DRAFT`.
- **`00-foundation/`** — `color-system.md` · `visual-language.md` · `light-mode-readability.md` · `canvas-mode.md` · `artifact-identity-map.md` · `BRAND_EXPORT_CANON.md` (DRAFT — patrz §7.1)
- **`01-shell-layout/`** — `presentation-modes.md` (tryby D/N/C) · `n-mode-card-standard.md` · `shared-nmode-sections-standard.md` · `artifact-shell.md` · `artifact-shell-future-standard.md` · `app-topbar-standard-v3.md`
- **`02-components/`** — `shared-sections.md` · `decision-panel.md` · `task-panel.md` · `notification-panel.md` · `building-blocks.md` · `empty-loading-states.md` (stany empty/loading uczciwe — CANON §4.1/§5) · `MICRO_INTERACTIONS_CANON.md` (★ katalog 12 wzorców mikro-interakcji ZAMROŻONY — hover-reveal/kebab/accordion/toast/skeleton/lista→preview/drag-kanban/kolumny/modal/focus-ring/streaming/zapis, każdy z tokenem `--motion-*` + plik-binding, Vegas VF0-9) · `help-*` · `workspace-3-tools-strip.md` · `navigation-permissions-canon.md` (nawigacja cross-tool + bramki uprawnień, ref sweepu L1) …
- **`03-modules/`** — `TABLE_AND_PREVIEW_CANON.md` · `BLOCK_TYPES_CANON.md` · `INSIGHT_CANON.md` · `INITIATIVE_CANON.md` · `TIMELINE_CALENDAR_CANON.md` · `module-hub-standard.md` · `interactive-board-standard.md` · `tools-library-detail-standard.md`

### Aneks
- **`FROZEN_LAYOUTS.md`** — pinowane układy (sidebar order, My Work taby, module topbar, view-modes order, 1 Command Row, App Table+Preview, Workspace 3-tools strip). Zmiana = świadoma decyzja PO/CTO.

> **Uwaga przejściowa (do końca Fazy 2):** szczegółowa treść produktowo-wizualna z `CONSULTIFY_UI_UX_GOLDEN_STANDARD.md` jest stopniowo dystrybuowana do warstw `00–03`. Dopóki to trwa, Golden Standard pozostaje ważny jako szczegół — z banerem wskazującym ten kanon jako autorytet.

---

## 8. Reguła dla agentów AI

Każdy agent (Claude, Cursor) **musi przeczytać ten kanon przed pracą nad UI**. Jeśli prośba jest sprzeczna z kanonem, agent musi: (a) wyjaśnić konflikt i zaproponować zgodną implementację, **albo** (b) poprosić o jawną zgodę na zmianę standardu. **Nigdy** po cichu nie tworzy konkurencyjnego wzorca UI/UX.

---

## 9. Changelog

| Data | Wersja | Zmiana |
|---|---|---|
| 2026-08-02 | v3.1 | **Korekta po panelu adwersaryjnym (K-01):** §6 binding „Preview action buttons" wskazywał `previewStyles.ts` jako plik komponentu `PreviewActionBar` — zweryfikowano (`grep -n "PreviewActionBar" src/components/shared/PreviewPane/previewStyles.ts` → 0 trafień); komponent realnie żyje w `PreviewActionBar.tsx`, `previewStyles.ts` ma tylko stałe klas/warianty. Rozdzielono na dwa wiersze bindingu. Źródło: `_KOREKTY_PO_PANELU_ADWERSARYJNYM_2026-08-02.md` K-01. |
| 2026-08-02 | v3.1 | **Czwarty niezależny audyt — werdykt `FAIL`, remediation wykonana.** Audyt cofnął ocenę 9,6/10 i wykrył 7 blokerów P0, których trzy poprzednie rundy nie złapały, bo mierzyły liczbę dokumentów i nagłówków zamiast treści. Zamknięte: (a) **sprzeczność reguły fokusa** — `light-mode-readability.md` nakazywał `ring-primary-500`, co po zmianie palety znaczy crimson, czyli dokładnie to, czego `TRIADA_KANON.md` §A10 zakazuje jako naruszenie blokujące odbiór; (b) **martwa paleta fioletowa** `#7C3AED` w `color-system.md` i `visual-language.md` (w tym migration guide, który kazał migrować `blue/amber/indigo → primary`, czyli zamalować aplikację crimsonem); (c) **12 z 20 sekcji identycznych bajt-w-bajt we wszystkich 26 kartach rodzin** — po naprawie 17 z 20 sekcji jest unikalnych, 0 identycznych; (d) **pięć różnych szerokości panelu** w `ARTIFACT_ANATOMY_STANDARD.md` → rozdzielone na dwie realne powierzchnie; (e) **dwa konkurujące modele kebaba i preview** (TRIADA vs TABLE_AND_PREVIEW_CANON, oba deklarujące wyłączność) → hierarchia rozstrzygnięta w §2.1; (f) **`FROZEN_LAYOUTS.md` zamrażał stan nieaktualny** (fioletowy chip Menu 3 wobec neutralnego w kodzie); (g) **brak śladu dowodowego decyzji właścicielskich** → wymóg pola źródło/data/forma. Dodano: §2.1 (konflikt dokumentów tego samego poziomu), `_DOC_CODE_DELTA_REGISTER.md`, `npm run lint:focus` jako miernik długu, kontrakt generatora SPEC-W oraz kontrakt zakresu AI, limitów wydajności i klawiatury dla canvasu. **Runtime pozostaje `PARTIAL`** — naprawiono dokumentację, nie produkt. |
| 2026-08-02 | v3.0 | **Trzeci sceptyczny odbiór:** skorygowano token contract względem kodu SSOT; dodano runtime bindings, unikalne kryteria 26 rodzin, content/locale i handoff. Wynik 9,6/10; runtime nadal `PARTIAL` do evidence per rodzina. |
| 2026-08-02 | v3.0 | **Ponowny odbiór dokumentacji:** 26/26 kart ma metrykę i 20 sekcji; P0 dokumentacyjne zamknięte; wynik 8,8/10 `PASS FOR IMPLEMENTATION`. Runtime pozostaje `PARTIAL` do czasu fixture, visual, a11y i E2E. |
| 2026-08-02 | v3.0 | **Remediation P0 rozpoczęte:** ustanowiono jeden normatywny kontrakt wartości liczbowych, kontrakt primitives, przepływy MVP oraz macierz evidence. Rozstrzygnięto Menu 3=44px i zasady border/elevation. |
| 2026-08-02 | v3.0 | **Niezależny sceptyczny odbiór:** decyzje właścicielskie pozostają zamknięte, ale cofnięto akceptację kompletności dokumentacji. Wynik 5,8/10, `FAIL_REMEDIATION_REQUIRED`; 21/26 kart to szkielety, 0/26 spełnia wprost pełny standard karty. Dodano sześć blokerów P0 przed masową naprawą UI. |
| 2026-08-02 | v3.0 | **Bramka właścicielska zamknięta:** branding MVP wyłącznie Consultify/DBR77; sharing zewnętrzny wyłącznie przez wygasający, audytowany link read-only; osiem funkcji bez własnego modułu otrzymało zatwierdzone miejsca docelowe lub status wewnętrzny. Brak otwartych decyzji teoretycznych blokujących MVP. |
| 2026-08-02 | v3.0 | **Zamknięcie fazy teoretycznej:** dodano rejestr decyzji i kanon ikonografii, rozdzielono dojrzałość specyfikacji od stanu runtime oraz rozstrzygnięto menu, lifecycle, preview, gęstość i AI. Pozostały trzy decyzje właścicielskie: branding eksportów, sharing zewnętrzny i publiczny zakres ośmiu funkcji-sierot. |
| 2026-08-02 | v3.0 | **Domknięcie standardu implementacyjnego:** dodano `UI_UX_IMPLEMENTATION_STANDARD.md` jako kompletną warstwę szczegółu dla wszystkich typów ekranów oraz `MODULE_UI_UX_COMPLIANCE_MATRIX.md` jako egzekwowalny rejestr 19 modułów. Zadania i Decyzje ustanowiono wzorcami referencyjnymi My Work; dodano obowiązkowy pakiet Visual QA i klasyfikację wyniku review. |
| 2026-07-19 | v3.0 | **VF0-9 (katalog mikro-interakcji):** nowy `02-components/MICRO_INTERACTIONS_CANON.md` — 12 wzorców ZAMROŻONA lista (hover-reveal · kebab · accordion · toast · skeleton-crossfade · lista→preview · drag-kanban · pstryczek kolumn · modal · focus-ring · streaming Teresy · zapis-potwierdzenie), każdy z tokenem `--motion-*`/`--motion-ease`, wariantem `prefers-reduced-motion` i plikiem-implementacji (doc↔kod binding §6). Dokument-specyfikacja, **nie dotyka `src/`** — 6/12 wzorców już zgodne w kodzie (2 z nich, accordion i focus-ring, referencyjne), 2/12 to realny dług (#4 toast spring narusza „zero bounce” z §9.1 visual-language.md; #11 streaming Teresy dziś pulsuje CAŁY bąbelek zamiast tylko nowych węzłów — odwrotność briefu + 2/3 twardych naruszeń `lint:motion` w tym samym pliku), reszta (#5/#6/#7) to brakująca implementacja czeka VF2-8. Wpis w §7 warstwa `02-components`.
| 2026-07-19 | v3.0 | **VF0-1 (konsolidacja SSOT):** §7.1 nowa — dopisano nawigację do 2 SSOT ustanowionych PO v3.0, które CANON dotąd przemilczał mimo że CLAUDE.md już je traktuje jako obowiązujące: `TRIADA_KANON.md` (kanon list, 2026-07-04) i `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` (kanon artefaktów SPEC-A, poza drzewem `docs/`). Dopisano `empty-loading-states.md` do warstwy `02-components` (był plikiem-sierotą bez wpisu w §7). `DOKTRYNA_GESTOSCI.md` (siostrzana doktryna gęstości) **NIE dostała linku** — DRAFT nieistniejący jeszcze na `origin/demo` (żyje poza tą gałęzią); dodanie linku złamałoby `npm run docs:links`. Zero usuniętych duplikatów ` 2.md` — audyt VF0-1 nie znalazł żadnych w tym katalogu (poprzednie sprzątanie z Fazy 3 było kompletne). |
| 2026-06-29 | v3.0 | **Dodano warstwę** `02-components/navigation-permissions-canon.md` (T2.1 sweep L1) — konsoliduje nawigację cross-tool (hamburger-wzorzec Notatnika, jeden Command Row, wspólny rail Ideas + prefiksy) + bramki uprawnień (beta/pilot/role/flagi) jako referencję dla sweepu L1 z macierzy 4 poziomów. Addytywne (referuje CANON §4.5 + workspace-3-tools-strip + TABLE canon; zero złamanych linków). |
| 2026-06-14 | v3.0 | **Faza 1** — Konsolidacja autorytetu: `CANON.md` jako jedyny front; scalone README (indeks) + Golden (treść→warstwy) + Operating (governance §3–5,8) + Canon V3 (legacy). Dodany doc↔kod binding (§6). Hierarchia prawdy rozstrzygnięta (§2). |
| 2026-06-14 | v3.0 | **Faza 2** — Rozdział prawo/historia: 9 plików procesu + `evidence/`/`automation/`/`migration-backlog/` → `_archive/` (git mv). `.cursorrules` punkt wejścia → CANON. Repoint referencji, zero-dangling zweryfikowane w całym `docs/`. |
| 2026-06-14 | v3.0 | **Faza 3** — (a) `light-mode-readability.md` promowany do v3.2 (490 lin.), usunięty gorszy duplikat ` 2.md`. (b) `shared-nmode-sections-standard.md` + `artifact-shell-future-standard.md` przeniesione root → `01-shell-layout/` (repoint, zero-dangling). (c) 5 przywróconych docs potwierdzone jako warstwa `03-modules` (NIE archiwizować). Root = czysta powierzchnia autorytetu. |
| 2026-06-14 | v3.0 | **Faza 4** — Egzekwowanie: `.cursorrules` punkt wejścia poprawiony (Golden→CANON, koniec sprzeczności „najwyższe źródło"). Nowy checker `npm run docs:links` (`server/scripts/check-ui-standards-links.ts`) — integralność referencji z §3.2 jako bramka CI; zweryfikowany pozytywnie (0/78) i negatywnie (łapie martwy link, exit 1). |

### Stan konsolidacji (otwarte)

- **Dystrybucja Golden/Operating → warstwy:** treść produktowo-wizualna z banner'd Golden Standard do rozłożenia na `00–03`; po zakończeniu Golden/Operating/CanonV3 → `_archive/`. (Duże zadanie contentowe — osobna sesja.)
- **F4 (opcjonalne):** bramka CI — grep banned patterns (np. `text-blue-900` w statusach) + orphan-doc check.

**Rozstrzygnięte w Fazie 3:**
- `light-mode-readability.md` — promowano treść v3.2 (490 lin., token-first, focus matrix, preview pane, a11y mierzalny) do nazwy kanonicznej; usunięto nietrackowany duplikat ` 2.md` (był gorszą 178-lin wersją w repo).
- Re-warstwowanie root standards → patrz changelog F3.
- 5 przywróconych docs (`app-table`/`view-modes`/`module-hub`/`golden-v3`/`table-preview-pane`) — **decyzja: zostają jako warstwa `03-modules`** (są poprawnymi szczegółowymi standardami cytowanymi przez FROZEN_LAYOUTS; NIE archiwizować — wcześniejsza etykieta „deprecated" była błędna).
