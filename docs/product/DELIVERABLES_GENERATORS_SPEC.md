# Generatory Deliverable (M17–M20) — Specyfikacja produktu + poziomu technologii (SSOT)

> **Status:** zaakceptowany kierunek (Piotr, 2026-06-21) · **Zakres:** M17 Outputs · M18 Dokumenty · M19 Prezentacje · M20 Tabele
> **Cel nadrzędny:** dorównać i wygrać z Gamma (deck), Kimi/Claude (doc), Airtable + Claude-Excel (tabela). **Budujemy sami** (D2) — zabieramy im klientów biznesowych, nie płacimy third-party.
> **Powiązane:** [[finding_deliverables_connection_model]] · `M17-outputs.md` · `M18-dokumenty.md` · `M19-prezentacje.md` · `M20-tabele-studio.md`

---

## 1. Zasada produktu

**Jedno wejście, trzy wyjścia.** Narzędzie do **prezentowania zebranych informacji**; gdy ich brak — Teresa je opracowuje w rozmowie. **Mniej znaczy więcej** — koniec z wielopoziomowym edytorem i lasem przycisków wyboru.

### Trzy ścieżki wejścia → jeden silnik
```
ŹRÓDŁA (inicjatywy/notatnik/ideas/canvas) ──[istniejący "zrób z tego"]──┐
ROZMOWA Z TERESĄ ("zrób raport/prezentację/tabelę na temat") ──────────┤──► SILNIK TERESY ──► EDYTOR (per typ) ──► M17 OUTPUTS
PRZYCISK "NOWY" (w Outputs) ──[uruchamia Teresę]───────────────────────┘     (jeden, wspólny)    doc/deck/tabela    (jedna biblioteka)
```
Wszystkie 3 ścieżki zbiegają się w jednym silniku; różnią się tylko kontekstem startowym.

### Wspólne wejście (identyczne dla 3 typów)
1. **Typ** — 3 kafle: Raport · Prezentacja · Tabela (świadomy wybór; wyjście jest różne).
2. **Template** — galeria `Blank` + kuratorowane DBR77; **user wybiera ALBO Teresa proponuje** (oba). Template = szkielet sekcji + preset formatu.
3. **Teresa** dostaje `(paczka źródła / intencja) + typ + template` → generuje draft.

### Magazyn
**M17 Outputs = jedna biblioteka** wszystkich 3 typów; każdy deliverable **podlinkowany do źródła** (lineage). M17 to **indeks + governance** nad tabelami źródłowymi (`work_canvas_drafts` / `presentation_decks` / `document_studio_artifacts`), nie magazyn treści.

### Czym się różnimy od Gamma/Kimi/Airtable
(a) jedno wspólne wejście dla 3 formatów · (b) **template'y typów wg doktryny DBR77** (user też tworzy własne) · (c) **zasilanie z realnej pracy org**, nie z pustego promptu. Formuła, której nie ma na rynku.

---

## 2. Poziom technologii — stack 4-warstwowy

Definicja „poziomu technologii, która generuje efekt wyjściowy" jako 4 warstwy. **Decyzje zablokowane:** D1 = premium tier AI (klasa Opus) dla kroku generatywno-projektowego; D2 = budujemy sami.

| Warstwa | Dziś | Docelowo |
|---|---|---|
| **L1 · Mózg (AI generacja)** | Deterministyczne szablony + cienki LLM, tier `standard` | **LLM premium jako generatywny projektant** — zwraca bogaty, ustrukturyzowany spec (layout+motyw+briefy obrazów dla decka; pełna struktura bloków dla doca; typowany schemat pól + kolory dla tabeli), nie markdown |
| **L2 · Render (ekran)** | Deck mocny; Doc = read-only viewer (JSON na ekranie); Tabela = CF martwy | Jeden bogaty render per typ: Doc → **TipTap** edytor + `recharts`; Tabela → CF wpięty w GridView + jeden silnik formuł |
| **L3 · Export (plik)** | 3–4 osobne ścieżki, degradacja do tekstu/CSV | **Parytet: jeden render → wierny plik.** PDF/PNG → **Puppeteer** (HTML→PDF, w deps); PPTX → pptxgenjs (zostaje); DOCX → `docx` + dopieszczenie; XLSX → **exceljs `WorkbookBuilder`** (w repo) + conditional formatting |
| **L4 · Assety** | Obrazy AI bez fallbacku; wykresy ekran=CSS, doc=martwe | Obrazy AI (OpenAI/Replicate) **+ fallback stockowy (Unsplash/Pexels)** + smart-ikony (lucide/Iconify); wykresy: `recharts` (ekran) + pptxgenjs (deck) + `chartjs-node-canvas` (doc — doinstalować) |

**Jednozdaniowo:** podnosimy mózg (premium AI = projektant, nie wypełniacz), ujednolicamy render→export (parytet), ożywiamy assety (wykresy/obrazy/styled-xlsx, dziś martwe/wyrzucane).

---

## 3. Specyfika per typ (produkt + technologia + dystans)

### 🎨 Prezentacja (deck) — benchmark GAMMA *(priorytet)*
- **Produkt:** deck z dobranymi kolorami, kształtami, grafiką, układem per slajd. ~17 typów slajdu (cover, exec summary, KPI strip, roadmap, RAID, impact/effort matrix, before/after, maturity scorecard…).
- **Kluczowa nowa technologia — „AI Layout Director":** premium LLM wybiera **wariant układu** (nie 1:1 z intentu), dobiera motyw, pisze brief obrazu. Kod sam to zapowiada („v2 can swap planner to LLM", `presentationVisualDirectorService.ts`).
- **Dodatki:** warianty układu per slajd („spróbuj inny layout"/remix — rdzeń Gammy) · stock-fallback obrazów · `recharts` na ekranie (dziś ręczne CSS-słupki w `ChartBlock.tsx`) · Puppeteer dla wiernego PDF/PNG.
- **Zostaje mocne:** render FE 16:9 (`CardRenderer.tsx`), 14 palet + Brand Kit, export PPTX (`PptxPipelineService.ts`).
- **Fasady do usunięcia:** motywy `corporate/minimal/modern` (etykiety bez różnicy); placeholdery „Evidence gap…"; PDF/PNG tekstowy.

### 📄 Raport (doc) — benchmark KIMI / CLAUDE
- **Produkt:** bogaty dokument (nagłówki, listy, tabele, callouty, cytaty, KPI, wykresy, obrazy). Typy: raport, memo, charter, audyt, propozycja, brief.
- **Kluczowa technologia:** **TipTap** jako prawdziwy edytor blokowy (już w repo — Canvas/Notebook) zamiast read-only viewera (`DocumentStudioDocumentPanel.renderSectionPreview`) → edycja in-place + inline-AI „zaznacz→popraw". AI **generuje pełną strukturę bloków**, nie tylko dopisuje prozę.
- **Dodatki:** ożywić wykresy (`npm i chartjs-node-canvas canvas` — `documentChartRasterizer.ts` gotowy) + `recharts` na ekranie · Puppeteer dla wiernego PDF (tabele z ramkami, dziś pipe'y) · DOCX: prawdziwe listy Word + osadzanie obrazów (`ImageRun`).
- **Zostaje mocne:** schemat bloków (12+ typów), export DOCX (`documentDocxRenderer.ts`, lib `docx` v9.5.1, TOC/style/footnotes).
- **Fasady:** wykresy martwe (`chartjs-node-canvas` niezainstalowany); tabele/KPI/image na ekranie → surowy JSON; bez `useLlm` doc = placeholdery.

### 📊 Tabela — benchmark AIRTABLE + CLAUDE-EXCEL
- **Produkt:** typowany arkusz (28 typów pól), widoki (grid/kanban/kalendarz/forma), formuły, **kolory komórek i formaty** jak Claude-Excel.
- **Kluczowa technologia:** AI generuje **typowany schemat + kolory opcji + seed-rows** (nie płaski markdown 10×15) · **przepiąć export na exceljs `WorkbookBuilder`** (już w repo, fills/borders/numFmt) zamiast SheetJS-community, który **wyrzuca style** · **conditional formatting** jako warstwa danych (persyst + GridView + exceljs data-bars/color-scales) · ujednolicić silnik formuł na AST (`formulaEngine.ts`).
- **Zostaje mocne:** BE Table Platform (formuły AST/55 funkcji, 28 typów pól, widoki, automatyzacje).
- **Fasady:** export xlsx (SheetJS community → `.s` style wyrzucane); conditional formatting martwy w GridView (żyje tylko w legacy `IdeaTableTool`); AI sheet = płaski markdown; export w czacie = goły CSV.

---

## 4. Plan budowy (W1–W5) — zadania techniczne

>  Shipujemy **inkrementalnie**: W1–W2 dają widoczną wartość wcześnie; W4 (mózg premium) to skok jakości do poziomu Gamma/Claude. Wszystko **za flagą per-org** (klienci VTS/Apator/Elkomtech OFF do telemetrii) — wzorzec jak M13.

| Fala | Zakres | Kluczowe zadania techniczne | Warstwa |
|---|---|---|---|
| **W1 · Wspólne wejście** | Launcher 3 ścieżek | Przycisk „Nowy" w Outputs → modal · 3 kafle typu · galeria template'ów (statyczna v1) · kontrakt „paczka kontekstu" (typ+template+źródło) → `generateDeliverable` · spiąć istniejące przyciski źródeł + czat + Nowy w jeden silnik | L2/UX |
| **W2 · Odchudzenie edytorów** | „Mniej znaczy więcej" | Doc → TipTap (edytor zamiast viewera) + render tabel/wykresów/KPI (`recharts`) + inline „zaznacz→popraw"; usunąć Mode1/2/3 + 6-poziomowy edytor propozycji · Deck → Gamma-flow (mniej przycisków, AI-driven) · Tabela → CF wpięty w GridView + jeden silnik formuł | L2 |
| **W3 · Template engine** | Wyróżnik DBR77 | Model template (szkielet sekcji + preset formatu) per typ · biblioteka DBR77 (kilka per typ) · user-created templates · Teresa-proponuje z intencji | produkt |
| **W4 · Mózg generatywny (premium)** | **Skok jakości** | Deck → „AI Layout Director" (warianty layoutu + motyw + briefy obrazów) · Doc → AI generuje pełną strukturę bloków · Tabela → AI generuje typowany schemat + kolory + seed-rows · wpięcie premium tier (D1) | L1 |
| **W5 · Parytet + assety + spójność** | Wierność wyjścia | Puppeteer HTML→PDF/PNG (deck+doc parytet) · exceljs `WorkbookBuilder` dla Table Platform xlsx + conditional formatting · `chartjs-node-canvas` (doc) + stock-fallback obrazów (Unsplash/Pexels) + smart-ikony · doc/sheet → model decka (jedna encja, koniec duplikatu) · Outputs niezawodny rejestr (transakcyjny) + lineage | L3/L4 + spójność |
| **Deploy** | Bramka odbioru | Per fala: testy + flaga staging→demo + smoke + →F/→UI (prod centerbeam tylko za osobną zgodą) | — |

---

## 5. Co zostawiamy / co wymieniamy (dla kontynuujących)

**ZOSTAWIAMY (mocne):** render FE decka (`CardRenderer`), pptxgenjs (`PptxPipelineService`), 14 palet + Brand Kit, schemat bloków doc, `docx` renderer, BE Table Platform (formuły AST, widoki, automatyzacje), exceljs `WorkbookBuilder`.

**WYMIENIAMY/DODAJEMY:** deterministyczny planer layoutu decka → premium LLM; read-only doc viewer → TipTap; SheetJS-community → exceljs dla Table Platform; PDFKit/SVG-tekst → Puppeteer; brak obrazów → AI + stock fallback; martwe wykresy → chartjs/recharts; CF martwy → warstwa danych + render + export.

**DOINSTALOWAĆ:** `chartjs-node-canvas` + `canvas` (doc charts). Sprawdzić: `puppeteer`, `recharts`, `exceljs` są w deps (są).

---

## 6. Decyzje zablokowane
- **D1** premium tier AI dla generacji (2026-06-21; optymalizacja kosztu = później).
- **D2** budujemy sami, zero third-party generation API (Gamma/Canva) w produkcji — różnicowanie + dane klienta + koszt.
- Model produktu (sekcja 1) + stack (sekcja 2) zaakceptowane 2026-06-21.
