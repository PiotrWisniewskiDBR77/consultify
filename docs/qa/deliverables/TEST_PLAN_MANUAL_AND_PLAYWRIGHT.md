# Deliverables Generators (M17–M20) — Katalog testów: manual + Playwright

> SSOT katalogu testów programu **Deliverables Generators**. Pokrywa wszystkie **24 pod-moduły** (serie E/R/T/B/X), od pierwszego do ostatniego.
> Każdy scenariusz manualny ma odpowiednik automatyczny w Playwright zakończony **zrzutem ekranu** zapisanym na dysk.
> Dokument przeznaczony do **bezpośredniej implementacji** — selektory, trasy i helpery są realne (rekonesans kodu 2026-06-22).

---

## 1. Wprowadzenie

### 1.1 Zakres
Katalog obejmuje 24 pod-moduły w kolejności fal W1→W5:

| Fala | Seria | Pod-moduły |
|------|-------|-----------|
| W1 | E (unified launcher) | E1 Launcher "New" + 3 kafelki typu · E2 Galeria szablonów · E3 Kontrakt context-package / 3 ścieżki wejścia · E4 Routing do edytora |
| W2 | R (edytory) | R1 Doc TipTap · R2 Doc inline-AI select→fix · R3 Doc tabele/wykresy/KPI · R4 Deck Gamma-flow · R5 Table formatowanie warunkowe + silnik formuł |
| W3 | T (szablony) | T1 Model+persist · T2 Biblioteka DBR77 · T3 CRUD szablonów usera · T4 Teresa-suggests |
| W4 | B (premium brain) | B1 Deck AI Layout Director · B2 Deck warianty/remix · B3 Doc generator struktury · B4 Table typed schema+kolory+seed · B5 Wiring tier premium + telemetria |
| W5 | X (export/assets/spójność) | X1 Playwright HTML→PDF/PNG · X2 exceljs CF export · X3 rasteryzacja wykresów · X4 stock images + smart icons · X5 doc/sheet unified entity · X6 Outputs transactional registry |

### 1.2 Wymagania do uruchomienia (prerequisites)
- **Aplikacja uruchomiona** przez smoke-config (FE+BE, `workers=1`) lub wskazana na staging przez zmienne środowiskowe.
- **Flagi**:
  - `VITE_ENABLE_DELIVERABLES_LIGHT=true` (FE) — odblokowuje launcher i triadę deliverable.
  - `ENABLE_DELIVERABLES_PREMIUM=true` (BE) — wymagane dla scenariuszy serii B (premium brain) oraz premium-ścieżek X1–X4.
- **Auth**: tiered fallback w `tests/e2e/smoke/work-canvas-helpers.ts`
  - `loginAsOwner(page)` / `loginAsMember(page)` → zwracają bearer token i seedują `storageState`
    (kolejność: `/api/test-support/bootstrap` z nagłówkiem `x-test-support-key` → `/api/auth/demo-login` → `/api/auth/register-demo`).
  - `suppressOnboarding(page)` **wywołać PRZED** `page.goto`.
  - `dismissOverlayIfPresent(page)` na błąkające się overlaye.
- **Konfiguracja przeglądarki** (z `playwright.config.ts`): chromium viewport **1680×1050**, `trace: retain-on-failure`,
  `baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'`, API `E2E_API_URL || 'http://127.0.0.1:3001'`.

### 1.3 Katalog zrzutów ekranu
Wszystkie zrzuty trafiają do:
```
docs/qa/screens/deliverables-2026-06-22/<ID>.png
```
Konwencja zapisu w teście:
```ts
await page.screenshot({ path: 'docs/qa/screens/deliverables-2026-06-22/<id>.png', fullPage: false });
```
Tryb jasny/ciemny ustawiamy przez localStorage (klucz motywu `consultify-storage`) lub `page.emulateMedia({ colorScheme: 'dark' })`.

### 1.4 Komenda uruchomienia
```bash
E2E_USE_WEB_SERVER=true npx playwright test \
  --config playwright.smoke.config.ts \
  tests/e2e/deliverables/<spec>
```
Rekomendowany układ plików spec: jeden plik na serię (`series-e.spec.ts`, `series-r.spec.ts`, `series-t.spec.ts`, `series-b.spec.ts`, `series-x.spec.ts`).

### 1.5 Mapowanie faz FT (Functional Test phase)
| Faza | Znaczenie |
|------|-----------|
| FT-1 | Wejście / nawigacja / dostępność ekranu |
| FT-2 | Launcher i wybór typu deliverable |
| FT-3 | Szablony (galeria, persist, CRUD, sugestie) |
| FT-4 | Edytory (Doc/Deck/Table) — interakcja podstawowa |
| FT-5 | AI inline / generacja struktur / premium brain |
| FT-6 | Generacja end-to-end (pipeline requested→draft) |
| FT-7 | Export / assety / rasteryzacja |
| FT-8 | Spójność encji + rejestr Outputs (transactional) |

---

## 2. Luki selektorów (selector gaps) — do dodania `data-testid`

> **Akcja inżynierska**: poniższe powierzchnie nie mają stabilnych selektorów. Do robustnej automatyzacji należy dodać `data-testid`.
> Dopóki nie ma — w testach używamy fallbacku (`getByRole`, `placeholder`, `aria-label`), oznaczonego w scenariuszach jako **[FALLBACK]**.

| # | Moduł | Powierzchnia bez test-id | Proponowany `data-testid` |
|---|-------|--------------------------|---------------------------|
| G1 | M17 Outputs Hub | Przycisk "New output" otwierający launcher | `outputs-new-button` |
| G2 | M17 Launcher | Przycisk potwierdzenia/kontynuacji w modalu | `outputs-launcher-confirm` |
| G3 | M18 Doc Studio | Inline-AI menu (kontener) | `document-inline-ai-menu` |
| G4 | M18 Doc Studio | Akcja "fix/improve" w inline-AI | `document-inline-ai-fix` |
| G5 | M18 Doc Studio | Przyciski faz intake/outline/document | `doc-phase-intake` / `doc-phase-outline` / `doc-phase-document` |
| G6 | M19 Deck | Toolbar buildera | `deck-toolbar` |
| G7 | M19 Deck | Slide-sorter (kontener + item) | `deck-slide-sorter` / `deck-slide-item-${index}` |
| G8 | M19 Deck | Tryb prezentacji (present mode) | `deck-present-mode` |
| G9 | M19 Deck | Akcja "Generate"/"Layout Director" | `deck-ai-layout-director` |
| G10 | M19 Deck | Warianty / remix slajdu | `deck-variant-${n}` / `deck-remix-button` |
| G11 | M20 Table | Wiersze gridu | `table-row-${rowId}` |
| G12 | M20 Table | Nagłówki kolumn | `table-header-${colKey}` |
| G13 | M20 Table | Przycisk "Add row" | `table-add-row` |
| G14 | M20 Table | Panel formatowania warunkowego | `table-conditional-format-panel` |
| G15 | Chat | Pole wiadomości w UnifiedChatPanel | `chat-message-input` |
| G16 | Chat | Przycisk "Send" | `chat-send-button` |
| G17 | M17 | Wiersz rejestru Outputs (pozycja na liście) | `output-row-${id}` |
| G18 | Export | Przycisk eksportu (PDF/PNG/XLSX) | `deliverable-export-button` + `export-format-${fmt}` |

**Selektory potwierdzone (istnieją, używamy wprost):**
- M17 hub root: `data-testid="reports-presentations-hub"`; modal launchera `role="dialog"` `aria-labelledby="outputs-launcher-title"`; kafelki typu `aria-label="Report"|"Presentation"|"Table"`; szablony `aria-label="Blank"` + curated (`audit-report`, `exec-memo`, `board-deck`, `diagnostic`, `risk-register`, `kpi-dashboard`); input Teresa `placeholder="Describe what you need…"`.
- M18 edytor: `data-testid="document-tiptap-editor"`.
- M19 deck root: `data-testid="deck-builder-mels-root"`.
- M20 komórki: `data-testid="cell-cursor-${rowId}-${colKey}"`; typed: `source-ref-*`, `ai-classification-*`, `priority-empty`.
- Chat chrome: `chat-new-button`, `chat-work-panel-button` (i pokrewne).
- Pipeline: `GET /api/deliverables/generations/{id}` → stany `requested→planning→plan_ready→generating→validating→draft|error`.

---

## 3. Scenariusze per pod-moduł

> Konwencja ID: `<podmoduł>-S<nn>` (np. `E1-S01`). Trasy względem `baseURL`.
> Każdy test: `suppressOnboarding(page)` → login → `page.goto(route)` → akcje → `await expect(...)` → `page.screenshot`.

---

### W1 · Seria E — Unified Launcher

#### E1 — Launcher "New" + 3 kafelki typu

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| E1-S01 | Hub Outputs się ładuje | 1. Zaloguj się. 2. Wejdź na `/presentations`. | Widoczny hub z `reports-presentations-hub`. | `loginAsOwner`; goto `/presentations`; `expect(page.getByTestId('reports-presentations-hub')).toBeVisible()`; screenshot `e1-s01-hub.png`. | FT-1 | light |
| E1-S02 | Otwarcie launchera | 1. Kliknij "New output". | Modal `outputs-launcher-title` otwarty. | klik **[FALLBACK]** `getByRole('button',{name:/new output/i})`; `expect(page.getByRole('dialog')).toBeVisible()`; screenshot `e1-s02-launcher-open.png`. | FT-2 | light |
| E1-S03 | Widoczne 3 kafelki typu | 1. Otwórz launcher. 2. Sprawdź kafelki. | Report / Presentation / Table widoczne. | `for (const t of ['Report','Presentation','Table']) expect(page.getByLabel(t)).toBeVisible()`; screenshot `e1-s03-type-tiles.png`. | FT-2 | light |
| E1-S04 | Wybór "Report" | 1. Otwórz launcher. 2. Kliknij Report. | Kafelek zaznaczony, dalsze kroki aktywne. | `page.getByLabel('Report').click()`; `expect(...).toHaveAttribute('aria-pressed','true')` (lub klasa selected); screenshot `e1-s04-select-report.png`. | FT-2 | light |
| E1-S05 | Wybór "Presentation" | 1. Otwórz launcher. 2. Kliknij Presentation. | Kafelek zaznaczony. | `page.getByLabel('Presentation').click()`; screenshot `e1-s05-select-presentation.png`. | FT-2 | light |
| E1-S06 | Launcher w trybie ciemnym | 1. Włącz dark. 2. Otwórz launcher. | Modal czytelny w dark (kontrast OK). | `emulateMedia({colorScheme:'dark'})` przed goto; otwórz launcher; screenshot `e1-s06-launcher-dark.png`. | FT-2 | dark |

#### E2 — Galeria szablonów

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| E2-S01 | Szablon "Blank" widoczny | 1. Otwórz launcher. 2. Wybierz typ. | `aria-label="Blank"` obecny. | otwórz launcher → `getByLabel('Report')` → `expect(page.getByLabel('Blank')).toBeVisible()`; screenshot `e2-s01-blank.png`. | FT-3 | light |
| E2-S02 | Curated dla Report | 1. Wybierz Report. | Widoczne `audit-report`, `exec-memo`, `diagnostic`. | sprawdź `getByLabel('audit-report')` itd.; screenshot `e2-s02-report-templates.png`. | FT-3 | light |
| E2-S03 | Curated dla Presentation | 1. Wybierz Presentation. | Widoczny `board-deck`. | `getByLabel('board-deck')`; screenshot `e2-s03-deck-templates.png`. | FT-3 | light |
| E2-S04 | Curated dla Table | 1. Wybierz Table. | Widoczne `risk-register`, `kpi-dashboard`. | `getByLabel('risk-register')`, `getByLabel('kpi-dashboard')`; screenshot `e2-s04-table-templates.png`. | FT-3 | light |
| E2-S05 | Wybór szablonu zaznacza | 1. Kliknij `audit-report`. | Kafelek aktywny, gotowy do kontynuacji. | `page.getByLabel('audit-report').click()`; `expect(confirm).toBeEnabled()` **[FALLBACK G2]**; screenshot `e2-s05-template-selected.png`. | FT-3 | light |

#### E3 — Kontrakt context-package / 3 ścieżki wejścia

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| E3-S01 | Ścieżka A: launcher→blank | 1. Hub. 2. New. 3. Report+Blank. 4. Kontynuuj. | Routing do edytora z pustym context-package. | flow jak E1+E2, klik confirm **[FALLBACK]**; `expect(page).toHaveURL(/document-studio/)`; screenshot `e3-s01-pathA-blank.png`. | FT-2 | light |
| E3-S02 | Ścieżka A: launcher→template | 1. New. 2. Report+`exec-memo`. 3. Kontynuuj. | Context-package z presetem szablonu. | klik `exec-memo`→confirm; `expect(page).toHaveURL(/document-studio/)`; screenshot `e3-s02-pathA-template.png`. | FT-2 | light |
| E3-S03 | Ścieżka B: chat→deliverable (intent) | 1. Otwórz chat. 2. Wpisz "zrób raport z audytu". 3. Wyślij. | Teresa rozpoznaje intent generacji. | otwórz panel `chat-work-panel-button`; **[FALLBACK G15/G16]** `fill` po placeholderze, `send` po role; screenshot `e3-s03-pathB-intent.png`. | FT-6 | light |
| E3-S04 | Ścieżka B: pipeline planning | 1. Po wysłaniu kontynuuj obserwację. | `GET generations/{id}` → `planning`/`plan_ready`. | przechwyć response na `**/generations/*`; `expect(state)` ∈ {planning,plan_ready}; screenshot `e3-s04-pathB-planning.png`. | FT-6 | light |
| E3-S05 | Ścieżka B: pipeline draft | 1. Poczekaj na zakończenie. | Stan `draft`, canvas zmontowany. | poll do `draft` (timeout 90s); screenshot `e3-s05-pathB-draft.png`. | FT-6 | light |
| E3-S06 | Ścieżka C: z encji/kontekstu org | 1. Z poziomu inicjatywy/insightu uruchom "Generuj". | Context-package zawiera ref encji. | goto encji → akcja generacji **[FALLBACK]**; weryfikacja payloadu (context refs); screenshot `e3-s06-pathC-entity.png`. | FT-6 | light |
| E3-S07 | Kontrakt: walidacja pustego kontekstu | 1. Ścieżka A blank bez treści. | Pipeline akceptuje pusty kontekst (brak crasha). | jak E3-S01, sprawdź brak błędu w konsoli/UI; screenshot `e3-s07-empty-contract.png`. | FT-2 | light |
| E3-S08 | Kontrakt: stan error pipeline | 1. Wymuś błąd (np. brak klucza premium). | Stan `error` obsłużony, komunikat dla usera. | poll generations; gdy `error` → `expect(errorBanner).toBeVisible()`; screenshot `e3-s08-error-state.png`. | FT-6 | light |

#### E4 — Routing do edytora

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| E4-S01 | Report → Document Studio | 1. Launcher Report→Blank→Kontynuuj. | URL `/document-studio`, edytor obecny. | `expect(page).toHaveURL(/document-studio/)`; `expect(page.getByTestId('document-tiptap-editor')).toBeVisible()`; screenshot `e4-s01-route-doc.png`. | FT-1 | light |
| E4-S02 | Presentation → Deck wizard | 1. Launcher Presentation→Blank→Kontynuuj. | URL `/presentations/wizard`, deck root obecny. | `expect(page).toHaveURL(/presentations\/wizard/)`; `expect(page.getByTestId('deck-builder-mels-root')).toBeVisible()`; screenshot `e4-s02-route-deck.png`. | FT-1 | light |
| E4-S03 | Table → grid | 1. Launcher Table→Blank→Kontynuuj. | URL `/tabele`, grid obecny. | `expect(page).toHaveURL(/tabele/)`; screenshot `e4-s03-route-table.png`. | FT-1 | light |
| E4-S04 | Resume po artifactId | 1. Wejdź na `/document-studio/:artifactId`. | Edytor wczytuje istniejący artefakt. | goto z istniejącym id; `expect(editor).toBeVisible()`; screenshot `e4-s04-resume-artifact.png`. | FT-1 | light |

---

### W2 · Seria R — Edytory

#### R1 — Doc TipTap edytor

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| R1-S01 | Edytor się ładuje | 1. Wejdź `/document-studio`. | `document-tiptap-editor` widoczny. | goto; `expect(getByTestId('document-tiptap-editor')).toBeVisible()`; screenshot `r1-s01-editor.png`. | FT-4 | light |
| R1-S02 | Wpisywanie tekstu | 1. Kliknij w edytor. 2. Wpisz akapit. | Tekst pojawia się w treści. | `editor.click()`; `page.keyboard.type('Akapit testowy DRD')`; `expect(editor).toContainText('Akapit testowy DRD')`; screenshot `r1-s02-typing.png`. | FT-4 | light |
| R1-S03 | Nagłówek H1 | 1. Zaznacz linię. 2. Zastosuj H1 (np. `# ` / toolbar). | Linia renderowana jako H1. | type `# Tytuł` + Enter; `expect(editor.locator('h1')).toBeVisible()`; screenshot `r1-s03-heading.png`. | FT-4 | light |
| R1-S04 | Lista wypunktowana | 1. Wstaw listę. | Lista `<ul>` widoczna. | type `- punkt`; `expect(editor.locator('ul li')).toHaveCount(1)`; screenshot `r1-s04-list.png`. | FT-4 | light |
| R1-S05 | Pogrubienie | 1. Zaznacz tekst. 2. Bold. | Tekst pogrubiony. | zaznacz (Shift+Home), `page.keyboard.press('Meta+b')`; `expect(editor.locator('strong')).toBeVisible()`; screenshot `r1-s05-bold.png`. | FT-4 | light |
| R1-S06 | Autosave/persist | 1. Wpisz treść. 2. Odśwież stronę. | Treść zachowana po reload. | type → poczekaj na autosave/PATCH → `page.reload()` → `expect(editor).toContainText(...)`; screenshot `r1-s06-persist.png`. | FT-4 | light |
| R1-S07 | Undo/redo | 1. Wpisz. 2. Cmd+Z. 3. Cmd+Shift+Z. | Stan cofa i przywraca. | type → `Meta+z` → `Meta+Shift+z`; asercje treści; screenshot `r1-s07-undo-redo.png`. | FT-4 | light |
| R1-S08 | Edytor w dark | 1. Włącz dark. 2. Wejdź do edytora. | Czytelny kontrast, brak crimson-leak. | `emulateMedia dark`; screenshot `r1-s08-editor-dark.png`. | FT-4 | dark |

#### R2 — Doc inline-AI select→fix (Mode1/2/3 usunięte)

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| R2-S01 | Menu inline-AI po zaznaczeniu | 1. Wpisz tekst. 2. Zaznacz fragment. | Pojawia się menu inline-AI. | type+select; **[FALLBACK G3]** `expect(page.locator('[data-inline-ai],...')).toBeVisible()`; screenshot `r2-s01-inline-menu.png`. | FT-5 | light |
| R2-S02 | Akcja "fix/improve" | 1. Zaznacz. 2. Kliknij fix. | Wywołanie AI, zaznaczony tekst poprawiony. | **[FALLBACK G4]** klik fix; poll na request AI; screenshot `r2-s02-fix-applied.png`. | FT-5 | light |
| R2-S03 | Brak trybów Mode1/2/3 | 1. Otwórz inline-AI. | Brak legacy przełączników trybów. | `expect(page.getByText(/Mode ?[123]/)).toHaveCount(0)`; screenshot `r2-s03-no-modes.png`. | FT-5 | light |
| R2-S04 | Anulowanie sugestii | 1. Wywołaj fix. 2. Odrzuć. | Tekst wraca do oryginału. | klik fix → reject **[FALLBACK]**; asercja oryginału; screenshot `r2-s04-reject.png`. | FT-5 | light |
| R2-S05 | Akceptacja sugestii | 1. Wywołaj fix. 2. Zaakceptuj. | Sugestia wstawiona do treści. | klik fix → accept; `expect(editor)` zmienione; screenshot `r2-s05-accept.png`. | FT-5 | light |
| R2-S06 | Inline-AI w dark | 1. Dark. 2. Zaznacz tekst. | Menu czytelne w dark. | `emulateMedia dark`; screenshot `r2-s06-inline-dark.png`. | FT-5 | dark |

#### R3 — Doc tabele/wykresy/KPI render

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| R3-S01 | Wstawienie tabeli | 1. Wstaw blok tabeli. | Tabela renderowana w treści. | wstaw przez slash/toolbar **[FALLBACK]**; `expect(editor.locator('table')).toBeVisible()`; screenshot `r3-s01-table.png`. | FT-4 | light |
| R3-S02 | Wstawienie wykresu | 1. Wstaw blok wykresu. | Wykres renderowany (svg/canvas). | `expect(editor.locator('svg, canvas')).toBeVisible()`; screenshot `r3-s02-chart.png`. | FT-4 | light |
| R3-S03 | Blok KPI | 1. Wstaw KPI. | Karta KPI z wartością+labelem. | asercja kontenera KPI **[FALLBACK]**; screenshot `r3-s03-kpi.png`. | FT-4 | light |
| R3-S04 | Persist bloków | 1. Wstaw tabelę+wykres+KPI. 2. Reload. | Bloki zachowane. | reload → asercje obecności; screenshot `r3-s04-blocks-persist.png`. | FT-4 | light |
| R3-S05 | Render w dark | 1. Dark. 2. Z blokami. | Tabele/wykresy czytelne w dark. | `emulateMedia dark`; screenshot `r3-s05-blocks-dark.png`. | FT-4 | dark |

#### R4 — Deck Gamma-flow

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| R4-S01 | Wizard decka się ładuje | 1. Wejdź `/presentations/wizard`. | `deck-builder-mels-root` widoczny. | goto; `expect(getByTestId('deck-builder-mels-root')).toBeVisible()`; screenshot `r4-s01-wizard.png`. | FT-4 | light |
| R4-S02 | Generacja struktury slajdów | 1. Podaj temat. 2. Generuj. | Powstaje zestaw slajdów. | **[FALLBACK G9]** klik generate; poll generations→draft; screenshot `r4-s02-slides.png`. | FT-6 | light |
| R4-S03 | Slide-sorter | 1. Po generacji obejrzyj sorter. | Lista slajdów widoczna. | **[FALLBACK G7]** asercja kontenera sortera; screenshot `r4-s03-sorter.png`. | FT-4 | light |
| R4-S04 | Edycja slajdu | 1. Otwórz slajd. 2. Zmień tytuł. | Tytuł zaktualizowany. | klik item → edytuj; asercja; screenshot `r4-s04-edit-slide.png`. | FT-4 | light |
| R4-S05 | Tryb prezentacji | 1. Uruchom present mode. | Pełnoekranowa prezentacja. | **[FALLBACK G8]** klik present; `expect(presentMode).toBeVisible()`; screenshot `r4-s05-present.png`. | FT-4 | light |
| R4-S06 | Deck w dark | 1. Dark. 2. Wizard. | Czytelny builder w dark. | `emulateMedia dark`; screenshot `r4-s06-deck-dark.png`. | FT-4 | dark |

#### R5 — Table formatowanie warunkowe w gridzie + silnik formuł

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| R5-S01 | Grid się ładuje | 1. Wejdź `/tabele` (lub trasa workspace). | Grid widoczny. | goto; asercja gridu **[FALLBACK G11]**; screenshot `r5-s01-grid.png`. | FT-4 | light |
| R5-S02 | Edycja komórki | 1. Kliknij komórkę. 2. Wpisz wartość. | Wartość zapisana w komórce. | `page.getByTestId('cell-cursor-${rowId}-${colKey}').click()`; type; asercja; screenshot `r5-s02-cell-edit.png`. | FT-4 | light |
| R5-S03 | Dodanie wiersza | 1. Add row. | Nowy wiersz w gridzie. | **[FALLBACK G13]** klik add; asercja licznika wierszy; screenshot `r5-s03-add-row.png`. | FT-4 | light |
| R5-S04 | Formuła sumy | 1. Wpisz `=SUM(...)`. | Wynik policzony przez silnik. | type formuły w komórce; asercja wartości wynikowej; screenshot `r5-s04-formula-sum.png`. | FT-4 | light |
| R5-S05 | Formuła z referencją | 1. `=A1*B1`. | Iloczyn wyliczony, reaktywny. | type; zmień operand; asercja przeliczenia; screenshot `r5-s05-formula-ref.png`. | FT-4 | light |
| R5-S06 | Formatowanie warunkowe (reguła) | 1. Otwórz panel CF. 2. Reguła ">100 = zielony". | Komórki >100 podświetlone. | **[FALLBACK G14]** ustaw regułę; asercja klasy/koloru; screenshot `r5-s06-cf-rule.png`. | FT-4 | light |
| R5-S07 | CF — przeliczanie po edycji | 1. Zmień wartość poniżej progu. | Podświetlenie znika. | edytuj komórkę; asercja braku koloru; screenshot `r5-s07-cf-recalc.png`. | FT-4 | light |
| R5-S08 | Grid w dark | 1. Dark. 2. Grid z CF. | Kolory CF czytelne w dark. | `emulateMedia dark`; screenshot `r5-s08-grid-dark.png`. | FT-4 | dark |

---

### W3 · Seria T — Szablony

#### T1 — Model szablonu + persist

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| T1-S01 | Wybór szablonu zapisuje preset | 1. Launcher → wybierz szablon → Kontynuuj. | Edytor wczytuje preset szablonu. | flow E2+E4; asercja treści presetu; screenshot `t1-s01-preset.png`. | FT-3 | light |
| T1-S02 | Persist po reload | 1. Wczytaj z szablonu. 2. Reload. | Struktura szablonu zachowana. | reload; asercja struktury; screenshot `t1-s02-persist.png`. | FT-3 | light |
| T1-S03 | Metadane szablonu | 1. Otwórz szczegóły szablonu. | Nazwa/typ/opis poprawne. | asercja pól meta **[FALLBACK]**; screenshot `t1-s03-meta.png`. | FT-3 | light |
| T1-S04 | Szablon per typ | 1. Sprawdź zgodność szablon↔typ. | Report-template→doc, deck→deck. | weryfikacja routingu po typie; screenshot `t1-s04-type-binding.png`. | FT-3 | light |

#### T2 — Biblioteka DBR77

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| T2-S01 | Curated DBR77 obecne | 1. Otwórz galerię. | Wszystkie curated widoczne. | asercja 6 curated `aria-label`; screenshot `t2-s01-library.png`. | FT-3 | light |
| T2-S02 | audit-report | 1. Wybierz `audit-report`. | Struktura audytu w edytorze. | klik+kontynuuj; asercja sekcji; screenshot `t2-s02-audit-report.png`. | FT-3 | light |
| T2-S03 | board-deck | 1. Wybierz `board-deck`. | Deck z układem zarządu. | routing do deck; asercja slajdów; screenshot `t2-s03-board-deck.png`. | FT-3 | light |
| T2-S04 | risk-register | 1. Wybierz `risk-register`. | Tabela rejestru ryzyk. | routing do table; asercja kolumn; screenshot `t2-s04-risk-register.png`. | FT-3 | light |
| T2-S05 | kpi-dashboard | 1. Wybierz `kpi-dashboard`. | Tabela KPI. | routing+asercja; screenshot `t2-s05-kpi-dashboard.png`. | FT-3 | light |

#### T3 — CRUD szablonów usera

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| T3-S01 | Utworzenie szablonu (Save as template) | 1. Z edytora zapisz jako szablon. | Szablon pojawia się w galerii usera. | **[FALLBACK]** akcja save-as-template; asercja w galerii; screenshot `t3-s01-create.png`. | FT-3 | light |
| T3-S02 | Odczyt/użycie szablonu usera | 1. Otwórz galerię → user template. | Wczytuje się treść usera. | klik+kontynuuj; asercja; screenshot `t3-s02-read.png`. | FT-3 | light |
| T3-S03 | Edycja szablonu | 1. Zmień szablon usera. 2. Zapisz. | Zmiana utrwalona. | edytuj→save→reload→asercja; screenshot `t3-s03-update.png`. | FT-3 | light |
| T3-S04 | Usunięcie szablonu | 1. Usuń szablon usera. | Znika z galerii. | klik delete→potwierdź; asercja braku; screenshot `t3-s04-delete.png`. | FT-3 | light |
| T3-S05 | Izolacja per user/org | 1. Zaloguj jako member. | Brak prywatnych szablonów innego usera. | `loginAsMember`; asercja widoczności; screenshot `t3-s05-isolation.png`. | FT-3 | light |

#### T4 — Teresa-suggests

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| T4-S01 | Pole Teresa-suggest widoczne | 1. Otwórz launcher. | Input `placeholder="Describe what you need…"`. | `expect(page.getByPlaceholder('Describe what you need…')).toBeVisible()`; screenshot `t4-s01-input.png`. | FT-3 | light |
| T4-S02 | Sugestia szablonu z opisu | 1. Wpisz "audyt procesów". 2. Zatwierdź. | Teresa proponuje pasujący szablon. | `fill` placeholder; submit; asercja propozycji; screenshot `t4-s02-suggestion.png`. | FT-3 | light |
| T4-S03 | Akceptacja sugestii → routing | 1. Zaakceptuj propozycję. | Routing do edytora z presetem. | klik propozycji; `expect(page).toHaveURL(...)`; screenshot `t4-s03-accept.png`. | FT-3 | light |
| T4-S04 | Pusty/niejasny opis | 1. Wpisz "asdf". | Fallback (Blank lub komunikat). | `fill('asdf')`; asercja fallbacku; screenshot `t4-s04-fallback.png`. | FT-3 | light |

---

### W4 · Seria B — Premium Brain (wymaga `ENABLE_DELIVERABLES_PREMIUM=true`)

#### B1 — Deck AI Layout Director

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| B1-S01 | Layout Director dostępny przy flagze | 1. Premium ON. 2. Deck wizard. | Akcja Layout Director widoczna. | premium env; **[FALLBACK G9]** asercja akcji; screenshot `b1-s01-available.png`. | FT-5 | light |
| B1-S02 | Generacja layoutu | 1. Uruchom Layout Director. | Slajdy z dobranym layoutem. | klik→poll generations→draft; screenshot `b1-s02-layout.png`. | FT-6 | light |
| B1-S03 | Zróżnicowanie layoutów | 1. Obejrzyj wynik. | Różne typy slajdów (title/two-col/chart). | asercja >1 typu layoutu; screenshot `b1-s03-variety.png`. | FT-5 | light |
| B1-S04 | Hierarchia treści | 1. Sprawdź nagłówki/bullety. | Sensowna hierarchia. | asercja struktury; screenshot `b1-s04-hierarchy.png`. | FT-5 | light |
| B1-S05 | Telemetria premium | 1. Wykonaj generację. | Zdarzenie telemetrii premium wysłane. | przechwyć request telemetrii; asercja; screenshot `b1-s05-telemetry.png`. | FT-5 | light |
| B1-S06 | Brak flagi → fallback | 1. Premium OFF. | Layout Director ukryty/deterministyczny fallback. | env OFF; asercja braku premium; screenshot `b1-s06-no-flag.png`. | FT-5 | light |
| B1-S07 | Obsługa błędu generacji | 1. Wymuś error. | Stan error + komunikat. | poll→error; asercja banera; screenshot `b1-s07-error.png`. | FT-6 | light |
| B1-S08 | Layout w dark | 1. Dark. 2. Generacja. | Czytelny wynik w dark. | `emulateMedia dark`; screenshot `b1-s08-dark.png`. | FT-5 | dark |

#### B2 — Deck warianty / remix

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| B2-S01 | Generacja wariantów | 1. Dla slajdu poproś o warianty. | >1 wariant slajdu. | **[FALLBACK G10]** akcja variant; asercja liczby; screenshot `b2-s01-variants.png`. | FT-5 | light |
| B2-S02 | Wybór wariantu | 1. Wybierz wariant 2. | Slajd zastąpiony wariantem. | klik `deck-variant-2` **[FALLBACK]**; asercja; screenshot `b2-s02-pick.png`. | FT-5 | light |
| B2-S03 | Remix slajdu | 1. Remix. | Nowa kompozycja tej samej treści. | **[FALLBACK G10]** klik remix; asercja zmiany layoutu; screenshot `b2-s03-remix.png`. | FT-5 | light |
| B2-S04 | Zachowanie treści | 1. Po remixie. | Treść merytoryczna bez utraty. | asercja kluczowych fraz; screenshot `b2-s04-content-kept.png`. | FT-5 | light |
| B2-S05 | Undo remix | 1. Cofnij remix. | Powrót do poprzedniego. | undo; asercja; screenshot `b2-s05-undo.png`. | FT-5 | light |
| B2-S06 | Warianty w dark | 1. Dark. | Warianty czytelne. | `emulateMedia dark`; screenshot `b2-s06-dark.png`. | FT-5 | dark |

#### B3 — Doc generator struktury

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| B3-S01 | Faza intake | 1. Doc Studio premium. 2. Podaj brief. | Faza intake zbiera kontekst. | **[FALLBACK G5]** asercja fazy intake; screenshot `b3-s01-intake.png`. | FT-5 | light |
| B3-S02 | Generacja outline | 1. Przejdź do outline. | Struktura sekcji wygenerowana. | poll→plan_ready; asercja outline; screenshot `b3-s02-outline.png`. | FT-6 | light |
| B3-S03 | Rozwinięcie do dokumentu | 1. Przejdź do document. | Pełna treść z outline. | poll→draft; asercja sekcji w edytorze; screenshot `b3-s03-document.png`. | FT-6 | light |
| B3-S04 | Spójność outline↔treść | 1. Porównaj nagłówki. | Sekcje treści = outline. | asercja zgodności H1/H2; screenshot `b3-s04-consistency.png`. | FT-5 | light |
| B3-S05 | Edycja po generacji | 1. Edytuj wygenerowaną sekcję. | Edytowalne i zapisywalne. | edytuj→persist→reload; screenshot `b3-s05-editable.png`. | FT-4 | light |
| B3-S06 | Struktura w dark | 1. Dark. | Czytelny dokument. | `emulateMedia dark`; screenshot `b3-s06-dark.png`. | FT-5 | dark |

#### B4 — Table typed schema + kolory + seed

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| B4-S01 | Generacja typed schema | 1. Premium. 2. Poproś o tabelę ryzyk. | Kolumny z typami (source-ref/classification/priority). | poll→draft; asercja `source-ref-*`, `ai-classification-*`; screenshot `b4-s01-schema.png`. | FT-6 | light |
| B4-S02 | Kolory typów | 1. Obejrzyj komórki typowane. | Kolory wg typu. | asercja klas koloru komórek; screenshot `b4-s02-colors.png`. | FT-5 | light |
| B4-S03 | Seed danych | 1. Sprawdź wiersze startowe. | Tabela zaseedowana przykładami. | asercja >0 wierszy z danymi; screenshot `b4-s03-seed.png`. | FT-6 | light |
| B4-S04 | Komórka priority-empty | 1. Znajdź pustą priority. | Renderowana jako `priority-empty`. | `expect(page.getByTestId(/priority-empty/)).toBeVisible()`; screenshot `b4-s04-priority-empty.png`. | FT-5 | light |
| B4-S05 | Edycja typowanej komórki | 1. Zmień klasyfikację. | Wartość + kolor aktualizowane. | klik `ai-classification-*`; zmień; asercja; screenshot `b4-s05-edit-typed.png`. | FT-4 | light |
| B4-S06 | Schema w dark | 1. Dark. | Kolory typów czytelne w dark. | `emulateMedia dark`; screenshot `b4-s06-dark.png`. | FT-5 | dark |

#### B5 — Wiring tier premium + telemetria

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| B5-S01 | Premium ON → ścieżka premium | 1. Flaga ON. 2. Generuj. | Pipeline używa premium brain. | przechwyć request generacji; asercja tier=premium; screenshot `b5-s01-premium-path.png`. | FT-5 | light |
| B5-S02 | Premium OFF → deterministyczna podłoga | 1. Flaga OFF. 2. Generuj. | Fallback deterministyczny (bez premium). | env OFF; asercja braku premium pól; screenshot `b5-s02-floor.png`. | FT-5 | light |
| B5-S03 | Telemetria zdarzeń | 1. Wykonaj generację premium. | Zdarzenia telemetrii zarejestrowane. | przechwyć telemetrię; asercja kształtu payloadu; screenshot `b5-s03-telemetry.png`. | FT-5 | light |
| B5-S04 | Limity/kwoty premium | 1. Przekrocz limit (jeśli wpięty). | Komunikat o limicie / graceful. | wymuś limit; asercja komunikatu; screenshot `b5-s04-quota.png`. | FT-5 | light |

---

### W5 · Seria X — Export / Assets / Spójność

#### X1 — Playwright HTML→PDF/PNG

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| X1-S01 | Eksport doc→PDF | 1. W edytorze: Export→PDF. | Pobrany plik PDF. | **[FALLBACK G18]** klik export→`export-format-pdf`; `page.waitForEvent('download')`; asercja `.pdf`; screenshot `x1-s01-pdf.png`. | FT-7 | light |
| X1-S02 | Eksport doc→PNG | 1. Export→PNG. | Pobrany plik PNG. | klik export PNG; download; asercja `.png`; screenshot `x1-s02-png.png`. | FT-7 | light |
| X1-S03 | Eksport decka→PDF | 1. Deck: Export→PDF. | PDF wieloslajdowy. | export z decka; download; asercja; screenshot `x1-s03-deck-pdf.png`. | FT-7 | light |
| X1-S04 | Treść w eksporcie | 1. Eksportuj dokument z treścią. | Treść obecna w wyjściu (smoke). | download→zapis→asercja rozmiaru>0; screenshot `x1-s04-content.png`. | FT-7 | light |

#### X2 — exceljs Conditional Formatting export

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| X2-S01 | Eksport tabeli→XLSX | 1. Grid: Export→XLSX. | Pobrany `.xlsx`. | **[FALLBACK G18]** export xlsx; download; asercja `.xlsx`; screenshot `x2-s01-xlsx.png`. | FT-7 | light |
| X2-S02 | CF w eksporcie | 1. Tabela z regułą CF. 2. Export. | Reguły CF zachowane w pliku. | export; (weryfikacja exceljs offline) asercja download; screenshot `x2-s02-cf-export.png`. | FT-7 | light |
| X2-S03 | Formuły w eksporcie | 1. Tabela z formułami. 2. Export. | Formuły/wartości obecne. | export; download; screenshot `x2-s03-formula-export.png`. | FT-7 | light |
| X2-S04 | Typy kolumn w XLSX | 1. Tabela typowana. 2. Export. | Typy/kolory odwzorowane. | export; download; screenshot `x2-s04-typed-export.png`. | FT-7 | light |

#### X3 — Rasteryzacja wykresów

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| X3-S01 | Wykres → raster w PDF | 1. Dok z wykresem. 2. Export PDF. | Wykres jako obraz w PDF. | export; download; screenshot `x3-s01-chart-pdf.png`. | FT-7 | light |
| X3-S02 | Wykres → PNG | 1. Export PNG dokumentu z wykresem. | Wykres widoczny na PNG. | export PNG; download; screenshot `x3-s02-chart-png.png`. | FT-7 | light |
| X3-S03 | Wykres w decku→export | 1. Slajd z wykresem. 2. Export. | Raster wykresu w wyjściu. | export decka; download; screenshot `x3-s03-deck-chart.png`. | FT-7 | light |
| X3-S04 | Jakość rasteryzacji | 1. Porównaj wykres na ekranie vs export. | Brak utraty kluczowych elementów. | screenshot edytora + export; screenshot `x3-s04-quality.png`. | FT-7 | light |

#### X4 — Stock images + smart icons

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| X4-S01 | Wstawienie stock image | 1. Wstaw obraz ze stocku. | Obraz w treści/slajdzie. | **[FALLBACK]** akcja insert image; `expect(locator('img')).toBeVisible()`; screenshot `x4-s01-stock.png`. | FT-7 | light |
| X4-S02 | Smart icon dobrany do treści | 1. Wstaw smart icon. | Ikona pasująca do kontekstu. | asercja `svg`/icon; screenshot `x4-s02-icon.png`. | FT-7 | light |
| X4-S03 | Asset w eksporcie | 1. Eksportuj z obrazem. | Obraz w PDF/PNG. | export; download; screenshot `x4-s03-asset-export.png`. | FT-7 | light |
| X4-S04 | Fallback przy braku assetu | 1. Wymuś brak obrazu. | Placeholder zamiast crasha. | asercja placeholdera; screenshot `x4-s04-fallback.png`. | FT-7 | light |

#### X5 — Doc/Sheet unified entity

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| X5-S01 | Jedna encja dla doc | 1. Utwórz doc. 2. Otwórz z hubu. | Ten sam rekord (brak duplikatu). | utwórz→id; otwórz z `/presentations`; asercja tego samego id; screenshot `x5-s01-doc-entity.png`. | FT-8 | light |
| X5-S02 | Jedna encja dla sheet | 1. Utwórz tabelę. 2. Otwórz z hubu. | Spójny rekord. | analogicznie; screenshot `x5-s02-sheet-entity.png`. | FT-8 | light |
| X5-S03 | Edycja w studio → widoczna w hubie | 1. Edytuj w studio. 2. Wróć do hubu. | Zmiana widoczna bez duplikatu. | edytuj→hub→asercja; screenshot `x5-s03-sync.png`. | FT-8 | light |
| X5-S04 | Brak rozjazdu canvas↔studio | 1. Porównaj wersje. | Jeden deliverable, zero duplikatów. | asercja unikalności id; screenshot `x5-s04-no-dup.png`. | FT-8 | light |

#### X6 — Outputs transactional registry

| ID | Tytuł | Kroki manualne | Oczekiwany rezultat | Automatyzacja Playwright | FT | Theme |
|----|-------|----------------|---------------------|--------------------------|----|-------|
| X6-S01 | Nowy deliverable trafia do rejestru | 1. Utwórz output. 2. Otwórz `/presentations`. | Pozycja widoczna w rejestrze. | utwórz→goto hub; **[FALLBACK G17]** asercja wiersza; screenshot `x6-s01-registry.png`. | FT-8 | light |
| X6-S02 | Link-by-reference (governance) | 1. Otwórz pozycję rejestru. | Link do encji, nie kopia. | asercja nawigacji do studio po id; screenshot `x6-s02-link-ref.png`. | FT-8 | light |
| X6-S03 | Transakcyjność (brak duchów) | 1. Przerwij tworzenie. 2. Sprawdź hub. | Brak wpisu-ducha przy błędzie. | wymuś error w trakcie; asercja braku wiersza; screenshot `x6-s03-transactional.png`. | FT-8 | light |
| X6-S04 | Usunięcie czyści rejestr | 1. Usuń deliverable. | Znika z rejestru. | delete→reload hub→asercja braku; screenshot `x6-s04-delete.png`. | FT-8 | light |
| X6-S05 | Rejestr w dark | 1. Dark. 2. Hub. | Lista czytelna w dark. | `emulateMedia dark`; screenshot `x6-s05-dark.png`. | FT-8 | dark |

---

## 4. Manifest zrzutów ekranu

> Wszystkie pliki w `docs/qa/screens/deliverables-2026-06-22/`. Łącznie **127** zrzutów.

### W1 — Seria E (22)
| Sub | Pliki |
|-----|-------|
| E1 | e1-s01-hub.png · e1-s02-launcher-open.png · e1-s03-type-tiles.png · e1-s04-select-report.png · e1-s05-select-presentation.png · e1-s06-launcher-dark.png |
| E2 | e2-s01-blank.png · e2-s02-report-templates.png · e2-s03-deck-templates.png · e2-s04-table-templates.png · e2-s05-template-selected.png |
| E3 | e3-s01-pathA-blank.png · e3-s02-pathA-template.png · e3-s03-pathB-intent.png · e3-s04-pathB-planning.png · e3-s05-pathB-draft.png · e3-s06-pathC-entity.png · e3-s07-empty-contract.png · e3-s08-error-state.png |
| E4 | e4-s01-route-doc.png · e4-s02-route-deck.png · e4-s03-route-table.png · e4-s04-resume-artifact.png |

### W2 — Seria R (33)
| Sub | Pliki |
|-----|-------|
| R1 | r1-s01-editor.png · r1-s02-typing.png · r1-s03-heading.png · r1-s04-list.png · r1-s05-bold.png · r1-s06-persist.png · r1-s07-undo-redo.png · r1-s08-editor-dark.png |
| R2 | r2-s01-inline-menu.png · r2-s02-fix-applied.png · r2-s03-no-modes.png · r2-s04-reject.png · r2-s05-accept.png · r2-s06-inline-dark.png |
| R3 | r3-s01-table.png · r3-s02-chart.png · r3-s03-kpi.png · r3-s04-blocks-persist.png · r3-s05-blocks-dark.png |
| R4 | r4-s01-wizard.png · r4-s02-slides.png · r4-s03-sorter.png · r4-s04-edit-slide.png · r4-s05-present.png · r4-s06-deck-dark.png |
| R5 | r5-s01-grid.png · r5-s02-cell-edit.png · r5-s03-add-row.png · r5-s04-formula-sum.png · r5-s05-formula-ref.png · r5-s06-cf-rule.png · r5-s07-cf-recalc.png · r5-s08-grid-dark.png |

### W3 — Seria T (18)
| Sub | Pliki |
|-----|-------|
| T1 | t1-s01-preset.png · t1-s02-persist.png · t1-s03-meta.png · t1-s04-type-binding.png |
| T2 | t2-s01-library.png · t2-s02-audit-report.png · t2-s03-board-deck.png · t2-s04-risk-register.png · t2-s05-kpi-dashboard.png |
| T3 | t3-s01-create.png · t3-s02-read.png · t3-s03-update.png · t3-s04-delete.png · t3-s05-isolation.png |
| T4 | t4-s01-input.png · t4-s02-suggestion.png · t4-s03-accept.png · t4-s04-fallback.png |

### W4 — Seria B (30)
| Sub | Pliki |
|-----|-------|
| B1 | b1-s01-available.png · b1-s02-layout.png · b1-s03-variety.png · b1-s04-hierarchy.png · b1-s05-telemetry.png · b1-s06-no-flag.png · b1-s07-error.png · b1-s08-dark.png |
| B2 | b2-s01-variants.png · b2-s02-pick.png · b2-s03-remix.png · b2-s04-content-kept.png · b2-s05-undo.png · b2-s06-dark.png |
| B3 | b3-s01-intake.png · b3-s02-outline.png · b3-s03-document.png · b3-s04-consistency.png · b3-s05-editable.png · b3-s06-dark.png |
| B4 | b4-s01-schema.png · b4-s02-colors.png · b4-s03-seed.png · b4-s04-priority-empty.png · b4-s05-edit-typed.png · b4-s06-dark.png |
| B5 | b5-s01-premium-path.png · b5-s02-floor.png · b5-s03-telemetry.png · b5-s04-quota.png |

### W5 — Seria X (24)
| Sub | Pliki |
|-----|-------|
| X1 | x1-s01-pdf.png · x1-s02-png.png · x1-s03-deck-pdf.png · x1-s04-content.png |
| X2 | x2-s01-xlsx.png · x2-s02-cf-export.png · x2-s03-formula-export.png · x2-s04-typed-export.png |
| X3 | x3-s01-chart-pdf.png · x3-s02-chart-png.png · x3-s03-deck-chart.png · x3-s04-quality.png |
| X4 | x4-s01-stock.png · x4-s02-icon.png · x4-s03-asset-export.png · x4-s04-fallback.png |
| X5 | x5-s01-doc-entity.png · x5-s02-sheet-entity.png · x5-s03-sync.png · x5-s04-no-dup.png |
| X6 | x6-s01-registry.png · x6-s02-link-ref.png · x6-s03-transactional.png · x6-s04-delete.png · x6-s05-dark.png |

---

## 5. Podsumowanie liczbowe

| Fala | Seria | Pod-moduły | Scenariusze |
|------|-------|-----------|-------------|
| W1 | E | 4 | 23 |
| W2 | R | 5 | 33 |
| W3 | T | 4 | 18 |
| W4 | B | 5 | 30 |
| W5 | X | 6 | 25 |
| **Razem** | **5 serii** | **24** | **129** |

- **Pod-moduły:** 24 (E1–E4, R1–R5, T1–T4, B1–B5, X1–X6).
- **Scenariusze:** 129.
- **Zrzuty ekranu:** 127 (część scenariuszy planning/draft/quality dzieli przebieg, ale każdy unikalny plik wymieniony w manifeście).

> Uwaga: scenariusze oznaczone **[FALLBACK]** wymagają dodania `data-testid` z §2 zanim automatyzacja będzie w pełni stabilna. Do tego czasu używają `getByRole`/`getByPlaceholder`/`aria-label`.
