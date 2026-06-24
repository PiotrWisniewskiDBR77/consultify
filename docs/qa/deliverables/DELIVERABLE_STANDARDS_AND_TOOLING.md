# Standardy budowy deliverable + zbiór narzędzi kompletności (deck / doc / sheet)

> **Po co:** teoria + anatomia + słownik funkcji liderów (PowerPoint / Word / Excel) + parametry graficzne dla 3 formatów, ORAZ **jeden skonsolidowany zbiór narzędzi/technik**, które czynią dokument merytorycznie i graficznie kompletnym. To baza pod NASTĘPNY krok: macierz „czy to mamy MY · czy mają LIDERZY" (gap analysis). Research 2026-06-23, cytowany (źródła na końcu sekcji per-format w historii sesji; kluczowe linki niżej).

---

# CZĘŚĆ A — Standardy per format (teoria · anatomia · funkcje lidera · liczby)

## A1. PREZENTACJA (vs PowerPoint)

**Teoria/założenia:** Assertion–Evidence (1 zdanie-teza + 1 wizual/slajd) · Minto Pyramid (answer-first, top-down) · SCQA (Situation→Complication→Question→Answer) · MECE · **action titles / horizontal logic** (czytając same tytuły = cała historia) · Duarte signal-to-noise „glance media" · Reynolds simplicity/white-space · Gestalt (proximity/similarity/alignment/closure) · Rule of Thirds · 6×6 / 10-20-30 Kawasaki.

**Anatomia — archetypy układów:** title · agenda/TOC · section divider · one-content · two-content/comparison · big-number/KPI · dashboard (4-6 kafli) · chart-dominant · timeline/roadmap · process flow · matrix/2×2 · quote · image-full · closing/CTA.
**Prymitywy treści:** headline/action-title · bullets · KPI/stat callout · chart · table · diagram/SmartArt · image · icon · shape/connector · pull-quote · footnote/source · logo · page number · breadcrumb.

**Słownik PowerPoint (co znaczy „kompletny" PPTX):** Slide Master + Layouts · Themes (kolory/fonty/efekty) · placeholders · SmartArt · natywne wykresy (bar/line/pie/combo/waterfall/funnel/radar/treemap/sunburst…) · tables · shapes+connectors · biblioteka ikon · narzędzia obrazu (crop/remove-bg/styles) · **Designer (AI layout)** · **Copilot** (gen) · transitions/animations/**Morph** · speaker notes · sections · align/distribute/guides · Accessibility Checker · export PPTX/PDF.

**Liczby:** 16:9 = 13.333×7.5 in ≈ 1920×1080 · body ≥24pt (Kawasaki ≥30pt), dividery 44-64pt · ≤2-3 fonty · ≤3 kolory dominujące / 60-30-10 · kontrast ≥4.5:1 (≥3:1 large) · ≤6 bulletów/≤6 słów · wykres ≤6 serii / pie ≤5 · ≥8 distinct layoutów / max 2 z rzędu identyczne · siatka 12-kol + marginesy/white-space.

## A2. RAPORT (vs Word)

**Teoria/założenia:** Minto Pyramid (answer-first) · SCQA opener · exec-summary-first · hierarchia typograficzna (H1>H2>H3>body) · skala modularna (Bringhurst „don't compose without a scale", 1.25) · measure 45-90ch (50-75 ideal, Butterick) · leading 120-145% · one-idea-per-paragraph + topic sentences · signposting · nagłówki = struktura logiczna.

**Anatomia:** cover/title page · TOC · executive summary · headings H1-H4 · body paragraphs · bullet/numbered lists · tables · charts/figures + captions · callout/admonition boxes · pull-quotes · KPI/stat strips · sidebars · footnotes/endnotes · citations/references/bibliography · appendix · headers/footers/page numbers · cross-references.

**Słownik Word (co znaczy „kompletny" DOCX):** Styles + Style sets · Themes · **automatyczny TOC** · Heading levels · Sections + columns · headers/footers/page numbers · Tables (styles/formulas) · **Captions + cross-references** · **Citations/Bibliography (APA/MLA/Chicago) + footnotes/endnotes** · Index/Table of Authorities · SmartArt + charts · Track Changes + comments · templates · Accessibility Checker · Copilot · export DOCX/tagged-PDF.

**Liczby:** A4 210×297mm / Letter 8.5×11 · marginesy 1in/2.54cm (binding 1.25-1.5) · body 10-12pt · leading 1.15-1.5 · measure 45-90ch · skala 1.25 / klasyczna 6…24 · headingi 14-16pt bold stepped · ≤2 fonty (serif body + sans head) · indent 1-4× pt LUB odstęp 4-10pt (nie oba) · widow/orphan control · accent-color tylko na emfazę/linki.

## A3. TABELA/EXCEL (vs Excel + Airtable)

**Teoria/założenia:** Tufte (data-ink maximization, chartjunk removal, graphical integrity) · Few (liczby right-align / tekst left-align, decimal consistency, preattentive emphasis, color=meaning, colorblind-safe, NIE red+green jako jedyne kodowanie) · **IBCS SUCCESS** (ISO 24896) + semantic notation (to co znaczy to samo wygląda tak samo) + stała kolejność kolumn · konwencja kolorów modelu finansowego (blue=input, black=formuła, green=cross-sheet, red=external/negative) · cap ~6-8 kolorów.

**Anatomia:** kolumny typowane (text/number/currency/percent/date/single-select/boolean/rating/formula/link) · header row (kontrast, frozen, sort/filter) · totals/summary row · reguły CF (data-bars/color-scales/icon-sets/cell-is/traffic-light) · charts · sparklines · PivotTable · named ranges · data validation/dropdowns · freeze panes · Table + structured refs · slicers · comments.

**Słownik Excel (co znaczy „kompletny" XLSX):** number formats (numFmt 4-sekcyjny) · **Conditional Formatting (data bars/color scales/icon sets/formula)** · **Data Validation** · 450+ funkcji (XLOOKUP, dynamic arrays FILTER/SORT/UNIQUE) · **Tables + structured refs** · **PivotTables/PivotCharts** · Charts + **Sparklines** · named ranges · Freeze Panes · Filters/Sort · **Slicers** · **Power Query / Power Pivot (DAX)** · cell styles & themes · Accessibility Checker · Copilot · export XLSX/CSV/PDF.

**Liczby:** numFmt `positive;negative;zero;text` · percent `0.00%` · `#,##0.00` · ISO `yyyy-mm-dd` · currency `$#,##0.00` / `#,##0.00" zł"` · negatives `[Red]` · color-scale 3-kolor R→Y→G · icon-sets 3/4/5 · cap ≤6-8 kolorów · numbers right-align · sans 10-11pt · header bold/shaded+frozen · gridlines minimalne · zebra tylko gdy gęsto · wykresy ≤6 serii, no 3-D/chartjunk · traffic-light hex (red `#C00000` / amber `#FFC000` / green `#00B050`).

---

# CZĘŚĆ B — ZBIÓR NARZĘDZI KOMPLETNOŚCI (jeden zbiór, gotowy pod macierz)

> Każda pozycja = `[ ]` (do oznaczenia w następnym kroku: **MY** ✓/✗/🟡 · **LIDER** ✓/✗). Podzielone na MERYTORYCZNE i GRAFICZNE per format.

## B1. PREZENTACJA — toolset
**Merytorycznie:** `[ ]` spina pyramid/SCQA (answer-first) · `[ ]` action-title „so-what" na każdym slajdzie · `[ ]` read-through samych tytułów = historia · `[ ]` MECE · `[ ]` assertion-evidence (teza+wizual) · `[ ]` agenda/sekcje/dividery · `[ ]` exec-summary z przodu · `[ ]` dane zweryfikowane vs źródło · `[ ]` wykresy z realnych danych (nie placeholder) · `[ ]` source/citation na slajdach danych · `[ ]` footnotes/assumptions · `[ ]` 1 message/slajd · `[ ]` rekomendacje/next-steps/CTA · `[ ]` appendix poza głównym flow · `[ ]` altitude pod audytorium.
**Graficznie:** `[ ]` master + ≥8 layoutów · `[ ]` theme ≤3 kolory 60-30-10 · `[ ]` system typo ≤2-3 fonty + skala · `[ ]` min font ≥24pt · `[ ]` kontrast ≥4.5:1 · `[ ]` 16:9 1920×1080 · `[ ]` siatka 12-kol + white-space · `[ ]` align/distribute/guides · `[ ]` Gestalt grouping · `[ ]` rule-of-thirds dla hero · `[ ]` natywne wykresy dobrane do danych ≤6 serii · `[ ]` styled tables (nie obraz) · `[ ]` SmartArt/diagramy · `[ ]` obrazy hi-res full-bleed · `[ ]` spójny icon-set · `[ ]` shapes/connectors · `[ ]` brand kit (logo/kolory/page#) · `[ ]` różnorodność layoutów (max 2 z rzędu) · `[ ]` transitions/Morph z umiarem · `[ ]` speaker notes · `[ ]` a11y (alt-text/reading-order) · `[ ]` eksport PPTX+PDF z fontami.

## B2. RAPORT — toolset
**Merytorycznie:** `[ ]` answer-first (Minto) · `[ ]` SCQA opener · `[ ]` standalone exec-summary · `[ ]` MECE sekcje + hierarchia · `[ ]` topic sentence/akapit · `[ ]` one-idea-per-paragraph · `[ ]` signposting/transitions · `[ ]` claims data-grounded · `[ ]` citations/sources · `[ ]` references/bibliography (styl) · `[ ]` footnotes/endnotes · `[ ]` rekomendacje z owner+termin · `[ ]` appendix (metodyka/dane) · `[ ]` glossary.
**Graficznie:** `[ ]` system styli/headingów · `[ ]` theme (paleta+fonty) · `[ ]` auto-TOC z page# · `[ ]` skala typo modularna · `[ ]` body 10-12pt / leading 1.15-1.5 / measure 45-90ch · `[ ]` ≤2 fonty (serif body+sans head) · `[ ]` marginesy 1in + stały rozmiar strony · `[ ]` cover/title page · `[ ]` headers/footers/page# · `[ ]` styled tables · `[ ]` charts/figures + captions · `[ ]` callout/admonition · `[ ]` pull-quotes/KPI strips · `[ ]` cross-references live · `[ ]` widow/orphan + clean breaks · `[ ]` spójny odstęp/indent · `[ ]` brand assets · `[ ]` a11y (tagged/heading-order/alt/PDF-UA) · `[ ]` eksport DOCX + tagged-PDF · `[ ]` track-changes wyczyszczone.

## B3. TABELA/EXCEL — toolset
**Merytorycznie:** `[ ]` typowany schemat z intentu (text/number/currency/percent/date/select/boolean/rating/formula/link) · `[ ]` realne kompletne seed-data (zero pustych) · `[ ]` typy egzekwowane end-to-end (nie all-strings) · `[ ]` kolumny computed/formula (structured refs) · `[ ]` aggregaty/totals row · `[ ]` lookup/relation columns · `[ ]` data validation + dropdowns · `[ ]` domeny single-select · `[ ]` multi-sheet + cross-sheet refs · `[ ]` named ranges/Table · `[ ]` Pivot lub pivot-ready · `[ ]` Power-Query-style refresh dla external · `[ ]` stała kolejność kolumn (IBCS).
**Graficznie:** `[ ]` numFmt per typ (`0.00%`/`#,##0.00`/`yyyy-mm-dd`/currency) · `[ ]` formaty negatywów · `[ ]` CF data-bars · `[ ]` CF color-scales · `[ ]` CF icon-sets · `[ ]` CF threshold/cell-is/formula · `[ ]` kolorowe chipy select (kolor=znaczenie) · `[ ]` right-align liczb / aligned decimals · `[ ]` styled+frozen header · `[ ]` freeze panes · `[ ]` zebra (gęste) · `[ ]` minimalne gridlines (data-ink) · `[ ]` ≤6-8 kolorów colorblind-safe · `[ ]` sans 10-11pt · `[ ]` sparklines per-row · `[ ]` charts ≤6 serii no-3D · `[ ]` filters/sort · `[ ]` slicers · `[ ]` widoki grid/kanban/calendar · `[ ]` a11y · `[ ]` eksport .xlsx ze stylami+CF (round-trip) · `[ ]` eksport CSV/PDF.

---

## NASTĘPNY KROK
Wypełnić macierz dla każdej pozycji B1-B3: **MY** (✓ mamy / 🟡 częściowo / ✗ brak — z file:line) · **LIDER** (✓ PPT/Word/Excel/Gamma/Airtable/Kimi) → wynik: gdzie mamy przewagę, parytet, lukę. To zamienia ten katalog w plan domknięcia „graficznie+merytorycznie kompletny vs najlepsi".

## Kluczowe źródła
Prezentacje: Penn State Assertion-Evidence · Minto/Deckary · Garr Reynolds/Presentation Zen · NN/g Gestalt · Microsoft (Slide Master/SmartArt/Morph/Designer) · WCAG 1.4.3. · Raporty: Minto/ModelThinkers · Butterick Practical Typography · Bringhurst · UMich Word guide · PDF/UA. · Tabele: Tufte · Stephen Few (Show Me the Numbers / Information Dashboard Design) · IBCS (ISO 24896) · Microsoft (CF/numFmt/XLOOKUP/Pivot/Power Query) · konwencje modelu finansowego.
