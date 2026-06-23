# Plan testów — SERIA X (Parytet eksportu + assety + spójność)

Program: **Generatory Deliverable** · Fala **W5** · Data planu: **2026-06-22**
Autor: QA (inżynier testów) · Status: blueprint do egzekucji (manual + auto)

---

## 0. Kontekst, infra i konwencje

**Czym jest Seria X:** wierność eksportu (HTML→PDF/PNG przez Playwright), `exceljs`
WorkbookBuilder z conditional formatting, wykresy (chart.js w doc, Recharts na
ekranie), stock-image fallback + smart-ikony, spójność encji (doc/sheet = jedna
encja) oraz transakcyjny rejestr Outputs z lineage.

### 0.1 Typy testów (kolumna „Typ")

| Typ | Runner | Po co | Komenda bazowa |
|---|---|---|---|
| **Export-fidelity-vitest** | vitest (`@vitest-environment node`) | FT-4 — parsujemy WYGENEROWANY plik (PNG magic / .xlsx ZIP+XML / chart.js config). Demaskuje fasadę. NIE Playwright. | `npx vitest run tests/unit/deliverables/...` |
| **Integration** | vitest | FT-2 round-trip DB (doc/sheet = jedna encja, Outputs lineage). NIE Playwright. | `npx vitest run tests/integration/deliverables/...` |
| **Playwright-UI** | `@playwright/test` | FT-5 pixel-diff (ekran↔PDF), FT-7 (przejście manualne zautomatyzowane), lista Outputs. baseURL `E2E_BASE_URL`. | `npx playwright test tests/e2e/deliverables/...` |
| **Manual-Excel** | człowiek + computer-use | „Otwórz w Excel" — wierność CF/walut/dat w realnym Excelu/Numbers. Półautomat przez `mcp__computer-use__*`. | krok manualny |

### 0.2 Infra — fakty z repo (zweryfikowane)

- **Renderer eksportu:** `server/src/services/playwrightPdfRenderer.ts`
  - `renderHtmlToPdf(input)` / `renderHtmlToPng(input)` — NIGDY nie rzucają; zwracają
    typed result `{ status: 'ok'|'unavailable'|'launch_failed'|'render_failed'|'timeout', ... }`.
  - Helpery testowe są eksportowane: `__resetAvailabilityCacheForTests()`,
    `__shutdownBrowserForTests()`. Mock `playwright` → fake `chromium.launch`.
  - PNG viewport default **1920×1080** (deck-friendly), `deviceScaleFactor=1`.
- **Excel:** `server/src/services/workbook/WorkbookBuilder.ts` (`buildWorkbookBuffer(schema)`)
  + `WorkbookSchema.ts` (`ConditionalFormattingBlock`/`ConditionalFormattingRule`:
  `dataBar`/`colorScale`/`iconSet`/`cellIs`). `hexToArgb` → ExcelJS zapisuje `FF<HEX>`.
- **Wykresy doc:** `server/src/services/documentStudio/documentChartRasterizer.ts`
  (`renderChartBlockToPng(block, opts?)`) — `chartjs-node-canvas`; 6 typów
  `bar/line/pie/donut/scatter/area`; fallback `null` (no throw).
- **X5 jedna encja:** `server/src/services/deliverables/unifiedDocEntityService.ts`
  - `getUnifiedDoc(orgId, { draftId?|artifactId? })`, `commitDraftToArtifact({orgId,draftId,committedBy})`,
    `listDraftsForArtifact(...)`. Wiązanie `work_canvas_drafts.artifact_id ↔ wave5_artifacts`.
- **X6 rejestr Outputs:** `server/src/services/v8/outputsTransactionalRegistry.ts`
  - `registerOutputArtifactTransactional(params)` (BEGIN/COMMIT, idempotent po
    `(originRuntime, originRecordId)`), `getArtifactLineage(artifactId, orgId)`.
    Tabele `v8_output_artifacts` + `v8_artifact_origin_links`.
- **Outputs Hub (UI):** `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx`
  - kontener `data-testid="reports-presentations-hub"`, ścieżki `/presentations`,
    `/reports`. Taby (z kodu): `outputs_all`, `outputs_mine`, `outputs_review`,
    `outputs_documents`, `outputs_sheets`.
    ⚠️ **BRAK per-tab `data-testid`** — selektory tabów to dziś tylko `id`/tekst.
    `data-testid` per-tab i per-wiersz listy = **DO DODANIA** (oznaczone niżej).

### 0.3 Wzorce dowodowe już w repo (evidence-grade — bazujemy na nich)

- `tests/unit/deliverables/playwrightHtmlToPng.test.ts` — PNG magic `0x89 0x50 0x4E 0x47`,
  viewport, fail-paths (`unavailable`/`render_failed`).
- `tests/unit/deliverables/workbookBuilderCf.test.ts` — `JSZip.loadAsync(buf)` →
  `xl/worksheets/sheet1.xml` zawiera `<conditionalFormatting>`/`databar`/`colorScale`/
  `cellIs`; `xl/styles.xml` zawiera `FF<HEX>` (demaskacja fasady SheetJS).
- `tests/unit/deliverables/documentChartRasterizer.test.ts` — 6 typów → PNG buffer;
  `donut→doughnut`, `area→line+fill:origin`; fallback `null`.
- `tests/integration/deliverables/tableGeneratorE2E.test.ts` — mock-LLM + scoring,
  mapa reachable vs need-extension.

### 0.4 Playwright login / screeny

- Helper: `tests/e2e/smoke/work-canvas-helpers.ts` → `loginAsOwner(page)`,
  `loginAsMember(page)`, `loginAsUser(page,email,pwd)`. Env: `E2E_OWNER_EMAIL/PASSWORD`,
  `E2E_BASE_URL` (FE, port 3000), `E2E_API_URL` (3001).
- Screeny dowodowe: `docs/qa/screens/deliverables-X-2026-06-22/` (tworzymy katalog z datą runu).

### 0.5 Mapa pokrycia FT (definicje przyjęte w Serii X)

- **FT-1** — feature działa (happy path, kontrakt).
- **FT-2** — round-trip / brak duplikatu / spójność po reloadzie.
- **FT-4** — **wierność WYGENEROWANEGO pliku** (parsowanie bajtów/XML, NIE „API zawołane").
- **FT-5** — pixel-diff ekran↔PDF poniżej progu Q2.
- **FT-7** — manualne przejście (zautomatyzowane gdzie się da).
- **FT-8** — fail-open / regresja (brak feature nie psuje reszty; graceful degradation).

---

## X1 — Puppeteer/Playwright HTML→PDF/PNG (deck + doc parytet)

**Cel:** wyeksportowany PDF/PNG zawiera REALNIE wykresy, obrazy, kolory, ramki tabel
— nie sam tekst — i jest wierny temu, co widać na ekranie (pixel-diff < próg Q2).
**FT:** FT-4 (plik = treść wizualna), FT-5 (pixel-diff), FT-7 (manual zautomatyzowany).

| ID | Tytuł | Typ | Jak uruchomić | Kryterium zaliczenia | Artefakt dowodowy | FT |
|---|---|---|---|---|---|---|
| X1-S01 | renderHtmlToPng — happy path typed-ok + PNG magic | Export-fidelity-vitest | `npx vitest run tests/unit/deliverables/playwrightHtmlToPng.test.ts` | `status==='ok'`, buffer bajty `0x89 50 4E 47`, `bytes>0` | parsowany Buffer PNG (magic) | FT-4 |
| X1-S02 | renderHtmlToPdf — happy path typed-ok + `%PDF-` magic | Export-fidelity-vitest | nowy `tests/unit/deliverables/playwrightHtmlToPdf.test.ts` (mock `playwright`, fake `page.pdf` zwraca `%PDF-1.4...`) | `status==='ok'`; buffer zaczyna się od ASCII `%PDF-` (`0x25 50 44 46`) | parsowany Buffer PDF | FT-4 |
| X1-S03 | PDF z `printBackground:true` i kolorami — tła/kolory w treści | Export-fidelity-vitest | jw.; HTML z `background:#DC2626`; assert `pdfOptions.printBackground===true` przekazane do `page.pdf` | mock `page.pdf` dostaje `printBackground:true`; bez tego eksport gubi kolory | mock-call args + Buffer | FT-4 |
| X1-S04 | HTML z `<img>`/SVG → eksport czeka na `networkidle` | Export-fidelity-vitest | jw.; assert `setContent` z `waitUntil:'networkidle'` (wzór z S01 test PNG `FT-4/5`) | `setContent` waitUntil `networkidle` → obrazy zdążą się załadować | mock-call args | FT-4 |
| X1-S05 | PNG slajdu deck — viewport 1920×1080 default + custom honorowany | Export-fidelity-vitest | `npx vitest run tests/unit/deliverables/playwrightHtmlToPng.test.ts` (S01 testy `FT-1/2`,`FT-1/3`) | default `{1920,1080}`, scale 1; custom viewport+`deviceScaleFactor` przekazane | mock `newContext` args | FT-4 |
| X1-S06 | Fail-open — brak chromium → `unavailable`, nie crash | Export-fidelity-vitest | `npx vitest run tests/unit/deliverables/playwrightHtmlToPng.test.ts` | `status==='unavailable'`, `reason` zawiera `chromium_binary_missing`; cleanup w `finally` | typed-result | FT-8 |
| X1-S07 | **Real chromium** — doc HTML → PDF zawiera obraz wykresu (nie sam tekst) | Export-fidelity-vitest (real) | nowy `server/src/services/__tests__/playwrightPdfReal.test.ts` (BEZ mocka playwright); parsuj PDF i sprawdź obecność XObject/Image (`/Image`, `/XObject` w strumieniu) | PDF > N KB i zawiera `/XObject`+`/Image`; sam-tekstowy PDF NIE przejdzie | parsowany PDF (string scan strumienia) | FT-4 |
| X1-S08 | **Pixel-diff ekran↔PDF** poniżej progu Q2 | Playwright-UI | nowy `tests/e2e/deliverables/x1-pixel-parity.spec.ts`: `loginAsOwner`, otwórz deck w preview, `page.screenshot` slajdu → renderuj ten sam slajd do PNG (lub PDF→PNG) → `pixelmatch` diff | różnica < próg **Q2** (TBD — patrz Wykonalność) | screenshot ekranu + render PNG + diff PNG do `docs/qa/screens/deliverables-X-2026-06-22/x1-pixeldiff-*.png` | FT-5 |
| X1-M01 | Manual: deck → PDF wierny (układ, fonty, kolory marki) | Manual-Excel/manual | UI: deck → Export PDF → otwórz PDF | wizualnie identyczny z ekranem; kolory/logo zachowane | PDF + screenshot porównawczy | FT-7 |
| X1-M02 | Manual: doc → PDF wierny | manual | UI: doc → Export PDF | nagłówki, listy, tabele, marginesy poprawne | PDF | FT-7 |
| X1-M03 | Manual: PNG pojedynczego slajdu | manual | UI: slajd → Export PNG | PNG ostre (deviceScaleFactor), pełny slajd | PNG | FT-7 |
| X1-M04 | Manual: tabela w PDF z ramkami | manual | doc z tabelą → PDF | linie/ramki widoczne (nie znikają), wyrównanie | PDF | FT-7 |
| X1-M05 | Manual: wykres w PDF | manual | doc z wykresem → PDF | wykres jako rastr (oś, legenda, kolory) | PDF | FT-7 |
| X1-M06 | Manual: vs ekran (side-by-side) | manual | ekran obok PDF | brak driftu układu/koloru | screenshot side-by-side | FT-7 |

---

## X2 — exceljs WorkbookBuilder + CF export

**Cel:** wyeksportowany `.xlsx` zawiera REALNE conditional formatting i kolory tła
w XML — demaskujemy fasadę SheetJS (która je gubi).
**FT:** FT-1 (CF działa), FT-4 (EVIDENCE-GRADE: ZIP+XML zawiera `<conditionalFormatting>`/`bgColor`), FT-8 (bez CF nadal działa).

| ID | Tytuł | Typ | Jak uruchomić | Kryterium zaliczenia | Artefakt dowodowy | FT |
|---|---|---|---|---|---|---|
| X2-S01 | dataBar → `<conditionalFormatting>` w sheet XML | Export-fidelity-vitest | `npx vitest run tests/unit/deliverables/workbookBuilderCf.test.ts` (`FT-1/1`) | XML zawiera `conditionalFormatting`, `B2:B4`, `databar` | `xl/worksheets/sheet1.xml` (JSZip) | FT-1 |
| X2-S02 | colorScale 3-color → 3 kolory ARGB w CF | Export-fidelity-vitest | jw. (`FT-1/2`) | XML zawiera `colorScale` + `FFDC2626`/`FFF59E0B`/`FF16A34A` | sheet1.xml | FT-1 |
| X2-S03 | colorScale 2-color → 2 cfvo/2 kolory | Export-fidelity-vitest | jw. (`FT-1/3`) | `colorScale` + `FFFFFFFF`/`FF000000` | sheet1.xml | FT-1 |
| X2-S04 | iconSet → blok CF odwołuje się do zestawu ikon | Export-fidelity-vitest | jw. (`FT-1/4`) | XML zawiera `iconSet` lub `3TrafficLights` (extLst dozwolony) | sheet1.xml | FT-1 |
| X2-S05 | cellIs `greaterThan` → reguła + styl | Export-fidelity-vitest | jw. (`FT-4/5`) | XML zawiera `cellIs`, `greaterThan`, próg | sheet1.xml | FT-4 |
| X2-S06 | **Demaskacja fasady** — bgColor komórki obecny w styles.xml | Export-fidelity-vitest | jw. (`FT-4/6`) | `xl/styles.xml` zawiera `FFDC2626`+`FFFFFFFF` (SheetJS by to zgubił) | `xl/styles.xml` (JSZip) | FT-4 |
| X2-S07 | Format waluty → `numFmt` w styles.xml | Export-fidelity-vitest | rozszerzyć test: kolumna `type:'currency'` → parsuj `styles.xml`/`sheet1.xml` | obecny `numFmt` z maską waluty (np. `#,##0.00`/`$`/`zł`) | styles.xml | FT-4 |
| X2-S08 | Format daty → `numFmt`/builtin date | Export-fidelity-vitest | jw.; kolumna `type:'date'` | obecny date numFmt (builtin id lub maska `yyyy-mm-dd`) | styles.xml/sheet1.xml | FT-4 |
| X2-S09 | Nagłówek styl (bold/fill/freeze) | Export-fidelity-vitest | jw.; header row z `bold` + freeze panes | `sheet1.xml` zawiera `<pane>`/freeze + bold w styles | sheet1.xml | FT-4 |
| X2-S10 | Bez CF → `.xlsx` builduje się, PK magic | Export-fidelity-vitest | jw. (`FT-8/7`) | `buf` Buffer, `>1000` bajtów, `0x50 0x4B` (PK) | Buffer | FT-8 |
| X2-S11 | (opcja) P23 ext regresja | Integration | `npx vitest run tests/integration/services/workbook.p23ext.test.ts` | istniejące asercje zielone (brak regresji WorkbookBuilder) | wynik vitest | FT-8 |
| X2-M01 | Manual: export z kolorami | Manual-Excel | UI: tabela → Export XLSX → otwórz w Excel | kolory komórek widoczne w Excel/Numbers | screenshot Excel | FT-7 |
| X2-M02 | Manual: CF data-bar w Excel | Manual-Excel | jw., kolumna z data-bar | paski danych renderują się w Excel | screenshot Excel | FT-7 |
| X2-M03 | Manual: format waluty | Manual-Excel | jw. | komórki pokazują symbol waluty + separatory | screenshot Excel | FT-7 |
| X2-M04 | Manual: format daty | Manual-Excel | jw. | daty jako daty (sortowalne), nie tekst | screenshot Excel | FT-7 |
| X2-M05 | Manual: nagłówek styl | Manual-Excel | jw. | nagłówek pogrubiony/wypełniony, freeze działa | screenshot Excel | FT-7 |
| X2-M06 | Manual: „Otwórz w Excel" (computer-use) | Manual-Excel | `mcp__computer-use__open_application` Excel → otwórz wyeksportowany plik → `screenshot` | plik otwiera się bez „repair", CF/kolory/formaty widoczne | screenshot pulpitu (computer-use) | FT-7 |

---

## X3 — Wykresy (chart.js w doc + Recharts na ekranie)

**Cel:** wykres widoczny na ekranie (Recharts) jest też RASTRYZOWANY do DOCX/PDF
(chart.js → PNG), w 6 typach, w dobrej jakości.
**FT:** FT-1 (renderuje 6 typów), FT-4 (DOCX/PDF zawiera obraz wykresu), FT-7 (manual).

| ID | Tytuł | Typ | Jak uruchomić | Kryterium zaliczenia | Artefakt dowodowy | FT |
|---|---|---|---|---|---|---|
| X3-S01 | 6 typów → niepusty PNG buffer | Export-fidelity-vitest | `npx vitest run tests/unit/deliverables/documentChartRasterizer.test.ts` (`FT-1`) | każdy z `bar/line/pie/donut/scatter/area` → Buffer `len>0` | Buffer PNG | FT-1 |
| X3-S02 | `donut → doughnut` (chart.js naming) | Export-fidelity-vitest | jw. (`FT-1/7`) | config `type==='doughnut'` | mock-call config | FT-1 |
| X3-S03 | `area → line` z `fill:'origin'` | Export-fidelity-vitest | jw. (`FT-1/8`) | `type==='line'`, `datasets[0].fill==='origin'` | mock-call config | FT-1 |
| X3-S04 | width/height honorowane | Export-fidelity-vitest | jw. (`FT-1/9`) | render z custom rozmiarem, `renderToBuffer` zawołany | mock-call | FT-1 |
| X3-S05 | malformed/empty series → `null` (no throw) | Export-fidelity-vitest | jw. (`FT-8`) | zwraca `null`, brak wyjątku | typed-result | FT-8 |
| X3-S06 | **DOCX zawiera obraz wykresu** (nie sam tekst) | Export-fidelity-vitest | nowy `tests/unit/deliverables/docxChartEmbed.test.ts`: zbuduj DOCX z chart-blockiem → `JSZip` → `word/media/*.png` istnieje + `document.xml`/rels referuje obraz | `word/media/` zawiera ≥1 PNG; rels link obecny | DOCX (ZIP) media + rels | FT-4 |
| X3-S07 | **PDF zawiera obraz wykresu** | Export-fidelity-vitest | rozszerzyć X1-S07: HTML doc z wykresem → PDF → scan `/XObject`+`/Image` | PDF zawiera embedded image stream | parsowany PDF | FT-4 |
| X3-S08 | (poza CI) QA findings rasteryzera | Integration | `npx vitest run server/src/services/documentStudio/__tests__/documentChartRenderQa.test.ts` ⚠️ **poza CI scope** (`src/**/__tests__` nie w CI — per memory) | findings zielone; uruchamiane ręcznie | wynik vitest | FT-4 |
| X3-M01 | Manual: wykres w doc na ekranie (Recharts) | manual | UI: doc z wykresem | wykres interaktywny, osie/legenda OK | screenshot ekranu | FT-7 |
| X3-M02 | Manual: wykres w DOCX | manual | doc → Export DOCX → otwórz w Word | wykres jako obraz, czytelny | DOCX + screenshot Word | FT-7 |
| X3-M03 | Manual: wykres w PDF | manual | doc → Export PDF | wykres jako rastr, ostry | PDF | FT-7 |
| X3-M04 | Manual: 6 typów end-to-end | manual | doc z każdym typem → DOCX+PDF | wszystkie 6 renderują się poprawnie | PDF/DOCX | FT-7 |
| X3-M05 | Manual: jakość (DPI/antialiasing) | manual | przybliż wykres w PDF | brak pikselozy przy zoomie, etykiety czytelne | PDF zoom screenshot | FT-7 |

---

## X4 — Stock image fallback + smart-ikony

**Cel:** gdy AI-obraz niedostępny, slajd/doc dostaje sensowny stock-image; ikony
dobierane automatycznie; brak klucza providera = graceful (placeholder, nie crash).
**FT:** FT-1 (obraz/ikona działa), FT-2 (fallback deterministyczny), FT-7 (czeka na decyzję **Q5 — provider**).

⚠️ **Zależność:** wybór providera obrazów = **Q5 (otwarte)**. Do czasu decyzji testujemy
ścieżkę fallback + brak-klucza (deterministyczne), a provider AI = SKIP.

| ID | Tytuł | Typ | Jak uruchomić | Kryterium zaliczenia | Artefakt dowodowy | FT |
|---|---|---|---|---|---|---|
| X4-S01 | Brak klucza providera → graceful placeholder (no throw) | Export-fidelity-vitest | nowy `tests/unit/deliverables/imageFallback.test.ts`; mock provider rzuca/brak-klucza → assert zwraca placeholder/stock URL, nie wyjątek | zwraca fallback asset; brak rzuconego błędu | typed-result | FT-1/FT-8 |
| X4-S02 | Smart-ikona — auto-dobór po słowie kluczowym | Export-fidelity-vitest | jw.; input „budżet/wzrost/ryzyko" → assert mapowanie na ikonę | deterministyczne mapowanie keyword→ikona | wynik vitest | FT-1 |
| X4-S03 | Fallback stock gdy AI-obraz `null` | Export-fidelity-vitest | jw.; AI image returns `null` → stock fallback wybrany | niepusty asset ref po fallbacku | wynik vitest | FT-2 |
| X4-S04 | (po Q5) AI-obraz happy path | Export-fidelity-vitest | po decyzji Q5 + kluczu — real/mock provider zwraca obraz | obraz osadzony w deliverable | parsowany plik (img) | FT-1 |
| X4-M01 | Manual: obraz AI | manual (po Q5) | UI: generuj slajd z obrazem | obraz trafny do treści | screenshot | FT-7 |
| X4-M02 | Manual: fallback stock | manual | symuluj brak AI → stock | stock sensowny, nie „broken image" | screenshot | FT-7 |
| X4-M03 | Manual: ikona auto | manual | slajd z bulletami | ikony dobrane do treści | screenshot | FT-7 |
| X4-M04 | Manual: brak klucza = graceful | manual | env bez klucza → generuj | placeholder + komunikat, brak białego ekranu | screenshot | FT-7 |
| X4-M05 | Manual: jakość obrazu | manual | przybliż obraz | rozdzielczość OK, brak rozmycia | screenshot | FT-7 |

---

## X5 — doc/sheet → jedna encja (brak duplikatu, round-trip)

**Cel:** doc/sheet z czatu i edycja w Studio/Canvas to TEN SAM rekord — zero
duplikatów na liście, spójność po reloadzie, org-scope.
**FT:** FT-1 (jedna encja działa), FT-2 (round-trip, brak duplikatu), FT-8 (org-scope izolacja).
**Wiązanie:** `unifiedDocEntityService` — `work_canvas_drafts.artifact_id ↔ wave5_artifacts`.

| ID | Tytuł | Typ | Jak uruchomić | Kryterium zaliczenia | Artefakt dowodowy | FT |
|---|---|---|---|---|---|---|
| X5-S01 | `getUnifiedDoc` po `draftId` zwraca tę samą encję co po `artifactId` | Integration | nowy `tests/integration/deliverables/unifiedDocRoundTrip.test.ts`; seed draft z `artifact_id`; `getUnifiedDoc(org,{draftId})` i `{artifactId}` | obie ścieżki → ta sama `id`/treść (jedna encja) | wynik vitest (DbPromise mock-DB) | FT-1/FT-2 |
| X5-S02 | `commitDraftToArtifact` — draft bez artifact → tworzy 1 artifact (isNew=true) | Integration | jw.; draft bez `artifact_id` → commit → assert `result.isNewArtifact===true`, `version===1` | dokładnie 1 nowy `wave5_artifacts`, brak duplikatu draftu | wynik vitest | FT-2 |
| X5-S03 | `commitDraftToArtifact` ponowny — re-commit istniejącego → bump wersji, NIE nowy rekord | Integration | jw.; draft z `artifact_id` → commit → `isNewArtifact===false`, `version` rośnie | brak drugiego artifactu (zero duplikatu) | wynik vitest | FT-2 |
| X5-S04 | `listDraftsForArtifact` — round-trip: 1 artifact ↔ jego drafty | Integration | jw. | lista draftów spójna z `artifact_id` | wynik vitest | FT-2 |
| X5-S05 | Org-scope — inny `organizationId` NIE widzi cudzej encji | Integration | jw.; `getUnifiedDoc(otherOrg, {artifactId})` | zwraca `null` (izolacja) | wynik vitest | FT-8 |
| X5-S06 | sheet analogicznie do doc (ta sama encja, brak dup) | Integration | jw. dla typu sheet | sheet round-trip jak doc | wynik vitest | FT-2 |
| X5-U01 | UI: lista Outputs — brak duplikatu po commit (doc) | Playwright-UI | nowy `tests/e2e/deliverables/x5-no-duplicate.spec.ts`: `loginAsOwner`, generuj doc z czatu → otwórz `/reports` tab `outputs_documents` → policz wiersze przed/po edycji | liczba wierszy stała; edycja w Studio nie tworzy 2. wpisu | screenshot listy do `docs/qa/screens/deliverables-X-2026-06-22/x5-list-*.png` ⚠️ **brak per-wiersz `data-testid`** → licz po tytule | FT-2 |
| X5-M01 | Manual: doc z czatu → edytuj w Studio = ten sam | manual | czat→doc→Studio edit→wróć | zmiany widoczne w obu, jeden rekord | screenshot | FT-7 |
| X5-M02 | Manual: edycja w Canvasie widoczna w Studio | manual | edytuj w canvasie → otwórz Studio | spójna treść | screenshot | FT-7 |
| X5-M03 | Manual: brak duplikatu na liście | manual | `/reports` lista | 1 wpis na deliverable | screenshot | FT-7 |
| X5-M04 | Manual: sheet analogicznie | manual | jw. dla sheet | brak dup, spójność | screenshot | FT-7 |
| X5-M05 | Manual: reload | manual | F5 po edycji | treść zachowana, brak rozjazdu | screenshot | FT-7 |
| X5-M06 | Manual: org-scope | manual | drugie konto/org | nie widzi cudzego | screenshot | FT-7 |

---

## X6 — Outputs transakcyjny rejestr + lineage

**Cel:** każdy artefakt z modułu-źródła trafia do Outputs TRANSAKCYJNIE (atomowo),
z lineage do źródła; po błędzie brak driftu (rollback); org-scope.
**FT:** FT-1 (rejestr działa), FT-2 (źródło⇒Outputs transakcyjnie + lineage), FT-8 (rollback/org-scope).
**Usługa:** `outputsTransactionalRegistry` — `v8_output_artifacts` + `v8_artifact_origin_links`.

| ID | Tytuł | Typ | Jak uruchomić | Kryterium zaliczenia | Artefakt dowodowy | FT |
|---|---|---|---|---|---|---|
| X6-S01 | `registerOutputArtifactTransactional` — nowy artefakt + link atomowo | Integration | nowy `tests/integration/deliverables/outputsRegistryTxn.test.ts`; wywołaj register → assert `isNew===true`, 1 wiersz w `v8_output_artifacts` + 1 w `v8_artifact_origin_links` | oba INSERT-y obecne (BEGIN/COMMIT); brak częściowego zapisu | wynik vitest (mock-DB) | FT-1/FT-2 |
| X6-S02 | Idempotencja — 2× register dla tej samej `(originRuntime,originRecordId)` → 1 artefakt | Integration | jw.; zawołaj 2×; 2. raz `isNew===false`, ten sam `artifactId` | brak duplikatu; fast-path zwraca istniejący | wynik vitest | FT-2 |
| X6-S03 | `getArtifactLineage` — zwraca origin link(i), primary first | Integration | jw.; register → `getArtifactLineage(artifactId,org)` | lineage zawiera `originRuntime`+`originRecordId`, `isPrimaryOrigin` poprawne, sort primary→created | wynik vitest | FT-2 |
| X6-S04 | **Brak driftu po błędzie** — INSERT 2 rzuca → rollback, 0 wierszy | Integration | jw.; zmuś błąd na 2. INSERT (mock `dbRun` reject) → assert ROLLBACK, brak osieroconego `v8_output_artifacts` | po błędzie tabele puste (atomowość) | wynik vitest | FT-8 |
| X6-S05 | Org-scope — `getArtifactLineage` innej org → `[]` | Integration | jw.; pytaj z innym `organizationId` | zwraca `[]` (izolacja) | wynik vitest | FT-8 |
| X6-U01 | UI: generacja → w Outputs natychmiast | Playwright-UI | nowy `tests/e2e/deliverables/x6-outputs-appear.spec.ts`: `loginAsOwner`, generuj deliverable → otwórz `/presentations` (`reports-presentations-hub`) tab `outputs_all` → znajdź po tytule | nowy artefakt widoczny bez ręcznego refetchu | screenshot hub do `docs/qa/screens/deliverables-X-2026-06-22/x6-hub-*.png` ⚠️ selekcja po tytule (brak per-wiersz testid) | FT-1/FT-2 |
| X6-M01 | Manual: generacja → w Outputs natychmiast | manual | generuj → `/presentations` | pojawia się od razu | screenshot | FT-7 |
| X6-M02 | Manual: lineage do źródła | manual | otwórz output → „pochodzenie" | link prowadzi do rekordu źródłowego | screenshot | FT-7 |
| X6-M03 | Manual: brak driftu po błędzie | manual | symuluj błąd generacji | brak „połówkowego" wpisu w Outputs | screenshot | FT-7 |
| X6-M04 | Manual: org-scope | manual | drugie konto/org | nie widzi cudzych Outputs | screenshot | FT-7 |

---

## Wykonalność dziś (uczciwie)

### ✅ Testowalne OD RAZU (zero deploya, lokalny vitest)
Wszystkie **Export-fidelity-vitest** i **Integration** — bo mockują `playwright`/LLM/
provider i parsują wygenerowany plik lub jadą na mock-DB (`DbPromise`):

- **X1:** S01, S02, S03, S04, S05, S06 (PNG/PDF magic, viewport, fail-open). Komenda:
  `npx vitest run tests/unit/deliverables/playwrightHtmlToPng.test.ts`
  (+ nowy `playwrightHtmlToPdf.test.ts`).
- **X2:** S01–S06, S10, S11 są **już zielone** (`tests/unit/deliverables/workbookBuilderCf.test.ts`);
  S07–S09 (waluta/data/nagłówek numFmt) = drobne dopisanie do tego samego pliku.
  `npx vitest run tests/unit/deliverables/workbookBuilderCf.test.ts`
- **X3:** S01–S05 są **już zielone** (`documentChartRasterizer.test.ts`); S06 (DOCX media
  embed) i S07 (PDF /XObject) = nowe pliki, ale czysto plikowo-parsujące → dziś.
- **X5:** S01–S06 round-trip na mock-DB — dziś (usługa istnieje, parametry znane).
- **X6:** S01–S05 round-trip + rollback na mock-DB — dziś (usługa istnieje;
  rollback testujemy mockiem `dbRun` reject na 2. INSERT).

> Jeden run wszystkiego, co istnieje teraz:
> `npx vitest run tests/unit/deliverables/ tests/integration/deliverables/ tests/integration/services/workbook.p23ext.test.ts`

### ⚠️ Wymaga REAL chromium (lokalnie OK, w CI niedeterministyczne)
- **X1-S07** (real PDF → `/XObject`/`/Image`) i **X3-S07/S08** — wymagają zainstalowanej
  binarki chromium. Lokalnie tak; w CI trzymać jako oddzielny, opt-in run
  (renderer i tak fail-open’uje na `unavailable`). Plik kładziemy w `tests/` (NIE
  `src/**/__tests__`, bo CI pomija — per memory `finding_ci_skips_src_tests`).
- **X3-S08** (`documentChartRenderQa.test.ts`) leży pod `server/src/services/.../__tests__/`
  = **poza CI scope** dziś; uruchamiać ręcznie.

### ⚠️ Wymaga deploya/uruchomionej aplikacji (Playwright-UI, login)
- **X1-S08** (pixel-diff), **X5-U01** (brak dup na liście), **X6-U01** (output natychmiast)
  — potrzebują działającego FE+API (`E2E_BASE_URL`/`E2E_API_URL`) i kredencjali
  (`E2E_OWNER_EMAIL/PASSWORD`). Selektory listy/tabów dziś po tytule/`id`, bo
  **brak per-tab i per-wiersz `data-testid`** w `ReportsAndPresentationsHub.tsx` —
  rekomendacja: dodać `data-testid="outputs-tab-<id>"` i `data-testid="output-row-<id>"`
  (osobne zadanie kodowe, poza tym planem).

### 🚧 Zablokowane decyzją / progiem / providerem
- **X1-S08 / FT-5 pixel-diff:** próg akceptacji = **Q2 (otwarte)**. Do czasu decyzji
  zapinamy mechanikę (pixelmatch + zapis diff PNG) z progiem placeholder i raportujemy
  liczbę, ale PASS/FAIL czeka na Q2.
- **X4 (cała seria) — stock image / AI provider = Q5 (otwarte):** dziś testowalne tylko
  ścieżki **fallback** + **brak-klucza = graceful** (X4-S01–S03 deterministycznie).
  X4-S04 i wszystkie X4-M (AI-obraz happy path) = **SKIP do decyzji Q5 + klucza**.
- Spójne z `finding_deliverables_ft6_pilot_blocker`: „mózg premium" mierzymy dopiero
  po ważnym kluczu LLM — tu jednak FT-4/FT-2 są deterministyczne i NIE wymagają klucza.

### 🖥️ Computer-use / półautomat (manualnie)
- **X2-M06 „Otwórz w Excel"** + wszystkie pozostałe **-Mxx** (otwarcie realnych
  PDF/DOCX/XLSX i ocena wizualna) = człowiek lub `mcp__computer-use__*`
  (`open_application` + `screenshot`). To jedyna ścieżka, która naprawdę dowodzi
  „Excel nie pokazuje 'repair' i CF się renderuje".
