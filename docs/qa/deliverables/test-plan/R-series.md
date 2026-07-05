# Plan testów — SERIA R (Odchudzenie edytorów) · Program „Generatory Deliverable" (fala W2)

> Status: blueprint QA (manual + Playwright). Autor: QA Eng. Data: 2026-06-22.
> SSOT produktowy: `docs/product/DELIVERABLES_GENERATORS_SPEC.md` · pamięć: `project_deliverables_generators`.
> Zakres: R1–R5 — edytory „mniej znaczy więcej" (Doc/Deck/Tabela).

---

## 0. Rekonesans (zweryfikowane trasy/komponenty)

| Obszar | Trasa | Root komponent | Istniejące `data-testid` |
|---|---|---|---|
| Doc Studio | `/document-studio` oraz `/document-studio/:artifactId` | `DocumentStudioView` (fazy `intake → outline → document`; typ `Phase`) | `document-tiptap-editor` (na `DocumentTipTapEditor`) |
| Doc inline-AI | nakładka nad zaznaczeniem w edytorze | `DocumentInlineAIMenu` + `useDocumentInlineAI` | **BRAK** (do dodania) |
| Doc bloki | render wewnątrz dokumentu | `DocChartBlock` (recharts: `BarChart`/`LineChart`/`PieChart` w `ResponsiveContainer`), `DocTableBlock` (`.doc-table-block`), `DocKpiStrip` (`.doc-kpi-strip`) | **BRAK** (klasy BEM, brak test-id) |
| Deck | `/presentations/builder/:deckId` (za `BetaGate moduleId="MODULE_PRESENTATIONS"` + `ProductionModuleGate`) | `DeckBuilderMelsView` | `deck-builder-mels-root` |
| Deck panele | wewnątrz shellu | `SlideSorter`, `CardCanvas` (regen slajdu: `presentations.builder.regenerateSlide`, placeholder „Przerób ten slajd…"), `BlockToolbar`, `PresentMode`, `ThemeSwitcher`, `CommandPalette` (`onPresent`/`onOpenTheme`) | **BRAK** (do dodania) |
| Tabela | `/my-work` → otwarcie narzędzia Tabela → `IdeaTableTool` → `ViewRouter` → grid (`GridView`) | `ViewRouter` / `GridView` (`<thead>`/`<tr>`/`role="gridcell"`) | `cell-cursor-${rowId}-${colKey}`, `cell-cursor-chip-...` (tylko kolaboracja) |
| Tabela CF/formuły | w gridzie | `ConditionalFormatting`, `FormulaEditor`, `formulaEngineCore`, persist przez `useTablePlatformIntegration` (CF → `config` JSONB aktywnego widoku) | **BRAK** na regułach/komórkach CF |

**Uwaga terminologiczna (ważna dla R2):** w `DocumentStudioView` „Mode 1 / Mode 3" = *tryby generacji* (intake→outline→document vs intake+template). To **NIE** jest „Mode1/2/3" z zadania R2. „Kasacja Mode 1/2/3" w R2 = usunięcie z UI legacy wariantów ekspozycji akcji AI-rewrite (dawne tryby przełączane), pozostawienie jednego, prostego menu inline-AI (`DocumentInlineAIMenu`, 5 akcji). Test R2-S05 weryfikuje **brak** jakiegokolwiek przełącznika trybów / etykiet „Mode 1/2/3" / „Tryb 1/2/3" w widoku edytora dokumentu.

**Inline-AI — realne akcje (`INLINE_ACTIONS`, `inlineActionPrompts.ts`):**
`shorten` („Skróć") · `expand` („Rozwiń") · `improve` („Popraw") · `formal` („Formalny ton") · `explain` („Wyjaśnij"). Wejście do menu: przycisk „Popraw z Teresa", potem lista akcji.

**Flaga:** `VITE_ENABLE_DELIVERABLES_LIGHT` używana w `src/services/deliverablesGeneration.ts` (część ścieżki generacji). Część zmian R jest za flagą — testy E2E muszą sprawdzić, że flaga jest ON na środowisku (lokalnie `.env.local`; na Railway staging/demo wymaga ustawienia build-env — patrz `finding_deliverables_vite_flag_deploy`). Brak ON = „nigdy nie działało".

---

## 1. Infrastruktura Playwright (kontrakt dla wszystkich spec'ów R)

- Konfig: `playwright.config.ts`. `testDir: ./tests/e2e`, projekt `chromium`, viewport **1680×1050**, timeout testu 60 s, asercje 10 s.
- BaseURL FE: `E2E_BASE_URL` (domyślnie `http://localhost:3000`). API: `E2E_API_URL` (`http://127.0.0.1:3001`).
- Auth + seed (z `tests/e2e/smoke/work-canvas-helpers.ts`):
  - `loginAsOwner(page)` / `loginAsMember(page)` — bootstrap tokenu + `seedSessionStorage` (token + `consultinity-storage` z `currentUser`/`currentOrganization`). Zwraca token.
  - `suppressOnboarding(page)` — **MUSI** być wywołane PRZED każdym `page.goto` (route-intercept `/api/preferences` + seed localStorage tour-flags). Fallback: `dismissOverlayIfPresent(page)`.
  - `createWorkCanvasDraft(request, token, input)` — seeduje draft dokumentu (POST `/api/work-canvas/drafts`, zwraca `{ id, conversationId, title }`). Pozwala podać `content` (markdown) i `kind`.
  - `collectPageSignals(page)` — zbieracz błędów konsoli + 5xx `/api/work-canvas`; `assertClean()` na końcu testu.
- Doc Studio API do seedowania artefaktu (z `document-studio-word-flow.spec.ts`): `POST /api/document-studio/generate` (`useLlm:false`) → `artifactId` → otwórz `/document-studio/:artifactId`. Read-back `GET /api/document-studio/:artifactId`.
- Screenshoty: katalog `docs/qa/screens/deliverables-R-<data>/` (np. `deliverables-R-2026-06-22/`). `await page.screenshot({ path: 'docs/qa/screens/deliverables-R-2026-06-22/<id>.png', fullPage: true })`.
- Dark mode (FT-7): PRZED `goto` →
  ```ts
  await page.addInitScript(() => {
    const raw = localStorage.getItem('consultify-storage');
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = { ...(parsed.state || {}), theme: 'dark' };
    localStorage.setItem('consultify-storage', JSON.stringify(parsed));
    document.documentElement.classList.add('dark');
  });
  ```
- Stabilność: `forbidOnly` w CI, `retries: 2` w CI. Sesje współbieżne (M05/M06/M07) potrafią chwilowo zapchać single-process backend — `loginViaBootstrap` ma retry/backoff; dla autosave dawaj margines (patrz „autosave timing" niżej).

**Skróty selektorów (proponowane stałe na górze spec'ów):**
```ts
const DOC_EDITOR = '[data-testid="document-tiptap-editor"] .ProseMirror';
const DECK_ROOT  = '[data-testid="deck-builder-mels-root"]';
```

**Słowniczek FT (kryteria akceptacji programu):** FT-1 = renderuje się / działa bez błędu; FT-2 = persystencja po reload; FT-3 = dark/light spójne; FT-7 = jakość wizualna (recharts/ramki/motyw); FT-8 = brak legacy/martwego UI (kasacja trybów, brak Mode1/2/3).

---

## R1 — Doc → TipTap edytor

**Cel:** edytor dokumentu (`DocumentTipTapEditor`) renderuje i edytuje wszystkie typy bloków (nagłówek, lista, tabela, wykres, KPI, callout), zapisuje zmiany (autosave) i jest spójny dark/light.
**FT:** FT-1 (render+edycja), FT-2 (autosave persystuje po reload), FT-3 (dark/light), FT-7 (jakość bloków).

| ID | Tytuł | Typ | Kroki manualne | Oczekiwane | Playwright (selektory + kroki + screenshot) | FT |
|---|---|---|---|---|---|---|
| R1-S01 | Edycja nagłówka | oba | Otwórz dokument w `/document-studio/:id`. Kliknij w nagłówek H1/H2, zmień tekst. | Nagłówek zmienia treść inline, styl heading zachowany, brak skoku layoutu. | `goto` → `page.locator(DOC_EDITOR).getByRole('heading').first().click()`; `page.keyboard.press('End')`; `page.keyboard.type(' — edytowany')`; `await expect(page.locator(DOC_EDITOR)).toContainText('edytowany')`. SS `R1-S01-naglowek.png`. | FT-1 |
| R1-S02 | Edycja listy (bullet/ordered) | oba | Ustaw kursor na liście, dodaj nowy element (Enter), wcięcie (Tab). | Nowy `<li>` pojawia się, numeracja/punkty utrzymane, Tab tworzy zagnieżdżenie. | `page.locator(DOC_EDITOR).locator('ul li, ol li').first().click()`; `page.keyboard.press('End'); page.keyboard.press('Enter'); page.keyboard.type('Nowy punkt')`; `expect(...locator('li')).toContainText(['Nowy punkt'])`. SS `R1-S02-lista.png`. | FT-1 |
| R1-S03 | Render tabeli w dokumencie | oba | Otwórz dokument zawierający tabelę. | `DocTableBlock` renderuje `<table>` z nagłówkiem i ramkami (border), caption jeśli jest. | `expect(page.locator('.doc-table-block table')).toBeVisible()`; `expect(page.locator('.doc-table-block th').first()).toBeVisible()`. SS `R1-S03-tabela.png`. | FT-1, FT-7 |
| R1-S04 | Render wykresu (recharts) | oba | Otwórz dokument z blokiem wykresu. | `DocChartBlock` renderuje SVG recharts w `ResponsiveContainer` (oś, serie), bez overflow. | `expect(page.locator('.recharts-responsive-container').first()).toBeVisible()`; `expect(page.locator('.recharts-surface').first()).toBeVisible()`. SS `R1-S04-wykres.png`. | FT-1, FT-7 |
| R1-S05 | Render KPI strip | oba | Otwórz dokument z `DocKpiStrip`. | Karty KPI (`.doc-kpi-strip__card`) z labelem/wartością/deltą; siatka spójna. | `expect(page.locator('.doc-kpi-strip__card').first()).toBeVisible()`; `expect(page.locator('.doc-kpi-strip__value').first()).toBeVisible()`. SS `R1-S05-kpi.png`. | FT-1, FT-7 |
| R1-S06 | Callout | oba | Otwórz dokument z calloutem; zweryfikuj render i edycję treści. | Callout renderuje się z tłem/ikoną, treść edytowalna. | (po dodaniu test-id) `expect(page.locator('[data-testid="doc-callout"]').first()).toBeVisible()`. Manual: edycja tekstu callouta. SS `R1-S06-callout.png`. | FT-1, FT-7 |
| R1-S07 | Autosave po reload | oba | Edytuj nagłówek/akapit. Odczekaj na autosave (zmieni się status zapisu). Odśwież stronę. | Po reload zmiana jest obecna (FT-2). | Edytuj jak R1-S01 → poczekaj na sygnał zapisu (patrz „autosave timing"); `await page.reload()`; `await suppressOnboarding` przy ponownym mount nie dotyczy (init-script trwa); `await expect(page.locator(DOC_EDITOR)).toContainText('edytowany')`. SS `R1-S07-po-reload.png`. | FT-2 |
| R1-S08 | Dark/light | Auto | Otwórz edytor w light, potem w dark (init-script). | Tło/tekst/bloki czytelne w obu, brak crimson-leak ani niewidocznego tekstu. | Dwa konteksty (light + dark init-script). W obu: `expect(page.locator(DOC_EDITOR)).toBeVisible()`. SS `R1-S08-light.png`, `R1-S08-dark.png`. | FT-3 |

### Selektory do dodania (test-id) — R1
- `DocTableBlock` (`<figure class="doc-table-block">`) → `data-testid="doc-table-block"`.
- `DocChartBlock` (kontener) → `data-testid="doc-chart-block"` + atrybut `data-chart-type="bar|line|pie"`.
- `DocKpiStrip` (`<figure class="doc-kpi-strip">`) → `data-testid="doc-kpi-strip"`.
- Callout → `data-testid="doc-callout"` (komponent calloutu — wymaga lokalizacji w renderze bloków; obecnie tylko klasy/struktura TipTap).
- Wskaźnik statusu autosave → `data-testid="doc-autosave-status"` z `data-state="saving|saved|dirty"` (kluczowe dla deterministycznego R1-S07).

---

## R2 — Doc → inline-AI „zaznacz → popraw" + kasacja Mode 1/2/3

**Cel:** zaznaczenie tekstu otwiera menu inline-AI (`DocumentInlineAIMenu`) z 5 akcjami; akcje skracają/rozwijają/zmieniają ton; propozycja zatwierdzana/odrzucana; legacy „Mode 1/2/3" zniknęły z UI.
**FT:** FT-1 (akcje działają), FT-2 (zatwierdzona zmiana persystuje), FT-3 (dark/light), FT-8 (brak legacy trybów).

| ID | Tytuł | Typ | Kroki manualne | Oczekiwane | Playwright (selektory + kroki + screenshot) | FT |
|---|---|---|---|---|---|---|
| R2-S01 | Zaznacz → „Popraw" akapit | oba | Zaznacz akapit w edytorze. Pojawia się menu inline-AI. Kliknij „Popraw z Teresa" → „Popraw". | Po odpowiedzi pojawia się propozycja (diff/podgląd) z akcjami zatwierdź/odrzuć. | Zaznacz akapit (`triple_click`/drag), `page.getByRole('button', { name: /Popraw z Teresa/ }).click()`, `page.getByRole('button', { name: 'Popraw' }).click()`, `await expect(page.getByRole('button', { name: /Zatwierdź|Approve/ })).toBeVisible()`. SS `R2-S01-popraw.png`. | FT-1 |
| R2-S02 | „Skróć" | oba | Zaznacz akapit → menu → „Skróć". | Propozycja ~40% krótsza; zatwierdzenie skraca akapit. | jw. z `name: 'Skróć'`; po zatwierdzeniu `expect` długość tekstu < oryginał. SS `R2-S02-skroc.png`. | FT-1 |
| R2-S03 | „Rozwiń" | oba | Zaznacz akapit → menu → „Rozwiń". | Propozycja dłuższa/szczegółowa; zatwierdzenie wydłuża. | jw. `name: 'Rozwiń'`. SS `R2-S03-rozwin.png`. | FT-1 |
| R2-S04 | Zmień ton („Formalny ton") | oba | Zaznacz akapit → menu → „Formalny ton". | Propozycja w tonie formalnym. | jw. `name: 'Formalny ton'`. SS `R2-S04-ton.png`. | FT-1 |
| R2-S05 | Brak Mode 1/2/3 w UI | oba | Przejrzyj toolbar/menu edytora i inline-AI. | Nigdzie nie ma przełącznika „Mode 1/2/3" / „Tryb 1/2/3" ani legacy wariantów rewrite. | `await expect(page.getByText(/Mode\s?[123]|Tryb\s?[123]/i)).toHaveCount(0)`; `await expect(page.locator('[data-testid="ai-mode-switch"]')).toHaveCount(0)`. SS `R2-S05-brak-mode.png`. | FT-8 |
| R2-S06 | Dark/light inline-AI | Auto | Otwórz menu inline-AI w light i dark. | Menu czytelne w obu motywach, przyciski akcji widoczne, brak crimson-leak. | Dwa konteksty; w obu otwórz menu i SS `R2-S06-light.png`, `R2-S06-dark.png`. | FT-3 |
| R2-S07 | Odrzucenie propozycji | Manual | Wywołaj akcję, odrzuć propozycję (przycisk reject). | Tekst wraca do oryginału, brak zmian. | (manual + opcjonalnie auto po test-id) `page.getByRole('button', { name: /Odrzuć|Reject/ }).click()`; `expect` tekst == oryginał. | FT-1 |
| R2-S08 | Persystencja zatwierdzonej zmiany | oba | Po R2-S02 zatwierdź, odczekaj autosave, reload. | Skrócony akapit zachowany po reload (FT-2). | po zatwierdzeniu czekaj na autosave → `reload` → `expect` skrócona treść. SS `R2-S08-po-reload.png`. | FT-2 |

### Selektory do dodania (test-id) — R2
- `DocumentInlineAIMenu` root → `data-testid="doc-inline-ai-menu"`.
- Przycisk wejścia → `data-testid="doc-inline-ai-trigger"` („Popraw z Teresa").
- Każda akcja → `data-testid="doc-inline-ai-action-${action.id}"` (`shorten|expand|improve|formal|explain`).
- Stan propozycji: `data-testid="doc-inline-ai-proposal"`, przyciski `data-testid="doc-inline-ai-approve"` / `doc-inline-ai-reject`.
- (negatywny) upewnić się, że NIE istnieje `data-testid="ai-mode-switch"` — używane jako asercja kasacji.

---

## R3 — Doc → render tabel/wykresów/KPI (recharts)

**Cel:** bloki danych renderują się poprawnie w jakości docelowej (recharts: bar/line/pie; KPI-strip; tabela z ramkami).
**FT:** FT-1 (render), FT-3 (dark/light), FT-7 (jakość wizualna).

> Seed: przygotuj artefakt zawierający po jednym bloku każdego typu (`createWorkCanvasDraft` z `content` zawierającym bloki, albo `POST /document-studio/generate` z payloadem, którego schema zawiera bloki bar/line/pie/kpi/tabela). Jeśli schema generatora nie pozwala wymusić typu wykresu — patrz „Wykonalność dziś".

| ID | Tytuł | Typ | Kroki manualne | Oczekiwane | Playwright (selektory + kroki + screenshot) | FT |
|---|---|---|---|---|---|---|
| R3-S01 | Wykres słupkowy (bar) | oba | Otwórz dokument z blokiem typu bar. | `BarChart` recharts: słupki, osie X/Y, legenda; brak overflow. | `expect(page.locator('[data-chart-type="bar"] .recharts-bar')).toBeVisible()` (po test-id) / fallback `.recharts-bar-rectangle`. SS `R3-S01-bar.png`. | FT-1, FT-7 |
| R3-S02 | Wykres liniowy (line) | oba | Otwórz dokument z blokiem line. | `LineChart`: linie serii, osie, punkty. | `expect(page.locator('[data-chart-type="line"] .recharts-line')).toBeVisible()`. SS `R3-S02-line.png`. | FT-1, FT-7 |
| R3-S03 | Wykres kołowy (pie) | oba | Otwórz dokument z blokiem pie. | `PieChart`: wycinki, legenda/labelki %. | `expect(page.locator('[data-chart-type="pie"] .recharts-pie')).toBeVisible()`. SS `R3-S03-pie.png`. | FT-1, FT-7 |
| R3-S04 | KPI-strip | oba | Otwórz dokument z `DocKpiStrip`. | Wszystkie karty KPI z wartościami; siatka równa; delta kolory zgodne z motywem. | `expect(page.locator('.doc-kpi-strip__card')).toHaveCount(/* >=1 */)`; `expect(page.locator('.doc-kpi-strip__value').first()).not.toBeEmpty()`. SS `R3-S04-kpi.png`. | FT-1, FT-7 |
| R3-S05 | Tabela z ramkami | oba | Otwórz dokument z `DocTableBlock`. | `<table>` z widocznymi ramkami komórek, nagłówek wyróżniony, zebra/hover spójne dark/light. | `expect(page.locator('.doc-table-block table')).toBeVisible()`; sprawdź `border` computed style komórki. SS `R3-S05-tabela.png`. | FT-1, FT-7 |
| R3-S06 (dark) | Bloki w dark | Auto | Powtórz S01–S05 w dark mode. | Wykresy/tabela/KPI czytelne na ciemnym tle (kontrast osi, linii, ramek). | Init-script dark; SS `R3-S06-dark-bar.png`, `...-line.png`, `...-pie.png`, `...-kpi.png`, `...-tabela.png`. | FT-3, FT-7 |

### Selektory do dodania (test-id) — R3
- `DocChartBlock` → `data-testid="doc-chart-block"` + `data-chart-type` (jw. R1). Bez tego rozróżnienie bar/line/pie opiera się tylko na klasach recharts (`.recharts-bar`/`.recharts-line`/`.recharts-pie`), które są wiarygodne, ale nie wiążą bloku z konkretnym artefaktem przy wielu wykresach.

---

## R4 — Deck → Gamma-flow

**Cel:** builder talii (`DeckBuilderMelsView`) pozwala przerobić slajd AI, zmienić motyw, wejść w tryb prezentacji, zastosować branding, cofnąć zmianę; spójny dark/light.
**FT:** FT-1 (akcje działają), FT-3 (dark/light), FT-7 (jakość Gamma).

> Dojście: `/presentations/builder/:deckId`. Wymaga istniejącej talii (deckId). Seed: utwórz talię przez API generatora prezentacji (analogicznie do `deckGeneratorE2E.test.ts`) i użyj zwróconego `deckId`. Gate: `MODULE_PRESENTATIONS` (BetaGate) + `ProductionModuleGate` „Outputs" — w E2E owner ma dostęp; zweryfikuj, że gate nie blokuje (jeśli `hideNonCoreModulesOnPublicProduction` — patrz „Wykonalność dziś").

| ID | Tytuł | Typ | Kroki manualne | Oczekiwane | Playwright (selektory + kroki + screenshot) | FT |
|---|---|---|---|---|---|---|
| R4-S01 | Builder się montuje | oba | Otwórz `/presentations/builder/:deckId`. | `deck-builder-mels-root` widoczny; lewy rail (SlideSorter), canvas (CardCanvas) renderują slajdy. | `await expect(page.locator(DECK_ROOT)).toBeVisible()`; `expect(...slide-tile).toHaveCount(>=1)`. SS `R4-S01-builder.png`. | FT-1 |
| R4-S02 | Przerób slajd AI (regenerate) | oba | Wybierz slajd, wpisz w pole „Przerób ten slajd…", wywołaj regenerację. | Status „Regenerating…", po zakończeniu treść slajdu się zmienia. | (po test-id) `page.locator('[data-testid="deck-regenerate-slide"]').click()` lub wpisz w `placeholder=/Przerób ten slajd/`; `await expect(page.getByText(/Regenerating|Regeneruję/)).toBeVisible()`. SS `R4-S02-regen.png`. | FT-1 |
| R4-S03 | Zmień motyw | oba | Otwórz `ThemeSwitcher` (lub CommandPalette → „Theme"), wybierz inny motyw. | Tło/typografia/kolory slajdów zmieniają się natychmiast na wszystkich slajdach. | (po test-id) `page.locator('[data-testid="deck-theme-switcher"]').click()`; wybierz motyw; `expect` zmiana klasy/atrybutu motywu na canvasie. SS `R4-S03-motyw.png`. | FT-1, FT-7 |
| R4-S04 | Tryb prezentacji | oba | Kliknij „Present" (lub CommandPalette → „Present"). | `PresentMode` na pełnym ekranie; nawigacja strzałkami; ESC wychodzi. | (po test-id) `page.locator('[data-testid="deck-present-button"]').click()`; `await expect(page.locator('[data-testid="deck-present-mode"]')).toBeVisible()`; `page.keyboard.press('ArrowRight')`; `page.keyboard.press('Escape')`. SS `R4-S04-present.png`. | FT-1 |
| R4-S05 | Branding | oba | Zastosuj branding org (logo/kolory) w panelu. | Logo/kolory marki widoczne na slajdach zgodnie z motywem. | (po test-id) manual + asercja obecności logo `[data-testid="deck-brand-logo"]`. SS `R4-S05-branding.png`. | FT-1, FT-7 |
| R4-S06 | Undo | oba | Wykonaj zmianę (np. edycja bloku), kliknij Undo / Cmd+Z. | Ostatnia zmiana cofnięta, slajd wraca do poprzedniego stanu. | edytuj blok; `page.keyboard.press('Meta+z')` (lub `[data-testid="deck-undo"]`); `expect` powrót treści. SS `R4-S06-undo.png`. | FT-1 |
| R4-S07 | Dark/light | Auto | Otwórz builder w light i dark. | Shell/panele/slajdy czytelne w obu; brak crimson-leak; tryb prezentacji ciemny spójny. | Dwa konteksty; SS `R4-S07-light.png`, `R4-S07-dark.png`. | FT-3 |

### Selektory do dodania (test-id) — R4
- `SlideSorter` kafelek slajdu → `data-testid="deck-slide-tile-${index}"` (+ `data-active`).
- `CardCanvas` regenerate → `data-testid="deck-regenerate-slide"`; pole przeróbki → `data-testid="deck-regenerate-input"`.
- `ThemeSwitcher` trigger → `data-testid="deck-theme-switcher"`; opcja motywu → `data-testid="deck-theme-option-${id}"`.
- Present: przycisk → `data-testid="deck-present-button"`; `PresentMode` root → `data-testid="deck-present-mode"`.
- Undo → `data-testid="deck-undo"` (jeśli jest przycisk w `DeckBuilderTopBar`/`BottomBar`).
- Branding/logo → `data-testid="deck-brand-logo"`.

---

## R5 — Tabela → Conditional Formatting w GridView + formuły AST

**Cel:** w gridzie (`ViewRouter`/`GridView`) reguły CF kolorują komórki; formuły AST (`formulaEngineCore`) liczą SUM/IF; CF zapamiętany w widoku i persystuje po reload (config JSONB widoku); działa też w kanban; spójny dark/light.
**FT:** FT-1 (CF+formuły działają), FT-2 (CF persystuje na widokach — `config` JSONB / „tp_views"), FT-3 (dark/light), FT-8 (brak legacy UI).

> Dojście: `/my-work` → otwórz narzędzie Tabela (`IdeaTableTool`). UWAGA: headless często zostawia canvas Ideas w skeletonie — weryfikacja w realnej przeglądarce (patrz `finding_m09_live_test_gates`). Seed danych: utwórz tabelę z kolumną liczbową + kilkoma wierszami (przez API tabeli / generator). Reguły CF i formuły konfiguruje się przez `ConditionalFormatting` / `FormulaEditor`; CF zapisywany przez `useTablePlatformIntegration` do `config` aktywnego widoku.

| ID | Tytuł | Typ | Kroki manualne | Oczekiwane | Playwright (selektory + kroki + screenshot) | FT |
|---|---|---|---|---|---|---|
| R5-S01 | Reguła >X → czerwony | oba | W kolumnie liczbowej dodaj regułę CF „wartość > X → tło czerwone". | Komórki spełniające warunek mają czerwone tło; reszta bez zmian. | (po test-id) otwórz panel CF, dodaj regułę; `expect` komórka `>X` ma `background` czerwony (computed style) lub klasę CF. SS `R5-S01-cf-greater.png`. | FT-1 |
| R5-S02 | Reguła „between" | oba | Dodaj regułę CF „między A i B → kolor". | Tylko komórki w przedziale podświetlone. | jw. z regułą between; asercja na 2+ komórkach. SS `R5-S02-cf-between.png`. | FT-1 |
| R5-S03 | Formuła SUM | oba | W kolumnie formuły wpisz `SUM(...)` w `FormulaEditor`. | Komórka pokazuje sumę zakresu; aktualizuje się przy zmianie danych. | otwórz `FormulaEditor`, wpisz formułę, zatwierdź; `expect` wartość komórki == oczekiwana suma. SS `R5-S03-sum.png`. | FT-1 |
| R5-S04 | Formuła IF | oba | Wpisz `IF(warunek, A, B)`. | Komórka zwraca A lub B wg warunku; brak błędu AST. | jw. z IF; `expect` poprawna gałąź. SS `R5-S04-if.png`. | FT-1 |
| R5-S05 | Widok zapamiętuje CF | oba | Po dodaniu CF przełącz widok i wróć. | Reguły CF nadal aktywne na powrocie do widoku. | przełącz przez `ViewSwitcher`, wróć; `expect` kolory CF nadal obecne. SS `R5-S05-cf-zapamietane.png`. | FT-2 |
| R5-S06 | CF po reload (persyst na config widoku) | oba | Dodaj CF → odśwież stronę. | Reguły CF wczytane z `config` JSONB widoku, kolory wracają (FT-2). | po dodaniu CF `await page.reload()` → poczekaj na hydrate gridu → `expect` kolory CF obecne. SS `R5-S06-cf-po-reload.png`. | FT-2 |
| R5-S07 | Kanban | oba | Przełącz widok na kanban (`ViewRouter` layout `kanban`). | Karty grupowane po kolumnie statusu; CF kolory na kartach jeśli dotyczy; bez błędu. | przełącz layout na kanban; `expect` kolumny/karty widoczne. SS `R5-S07-kanban.png`. | FT-1 |
| R5-S08 | Dark/light | Auto | Otwórz grid z CF w light i dark. | Kolory CF czytelne na obu tłach (czerwień nie zlewa się); nagłówki/ramki spójne. | Dwa konteksty; SS `R5-S08-light.png`, `R5-S08-dark.png`. | FT-3 |

### Selektory do dodania (test-id) — R5
- Wiersz gridu (`<tr>` danych w `GridView`) → `data-testid="grid-row-${rowId}"`.
- Nagłówek kolumny (`<th>`) → `data-testid="grid-header-${colKey}"`.
- Komórka (`role="gridcell"`) → `data-testid="grid-cell-${rowId}-${colKey}"` + `data-cf-active` gdy reguła CF trafiona (kluczowe — inaczej trzeba czytać computed `background-color`, kruche przy zmianach palety).
- Add-row → `data-testid="grid-add-row"`.
- Panel CF (`ConditionalFormatting`) → `data-testid="table-cf-panel"`, „dodaj regułę" → `data-testid="table-cf-add-rule"`, operator/wartość pól z `data-testid`.
- `FormulaEditor` input → `data-testid="table-formula-input"`, zatwierdź → `data-testid="table-formula-apply"`.
- `ViewSwitcher` opcja → `data-testid="table-view-${viewId}"`; layout kanban → `data-testid="table-view-kanban"`.

---

## Autosave timing (wspólne dla R1/R2/R5 — FT-2)

Autosave jest asynchroniczne i bywało źródłem flaków oraz realnych bugów (race 2× POST/409, re-save loop — patrz `finding_m07_canvas_hydrate_loading`). Zasady deterministyczne:
1. **Nie używaj sztywnego `waitForTimeout`** jako jedynego sygnału.
2. Preferuj **czekanie na odpowiedź sieci**: `await page.waitForResponse(r => /\/api\/document-studio\/.*|\/api\/work-canvas\/drafts/.test(r.url()) && r.request().method() !== 'GET' && r.ok())` PO edycji, PRZED `reload`.
3. Po dodaniu `data-testid="doc-autosave-status"` — czekaj na `data-state="saved"`.
4. Dla tabeli: czekaj na PATCH zapisujący `config` widoku (CF) zanim odświeżysz.
5. Po `reload` czekaj na pełen hydrate (edytor/grid widoczny i niepusty) zanim asercjujesz treść.

---

## Wykonalność dziś (uczciwa ocena blokerów automatyzacji)

**Gotowe do auto bez zmian kodu:**
- R1: render bloków (tabela/wykres/KPI po klasach BEM + recharts), edycja nagłówka/listy, dark/light, montaż edytora (`document-tiptap-editor` istnieje). Autosave-reload działa, ale wymaga `waitForResponse` (jest endpoint).
- R3: rozróżnienie bar/line/pie przez klasy recharts (`.recharts-bar/.recharts-line/.recharts-pie`) — wiarygodne dla 1 wykresu/typ; przy wielu wykresach niejednoznaczne.
- R2-S05 (kasacja Mode): asercja negatywna `getByText(/Mode [123]|Tryb [123]/)` działa już teraz (FT-8).

**Blokery / wymaga prac przed pełną automatyzacją:**
1. **Brak test-id na inline-AI (R2)** — `DocumentInlineAIMenu` bez `data-testid`. Da się chwytać po `getByRole('button', { name })` (etykiety PL pewne: „Skróć/Rozwiń/Popraw/Formalny ton/Wyjaśnij", trigger „Popraw z Teresa"), ale propozycja/approve/reject nie mają stabilnych nazw → kruche. Rekomendacja: dodać test-id z bloku R2.
2. **Brak test-id na deck (R4)** — slide-tile, present-button, theme-switcher, regenerate-slide. Regen po placeholderze „Przerób ten slajd…" i tłumaczeniach (`presentations.builder.regenerateSlide`) działa, ale lokatory tekstowe są kruche i zależne od locale. Pełny R4 = wymaga test-id.
3. **Brak test-id na wierszach/komórkach/regułach CF (R5)** — jedyne istniejące to `cell-cursor-*` (kolaboracja). Weryfikacja CF przez computed `background-color` jest możliwa, ale krucha przy zmianach palety/dark — dlatego rekomendowany `data-cf-active`. Bez test-id R5 jest w dużej części Manual.
4. **Seed danych:**
   - Doc (R1–R3): potrzebny artefakt z konkretnymi blokami. `POST /api/document-studio/generate` z `useLlm:false` daje deterministyczny dokument, ale **nie gwarantuje** wystąpienia każdego typu bloku (bar/line/pie/kpi/callout). Najpewniej trzeba dedykowanego seed-endpointu/fixtury artefaktu z wymuszonymi blokami (do potwierdzenia z BE) — inaczej R3 per-typ jest częściowo Manual.
   - Deck (R4): wymaga utworzonej talii (deckId) — seed jak w `deckGeneratorE2E.test.ts`. Gate `MODULE_PRESENTATIONS` + `ProductionModuleGate("Outputs")`: na publicznym prod `hideNonCoreModulesOnPublicProduction` może blokować — testować na staging/demo z modułem włączonym.
   - Tabela (R5): wymaga tabeli z danymi liczbowymi + dojścia przez `/my-work`/`IdeaTableTool`. **Headless często zostawia canvas w skeletonie** (`finding_m09_live_test_gates`) — część R5 realnie weryfikowalna tylko w żywej przeglądarce; harness E2E wymaga reużycia wzorca z M08/M09 (prod-build, restart-pool, viewport 1680).
5. **Flaga `VITE_ENABLE_DELIVERABLES_LIGHT`** — to build-time env (Vite). Jeśli OFF na środowisku testowym, część ścieżek R nie zadziała (objaw „nigdy nie działało", `finding_deliverables_vite_flag_deploy`). Spec'y R powinny w `beforeAll` asertować, że ścieżka deliverables jest aktywna (np. obecność wejścia generacji), inaczej `test.skip` z czytelnym powodem zamiast fałszywego fail.
6. **Autosave race (R1-S07/R2-S08/R5-S06)** — historycznie 2× POST → 409 → utrata danych po reload. Testy persystencji są zarazem testami regresji tego buga; trzymać `waitForResponse(ok)` + ewentualną asercję braku 409.

**Rekomendowana kolejność wdrożenia automatyzacji:** R1 (render + autosave) → R3 (render bloków) → R2 (po dodaniu test-id inline-AI) → R5 (po test-id grid/CF + harness żywy) → R4 (po test-id deck + seed talii). Do czasu dodania test-id: R2/R4/R5 prowadzić jako Manual wg tabel powyżej, ze screenshotami do `docs/qa/screens/deliverables-R-<data>/`.
