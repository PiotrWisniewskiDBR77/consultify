# Generatory Deliverable — OCZEKIWANE PARAMETRY GRAFICZNE (spec liczbowa)

> **Rola:** obiektywna, liczbowa podstawa rubryki graficznej (sekcje 2C/3C/4C w [`DELIVERABLES_QUALITY_RUBRIC.md`](DELIVERABLES_QUALITY_RUBRIC.md)). Każdy wymiar „G" rubryki ma tu **mierzalny parametr** — koniec uznaniowości.
> **Zakotwiczenie:** wartości oparte na tym, co DEKLARUJĄ wiodące narzędzia/standardy (Gamma, Beautiful.ai, Canva, PowerPoint/Keynote, Material, IBM Carbon, WCAG, Butterick, Bringhurst, Excel). Tam gdzie źródła się różnią → **NASZA DECYZJA** wytłuszczona.
> **Priorytet:** prezentacja (najwięcej parametrów), ale doc i tabela tak samo wiążące.

---

## 0. Parametry UNIWERSALNE (wszystkie 3 typy)

| Param | Wartość | Źródło / decyzja |
|---|---|---|
| **Siatka odstępów** | **8px baseline** (4/8/16/24/32/40/48/64) + 4px sub-grid na detale | Material 8dp + Apple; Carbon łamie czystą 8 (2/4/12) → my: 8px główna, 4px detale |
| **Skala typografii (ratio)** | **1.333 (kwarta)** dla decku · **1.25 (tercja)** dla doc/UI | type-scale; większy ratio = wyraźniejsza hierarchia (deck), mniejszy = gęsty tekst (doc) |
| **Kontrast tekstu (WCAG AA)** | normal **≥4.5:1** · large (≥18pt/≥14pt bold) **≥3:1** · elementy wykresu/UI **≥3:1** | WCAG 2.1 (1.4.3 + 1.4.11), weryfikowane verbatim, bez zaokrągleń |
| **Reguła kolorów** | **60-30-10** (dominujący/neutralny · drugorzędny · akcent) · **≤3 dominujące** | 60-30-10 (Wix/freeCodeCamp); Canva |
| **Liczba krojów** | **≤2** (tytuł + body), twardy max 3 | whitepage/123print |
| **Paleta kategorialna (wykresy/statusy)** | **≤7 kolorów** (twardy cap 10) | Atlassian/Carbon |
| **Kolor nigdy sam** | znaczenie zawsze + ikona/etykieta (nie tylko barwa) | WCAG |

---

## 1. PREZENTACJA (deck) — parametry *(priorytet)*

### P-CANVAS — wymiar i bezpieczne pole
| Param | Wartość | Mapuje na G |
|---|---|---|
| Format | **16:9** | — |
| **Kanwa wewnętrzna** | **1920 × 1080 px** (HD, podzielne przez 8) | — |
| Eksport DPI-ladder | 96→1280×720 · 150→2000×1125 · 300→4000×2250 | — |
| **Bezpieczne pole treści (action-safe)** | inner **90%** → margines **≥96px** (5%) na bok | G2 balans |
| Title/edge clearance | **5%** od krawędzi (≥64px) | G2 |
> Źródła: PowerPoint 13.333″×7.5″ = 1920×1080 @144; SMPTE safe-area (action 90–93%, title 90%). **DECYZJA: kanwa 1920×1080, margines treści 96px.**

### P-TYPE — typografia (rozgałęziona wg typu decku)
| Rola | **Deck projekcyjny** (na ekranie/sali) | **Deck „read/leave-behind"** (do czytania) | Mapuje |
|---|---|---|---|
| Tytuł slajdu | **40pt** (min 32) | 28pt (min 24) | G4 |
| Nagłówek | **28pt** (min 24) | 20pt (min 18) | G4 |
| Body | **24pt floor** (Kawasaki-safe 30) | **16pt** (min 14) | G4 |
| Caption/źródło | **14pt** (min 12) | 12pt | G4 |
| Ratio | 1.333 | 1.25 | G4 |
> Źródła: Kawasaki ≥30pt; BrightCarbon read-deck 12–16 / keynote 28–48; PSU Assertion-Evidence headline 28 / body 18–24. **DECYZJA: domyślnie deck projekcyjny (body 24pt floor); typ „read" gdy template tak deklaruje.**

### P-COLOR — kolor (G1, G8)
- Struktura palety: **primary · secondary · accent · neutral/tło** (z Brand Kit).
- **60-30-10**; **≤3 dominujące/slajd**; akcent ~10%.
- Kontrast: tekst ≥4.5:1, duży ≥3:1, elementy wykresu ≥3:1.
- **Brand Kit nadrzędny** (jak Gamma Pro: kolory primary/secondary/accent + text/card bg + logo/font) — stosowany na KAŻDYM slajdzie (G8).

### P-DENSITY — gęstość treści (G3 whitespace, M3 zwięzłość)
- **≤6 bulletów/slajd**, **≤12 słów/bullet** (6×6, górny limit; 7×7 max absolutny).
- Preferencja: **jedna myśl/slajd** (Beautiful.ai) lub **headline zdaniowy + wizual** (Assertion-Evidence).
- Treść zajmuje **≤~70% pola** (reszta = oddech).

### P-IMG — obrazy (G6)
- Tła/hero: **≥1920×1080**, screen target **150 DPI**.
- **Zachować proporcje** (zero zniekształceń — twarde), full-bleed `cover` LUB contained do siatki.
- Źródło: AI-gen → **fallback stock (Unsplash/Pexels)** → ikona; **nigdy placeholder** w odbieranym dokumencie.

### P-LAYOUT — różnorodność układów (G5 — rdzeń „jak Gamma")
- **≥8 odrębnych layoutów** w katalogu (cover/2-3-4 kolumny/KPI strip/diagram/before-after/timeline/quote…).
- **Brak >2 identycznych layoutów z rzędu**; AI Layout Director dobiera wariant per slajd (seria B1/B2).
- Auto-utrzymanie wyrównania/odstępów (Beautiful.ai Smart-Slides-like).

### P-CHART — wykresy (G7)
- **Pie ≤5 wycinków** · **line/bar ≤6 serii** (twardy cap 8) · paleta **≤7** z motywu.
- Osie + jednostki + legenda obowiązkowe; wysoki data-ink (zero 3D/chartjunk — Tufte).
- Render: recharts (ekran) / native pptxgenjs (PPTX) — nie CSS-słupek.

---

## 2. RAPORT (doc) — parametry

| Param | Wartość | Źródło / decyzja | Mapuje |
|---|---|---|---|
| **Format strony** | **A4 210×297mm** (595×842pt; 2480×3508px@300) | ISO 216 | — |
| **Marginesy** | **1 in (2.54cm)** wszystkie (Narrow 0.5in) | Word/Docs default | G2 |
| **Body font** | **11pt** print / **16px** ekran | Word Aptos 11 / Butterick | G1 |
| **Interlinia** | **1.4–1.5** | Butterick 1.2–1.45 ∧ WCAG 1.4.12 ≥1.5 → **DECYZJA 1.5** | G2 |
| **Miara (dł. wiersza)** | **50–75 znaków, 66 ideał** | Bringhurst/Butterick reconcile | G2 |
| **Skala nagłówków (ratio 1.25, base 16)** | H1 39 · H2 31 · H3 25 · H4 20 · body 16 px | type-scale | G1 |
| **Tabele** | nagłówek bold + tło wyróżnione · zebra-striping (duże) · ramki 1px · padding ~12px | MDN/Bootstrap | G3 |
| **Listy** | prawdziwe outline (Word/HTML), NIE ręczne „• " | — | G7 |
| **Wierność export** | DOCX i PDF = parytet z ekranem (Puppeteer dla PDF) | decyzja stacku | G8 |

---

## 3. TABELA — parametry (Excel/Airtable + Claude-Excel)

| Param | Wartość | Źródło | Mapuje |
|---|---|---|---|
| **Wysokość wiersza** | **~20px (15pt)** domyślnie | Excel | G6 |
| **Szerokość kolumny** | auto-fit; baza **~64px (8.43 znaku)**; brak „####" | Excel | G5 |
| **Nagłówek** | bold + tło wyróżnione (kolor) | norma | G1 |
| **Striping** | banded rows ON (naprzemienne) | Excel/Sheets | G6 |
| **Conditional formatting** | **data bars** (gradient/solid) · **color scales** (2/3-kolor min/mid/max) · **icon sets** (3/4/5: kierunki/światła/oceny) · highlight/top-bottom | Excel verbatim | G3 |
| **Formaty liczb** | 4-sekcyjne `dod;ujem;zero;tekst`; `#,##0` `0.00` `0%` `#,##0.00 zł` daty `dd.mm.yyyy` | Excel number-format-codes | G4 |
| **Kolory komórek** | singleSelect/status = kolory opcji; semantyka zielony/czerwony + etykieta | norma | G2 |
| **Paleta kategorialna** | ≤7 | Carbon | G2 |
| **Wierność XLSX** | export niesie fills/borders/numFmt/CF (exceljs, nie SheetJS-community) | decyzja stacku | G7 |

---

## 4. Decyzje rozbieżności (rozstrzygnięte)
1. **Kanwa decku:** 1920×1080 (nie 960×540).
2. **Min body decku:** 24pt projekcyjny / 16pt read — wg typu template.
3. **Wykresy:** pie ≤5, line/bar ≤6 (cap 8), kolory ≤7.
4. **Miara doc:** 50–75 znaków, 66 ideał.
5. **Interlinia doc:** **1.5** (spełnia Butterick ∧ WCAG).
6. **Siatka:** 8px główna + 4px sub-grid.
7. **Wiersz tabeli UI:** ~20px (arkusz) / 52px-standard·36px-dense (data-grid Material) — wg kontekstu.

## 5. Jak to wiąże odbiór
- Każdy wymiar **G** rubryki (2C/3C/4C) odwołuje się do parametru tutaj → ocena **0/1/2** liczona względem KONKRETNEJ liczby (np. G1 kontrast: <3:1=0, 3–4.5:1=1, ≥4.5:1=2; G7 wykres pie z 8 wycinkami=1, ≤5=2).
- **Head-to-head:** te same parametry mierzymy u nas i u referencji (Gamma/Claude/Airtable) — porównanie liczbowe, nie wrażeniowe.
- FT-5 (parytet wizualny) i FT-4 (wierność exportu) sprawdzają, że plik trzyma te parametry (np. assert kontrast, assert numFmt w xlsx).

> To jest „dopracowany element oczekiwanych parametrów graficznych": każda liczba ma źródło lub naszą świadomą decyzję, i każda mapuje na odhaczalny wymiar odbioru.
