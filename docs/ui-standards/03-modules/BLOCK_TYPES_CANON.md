# Canon typów bloków — Block Types

> **Przeznaczenie.** Ten dokument definiuje słownik ~12 typów bloków treści używanych w kartach (SectionCard) widoków artefaktów (InsightViewer, InitiativeDocumentView). Każdy typ bloku jest zdefiniowany **raz** — karty w kanonach artefaktów odwołują się do nich przez nazwę. Ten sam słownik obowiązuje dla eksportu PDF i PowerPoint.
>
> **Standard wizualny:** McKinsey & Company presentation quality. Zasada: każdy element musi zarabiać swoje miejsce. Zero dekoracji. Maksimum czytelności.

---

## Fundament — System typograficzny

Wszystkie bloki dziedziczą z tej hierarchii. Nie ma innych rozmiarów czcionek w widoku artefaktu.

| Poziom | Użycie | Klasa Tailwind |
|--------|--------|----------------|
| **L1 — Nagłówek bloku** | Label nad grupą pól, nagłówek sekcji w karcie | `text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400` |
| **L2 — Tytuł elementu** | Nazwa karty w gridzie, tytuł hipotezy, temat | `text-[13px] font-semibold text-slate-800 dark:text-slate-100` |
| **L3 — Treść główna** | Prose, opisy, definicje | `text-[13px] font-normal leading-[1.6] text-slate-700 dark:text-slate-300` |
| **L4 — Treść wspierająca** | Atrybuty, metadane, opisy pola | `text-[12px] font-normal text-slate-500 dark:text-slate-400` |
| **L5 — Mikro / caption** | Timestamp, ID, tooltip | `text-[11px] font-normal text-slate-400 dark:text-slate-500` |
| **Q — Cytat** | Pull quote, inline quote | `text-[13px] font-normal italic leading-[1.65] text-slate-600 dark:text-slate-300` |
| **N — Liczba / dane** | Score, metryka, count | `text-[22px] font-semibold tabular-nums text-slate-800 dark:text-slate-100` |

**Zasada McKinsey:** hierarchy przez weight i color, nie przez rozmiar. Różnica między L2 a L3 to weight (semibold vs regular) — nie px. Duże skoki rozmiaru tylko dla liczb (N).

---

## Fundament — Semantyka kolorów

Spójny system znaczeń — identyczny w canvas, PDF i PowerPoint.

### Priorytety / dotkliwość

| Poziom | Token | Hex (light) |
|--------|-------|-------------|
| Critical | `severity-critical` | `#dc2626` (red-600) |
| High | `severity-high` | `#ea580c` (orange-600) |
| Medium | `severity-medium` | `#d97706` (amber-600) |
| Low | `severity-low` | `#64748b` (slate-500) |

### Statusy

| Status | Token | Hex (light) |
|--------|-------|-------------|
| Complete / Positive | `status-complete` | `#059669` (emerald-600) |
| In Progress / Active | `status-active` | `#2563eb` (blue-600) |
| Pending / Draft | `status-pending` | `#94a3b8` (slate-400) |
| Archived / Disabled | `status-archived` | `#cbd5e1` (slate-300) |

### Sentyment

| Sentyment | Token | Kolor tła (subtelny) |
|-----------|-------|----------------------|
| Positive | `sentiment-pos` | emerald-50 / emerald-500/10 |
| Negative | `sentiment-neg` | red-50 / red-500/10 |
| Neutral | `sentiment-neu` | slate-100 / slate-500/10 |
| Mixed | `sentiment-mix` | amber-50 / amber-500/10 |

### Zasada monochromatyzmu

Każda wizualizacja używa **jednego koloru akcentu** poza neutralną paletą slate/navy. Wyjątek: macierze sentymentu (muszą rozróżniać ≥3 wartości). Nigdy dwa jasne kolory akcentu w jednym bloku.

---

## 12 typów bloków

---

### 1. `ProseBlock` — Blok prozy

**Używany w:** Consulting Readout (SCQR), Executive Summary, Implicit Assumptions (prose), Power Dynamics (Narrative Control, Interview Bias)

#### Anatomia

```
┌──────────────────────────────────────────────────┐
│  SITUATION                                  [✨]  │  ← L1 nagłówek bloku
│  ─────────────────────────────────────────────── │  ← separator 1px slate-100
│  Treść prose...  Treść prose...  Treść prose...  │  ← L3 treść główna
│  "Cytat inline kursywą..."  — Rola respondenta   │  ← Q cytat (opcjonalny)
│  Treść prose...                                  │
└──────────────────────────────────────────────────┘
```

#### Specyfikacja

- Nagłówek sekcji: L1 (`SITUATION`, `COMPLICATION`, etc.)
- Separator pod nagłówkiem: `border-b border-slate-100 dark:border-navy-700/40 mb-3`
- Treść: L3, `max-w-prose` (nie łamie się zbyt wcześnie)
- Cytat inline: Q level, poprzedzony `border-l-2 border-slate-300 dark:border-slate-600 pl-3 my-2`
- Atrybucja cytatu: L5, `— Rola (bez imienia)`, po prawej stronie cytatu lub pod nim
- Spacing między sekcjami prose: `gap-y-5`

#### Export

- **PDF:** Akapit z nagłówkiem H3 (bold, 10pt), treść 9pt, margines lewy 0, interlinia 1.4
- **PowerPoint:** Text box 100% szerokości slajdu minus marginesy (1.2cm), nagłówek jako osobny text box ponad

---

### 2. `LabeledCardGrid` — Siatka kart etykietowanych

**Używany w:** Themes, Issues & Risks, Opportunities, Recommendations (Priority Actions, Quick Wins), Hypothesis Board, Perspectives, Benchmarks

#### Anatomia jednej karty w gridzie

```
┌─────────────────────────────────────┐
│  [badge severity]    [badge status] │  ← prawy górny róg, opcjonalne
│  Tytuł / Teza                       │  ← L2
│  Opis / Definicja...                │  ← L4, max 2 linii
│  ─────────────────────────────────  │  ← separator
│  "Cytat reprezentatywny..."         │  ← Q, max 40 słów
│  — Rola · Sesja X             [↗]  │  ← L5 + link do sesji
└─────────────────────────────────────┘
```

#### Specyfikacja

- Karta: `bg-slate-50 dark:bg-navy-800/60 rounded-lg border border-slate-200/60 dark:border-navy-700/50 p-3.5`
- Hover: `hover:border-slate-300 dark:hover:border-navy-600 hover:shadow-sm transition-all`
- Badge severity: mała pigułka, kolor z semantyki severity; `text-[10px] font-medium px-1.5 py-0.5 rounded-full`
- Tytuł: L2
- Opis: L4, `line-clamp-2`
- Separator: `border-t border-slate-100 dark:border-navy-700/40 mt-2 pt-2`
- Cytat: Q, `line-clamp-3`
- Footer (rola + link): L5, flex justify-between

**Grid layout:**
- Desktop ≥ 1024px: `grid grid-cols-2 gap-3`
- Mobile: `grid grid-cols-1`
- Karty `cSpan:1` w canvas: 2-col grid mieści się w ~530px

#### Stany

- Karta **Complete**: subtelne `bg-emerald-50/40 dark:bg-emerald-900/10 border-emerald-200/60 dark:border-emerald-700/30`
- Karta **Critical**: `border-l-4 border-l-red-500` zamiast normalnego bordera

#### Export

- **PDF:** Tabela 2-col, każda karta = wiersz; tytuł pogrubiony, opis i cytat w tej samej komórce
- **PowerPoint:** Shape (rounded rectangle), rozmieszczone w 2×N siatce, tytuł bold, cytat italic

---

### 3. `QuoteItem` — Cytat

**Używany w:** Quote Bank (główny element), jako blok w innych kartach

#### Anatomia

```
┌──────────────────────────────────────────────────┐
│  ❝                                      ★  [tag] │  ← star = top quote, tag = temat
│                                                  │
│  "Treść cytatu dokładnie tak jak wypowiedział    │  ← Q level, nie skracamy
│   respondent, bez poprawek gramatycznych         │
│   zachowując oryginalny język."                  │
│                                                  │
│  ── Rola respondenta   ·   Sesja 3, 14:23        │  ← L5
└──────────────────────────────────────────────────┘
```

#### Specyfikacja

- Kontener: `bg-white dark:bg-navy-850 rounded-lg border border-slate-200/70 dark:border-navy-700/50 p-4`
- Lewy akcent (opcjonalny dla top quotes ★): `border-l-3 border-primary-400`
- Guillemets `❝`: `text-[28px] text-slate-200 dark:text-navy-600 leading-none mb-1 font-serif` (dekoracyjne, nie w tekście cytatu)
- Treść cytatu: Q level, `leading-[1.7]`
- Separator pod cytatem: `border-t border-slate-100 dark:border-navy-700/40 mt-3 pt-2`
- Footer: L5, flex items-center gap-2
- Tag tematu: `text-[10px] bg-slate-100 dark:bg-navy-700 px-2 py-0.5 rounded-full text-slate-500`
- Star (top quote): `text-amber-400 text-[14px]`

#### Export

- **PDF:** Wcięcie lewe 0.8cm, prawa linia akcentu 2px, treść italic 9pt, atrybucia 8pt
- **PowerPoint:** Text box z lewą linią akcentu (shape border left only), bg fill slate-50

---

### 4. `DataTable` — Tabela danych

**Używany w:** Analysis Matrix (główny), Benchmarks (comparison table), Issues & Risks (tabela), Power Map

#### Anatomia

```
┌──────────────────────────────────────────────────────────┐
│  Nagłówki kolumn  │  Col A  │  Col B  │  Col C  │  Col D │  ← L1
│  ──────────────────────────────────────────────────────── │  ← 1px slate-200
│  Wiersz 1         │  dane   │  •      │  ••     │  dane  │  ← L3
│  Wiersz 2         │  dane   │  •••    │  —      │  dane  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │  ← 1px dashed, między wierszami
│  Summary          │  total  │  80%    │         │        │  ← bold summary row
└──────────────────────────────────────────────────────────┘
```

#### Specyfikacja McKinsey

- **Zero pionowych linii** — tylko poziome. Zasada McKinsey: kolumny rozróżnia wyrównanie i spacing, nie siatka.
- Nagłówek tabeli: L1, `text-right` dla kolumn numerycznych, `text-left` dla opisowych
- Separator nagłówka: `border-b-2 border-slate-300 dark:border-navy-600` (grubszy niż wiersze)
- Separator wierszy: `border-b border-dashed border-slate-100 dark:border-navy-700/40`
- Komórki numeryczne: `text-right tabular-nums`
- Komórki tekstowe: `text-left`
- Hover wiersza: `hover:bg-slate-50/60 dark:hover:bg-navy-800/30`
- Summary row: `border-t-2 border-slate-300 dark:border-navy-600 font-semibold bg-slate-50/60`
- Heatmapa (Analysis Matrix): komórki z `bg-{sentiment-color}/15` + centrowane `●`/`○`

#### Responsive

Na `cSpan:1` (~530px): ukryj mniej ważne kolumny, zostaw max 3. Na full width: pełna tabela.

#### Export

- **PDF:** Tabela LaTeX-style: tylko linie horyzontalne, nagłówek pogrubiony; interlinia 1.2; font 8.5pt
- **PowerPoint:** Tabela PowerPoint, brak vertical borders, header row fill slate-100, alternating fill dla czytelności

---

### 5. `StatusList` — Lista ze statusami

**Używany w:** Hypothesis Board (status supported/refuted), Stakeholder Map, Next Actions / Priority Actions (lista z ownerami), Activity Log

#### Anatomia jednej pozycji

```
┌────────────────────────────────────────────────────┐
│  ● [status pill]  Treść / Tytuł pozycji            │  ← L2 + status
│     Opis wspierający lub wyjaśnienie...             │  ← L4, wcięcie wyrównane
│     Owner: Rola · Termin: Q3 2026      [→ link]    │  ← L5
└────────────────────────────────────────────────────┘
```

#### Specyfikacja

- Kontener listy: `space-y-2`
- Każda pozycja: `flex gap-3 p-3 rounded-lg border border-slate-100 dark:border-navy-700/40`
- Status dot/pill: kolory z semantyki statusów; `w-2 h-2 rounded-full mt-1.5 flex-shrink-0`
- Dla hipotez: pill zamiast dot — `text-[10px] font-medium px-2 py-0.5 rounded-full`
  - Supported → emerald
  - Refuted → red
  - Insufficient Data → amber
  - Pending → slate
- Treść: L2
- Opis: L4, wcięcie `pl-5` (wyrównane do tekstu, nie do dot)
- Metadane (owner/termin): L5

#### Export

- **PDF:** Lista wypunktowana em-dash, status jako tekst w nawiasie po tytule
- **PowerPoint:** Bullet list, status jako colored text run

---

### 6. `ScoreBar` — Pasek wyniku

**Używany w:** Sentiment & Tone (Overall Sentiment 0–100), quality indicators, coverage metrics

#### Anatomia

```
┌────────────────────────────────────────┐
│  OVERALL SENTIMENT                     │  ← L1
│                                        │
│       72                               │  ← N (duża liczba)
│       Optimistic                       │  ← L3 etykieta słowna
│                                        │
│  ████████████████░░░░░░░░  72/100      │  ← progress bar
│  Negative ─────────────── Positive    │  ← L5 skale
└────────────────────────────────────────┘
```

#### Specyfikacja

- Liczba N: `text-[28px] font-semibold tabular-nums`
- Kolor liczby: mapowanie 0–40=red-600, 41–60=amber-600, 61–80=emerald-600, 81–100=emerald-700
- Etykieta słowna: L3, kolor slate-600
- Progress bar: `h-2 rounded-full bg-slate-100 dark:bg-navy-700`; fill `bg-gradient-to-r from-red-400 via-amber-400 to-emerald-500` (pasek całej skali) + wskaźnik pozycji
- Skale: L5, flex justify-between
- Spacing: `gap-y-2`

#### Export

- **PDF:** Liczba + etykieta jako tekst; progress bar jako filled rectangle shape
- **PowerPoint:** SmartArt lub ręczna kompozycja: number (large), label, bar shape

---

### 7. `HeatmapMatrix` — Macierz heatmapy

**Używany w:** Analysis Matrix (główna wizualizacja), Per-Theme Sentiment (w Sentiment & Tone)

#### Anatomia

```
         │ Role A │ Role B │ Role C │ Role D
─────────┼────────┼────────┼────────┼───────
Theme 1  │  ●  2  │  ●  3  │   ○    │  ●  1
Theme 2  │   ○    │  ●  1  │  ●  4  │   ○
Theme 3  │  ●  2  │   ○    │   ○    │  ●  2
─────────┴────────┴────────┴────────┴───────
Coverage │  75%   │  50%   │  25%   │  75%
```

#### Specyfikacja

- Komórka `●` obecność: `bg-blue-500/15 dark:bg-blue-400/15`, dot `text-blue-600 dark:text-blue-400`
- Komórka `○` brak: `bg-transparent`, dash `text-slate-300`
- Kolor komórki gdy sentyment: `bg-{sentiment-color}/15`
- Licznik cytatów w komórce: L5, `text-slate-500`, po prawej stronie dot
- Nagłówki kolumn: L1, rotacja 45° jeśli ≥6 kolumn
- Summary row (coverage): wyróżniona `border-t-2 font-semibold`
- Overflow: horizontal scroll z sticky pierwszą kolumną

#### Export

- **PDF:** Tabela z kolorowymi komórkami; ● = filled circle Unicode
- **PowerPoint:** Tabela z cell fill colors, merged cells dla sumy

---

### 8. `MetricCard` — Karta metryki

**Używany w:** KPIs (Initiative), Financial Impact, financial metrics, Sample Quality (n=X count)

#### Anatomia

```
┌──────────────────────────┐
│  METRIC LABEL            │  ← L1
│                          │
│  124                     │  ← N
│  sprzedawców             │  ← L4 jednostka
│                          │
│  ↑ +12% vs baseline      │  ← L4 trend (opcjonalny)
└──────────────────────────┘
```

#### Specyfikacja

- Kontener: `bg-slate-50 dark:bg-navy-800/60 rounded-xl p-4 border border-slate-200/60 dark:border-navy-700/50`
- Layout grid dla wielu metryk: `grid grid-cols-3 gap-3` (na full width karty)
- Liczba N: `text-[28px]` na dużej karcie, `text-[22px]` gdy 3+ metryk obok siebie
- Jednostka: L4, `text-slate-500`, bezpośrednio pod lub inline po liczbie
- Trend ↑: `text-emerald-600 text-[12px]`, ↓: `text-red-600`; `font-medium`
- Label: L1

#### Export

- **PDF:** Tabela 1×N z dużymi liczbami; bold label nad liczbą
- **PowerPoint:** Osobne text boxy dla każdej metryki, layout side-by-side

---

### 9. `TimelineItem` — Pozycja osi czasu

**Używany w:** Activity Log, Timeline (Initiative), Session list w Source Pack

#### Anatomia

```
│ ●─────────────────────────────────────────────────
│   Jan 15, 14:23   Piotr W. dodał sesję "Wywiad #3"
│                   → Insight odświeżony przez AI
│
│ ●─────────────────────────────────────────────────
│   Jan 14, 09:11   AI wygenerował Executive Summary
```

#### Specyfikacja

- Linia pionowa: `border-l-2 border-slate-200 dark:border-navy-700 ml-2`
- Dot: `w-2 h-2 rounded-full bg-slate-300 dark:bg-navy-600 -ml-[5px] mt-1.5 flex-shrink-0`
- Dot dla AI akcji: `bg-primary-400`
- Timestamp: L5, `text-slate-400`, `min-w-[120px]`
- Opis akcji: L4, `text-slate-600 dark:text-slate-400`
- Sub-akcja (→): L5, wcięcie `pl-4`, kolor `text-slate-400`
- Spacing między pozycjami: `gap-y-3`

#### Export

- **PDF:** Tabela 2-col: data+czas | opis akcji; linia pionowa symulowana lewym borderem
- **PowerPoint:** Nie eksportowany (log techniczny, nie consulting content)

---

### 10. `FileCard` — Karta pliku/raportu

**Używany w:** Report Pack

#### Anatomia

```
┌────────────────────────────────────────────────────┐
│  [📄 ikona]  Executive Memo                        │  ← L2 + ikona typu
│              Draft · Wygenerowany 15 sty 2026      │  ← L5
│              ─────────────────────────────────     │
│              [Pobierz PDF]  [Udostępnij]  [Podgląd]│  ← przyciski akcji
└────────────────────────────────────────────────────┘
```

#### Specyfikacja

- Kontener: `flex gap-4 p-4 rounded-xl border border-slate-200/70 dark:border-navy-700/50 bg-white dark:bg-navy-850`
- Ikona pliku: 32×32px, kolor per typ (PDF=red-500, PPTX=orange-500, DOCX=blue-500)
- Miniaturka podglądu (jeśli jest): `w-16 h-12 rounded object-cover border border-slate-100 flex-shrink-0`
- Tytuł: L2
- Metadane: L5, `text-slate-400`
- Przyciski: h-7, `text-[12px]`, Ghost style

#### Export

- Nie dotyczy — sama jest kontenerem eksportów

---

### 11. `SessionRow` — Wiersz sesji

**Używany w:** Source Pack

#### Anatomia

```
[📋 typ-ikona]  Tytuł sesji                 [Source] [→]
                3 respondentów · 15 sty 2026 · 47 min
```

#### Specyfikacja

- Layout: `flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-navy-700/40`
- Ikona typu: 20×20px, `text-slate-400`; Interview=mic, FGI=users, Survey=list, Document=file
- Tytuł: L3 (nie semibold — to lista, nie nagłówek)
- Metadane: L5, `text-slate-400`, separator `·`
- Status badge: `SessionRow` używa status z semantyki (Source=blue, Exported=emerald, Draft=slate)
- Link `→`: L5, `text-primary-500`, pojawia się na hover

#### Export

- **PDF:** Appendix "Źródła danych" — tabela: typ | tytuł | data | liczba respondentów | status

---

### 12. `EmptyState` — Stan pusty

**Używany w:** każda karta gdy brak danych

#### Anatomia

```
┌──────────────────────────────────────────┐
│                                          │
│    [ikona 24px, slate-300]               │
│                                          │
│    Komunikat pusty stanu                 │  ← L3 slate-400, text-center
│    Opcjonalny opis dodatkowy             │  ← L4 slate-400
│                                          │
│    [CTA button — opcjonalny]             │
│                                          │
└──────────────────────────────────────────┘
```

#### Specyfikacja

- Kontener: `flex flex-col items-center justify-center min-h-[120px] py-8 gap-2`
- Ikona: 24px, `text-slate-300 dark:text-navy-600`
- Komunikat: L3, `text-slate-400 dark:text-slate-500`, `text-center max-w-[280px]`
- Opis: L4, `text-slate-400`, `text-center max-w-[260px]` — krótki, max 2 linii
- CTA: gdy karta może być wypełniona przez użytkownika lub AI — `h-8 text-[12px]` Ghost button lub subtle fill

**Zasada:** EmptyState nigdy nie jest przeprosinami. Mówi CO zrobić dalej.

---

## Reguły kompozycji wewnątrz SectionCard

```
SectionCard
├── Header (zawsze)
│   ├── [ikona] Nazwa sekcji (L2)
│   ├── [spacer]
│   └── [✓ Mark Complete] button
├── separator: border-b border-slate-100 mb-4
├── Block 1 (np. L1 "NAGŁÓWEK" + ProseBlock)
├── gap-y-5 między blokami
├── Block 2 (np. LabeledCardGrid)
├── gap-y-5
└── Footer (opcjonalny)
    └── [+ Dodaj element] — ghost link, L4
```

**Spacing wewnątrz karty:** `p-5` (20px padding). Między blokami: `gap-y-5` (20px). Między sub-elementami w bloku: `gap-y-2` lub `gap-y-3`.

**Zasada powietrza McKinsey:** każdy blok treści ma co najmniej 16px przestrzeni od następnego. Zagęszczenie = trudność czytania = stracony klient.

---

## Mapowanie kart do typów bloków

| Karta | Bloki |
|-------|-------|
| `consulting-readout` | ProseBlock × 4 (SCQR) |
| `executive-summary` | ProseBlock × 4 (Headline/Findings/Implication/CTA) |
| `recommendations` | LabeledCardGrid + StatusList + LabeledCardGrid |
| `themes` | LabeledCardGrid |
| `issues-risks` | LabeledCardGrid (Issues) + LabeledCardGrid (Risks) |
| `opportunities` | LabeledCardGrid |
| `benchmarks` | DataTable + ProseBlock (Industry Context) |
| `perspectives` | LabeledCardGrid |
| `consensus-divergence` | StatusList (Consensus) + LabeledCardGrid (Divergence) |
| `sentiment-tone` | ScoreBar + HeatmapMatrix + TimelineItem + LabeledCardGrid |
| `implicit-assumptions` | LabeledCardGrid |
| `silences` | LabeledCardGrid |
| `signals` | LabeledCardGrid |
| `power-dynamics` | DataTable (Power Map) + ProseBlock × 2 |
| `hypothesis-board` | StatusList |
| `quote-bank` | QuoteItem × N |
| `evidence-map` | LabeledCardGrid (z claim→evidence) |
| `analysis-matrix` | HeatmapMatrix |
| `source-pack` | SessionRow × N |
| `report-pack` | FileCard × N |
| `quality-trust` | MetricCard + StatusList + LabeledCardGrid + LabeledCardGrid |
| `comments` | StatusList (wątkowe) |
| `activity-log` | TimelineItem × N |
| — | — |
| **Initiative: initiative-scope** | ProseBlock + LabeledCardGrid |
| **Initiative: timeline** | TimelineItem + MetricCard |
| **Initiative: kpi** | MetricCard × N + DataTable |
| **Initiative: risk-raid** | LabeledCardGrid (severity) |
| **Initiative: financial-analysis** | DataTable + MetricCard |
| **Initiative: team** | LabeledCardGrid (role cards) |

---

## Reguły eksportu (cross-format)

| Blok | PDF | PowerPoint |
|------|-----|------------|
| ProseBlock | Akapit H3 + body 9pt | Text box full-width |
| LabeledCardGrid | Tabela 2-col | 2×N shapes (rounded rect) |
| QuoteItem | Wcięte + italic + linia akcentu | Text box z left border |
| DataTable | Tabela bez vertical lines | PowerPoint table no vertical borders |
| ScoreBar | Liczba bold + bar shape | Number large + rectangle shape |
| HeatmapMatrix | Tabela z fill colors | Table cell fill colors |
| MetricCard | 3-col table: label + number + trend | Side-by-side text boxes |
| TimelineItem | 2-col table (data + opis) | Nie eksportowany |
| FileCard | Appendix lista | Nie eksportowany |
| SessionRow | Appendix tabela źródeł | Footnote / appendix |
| EmptyState | Nie pojawia się w eksporcie | Nie pojawia się |

**Zasada eksportu:** EmptyState nigdy nie trafia do PDF ani PowerPoint. Karty bez danych są pomijane lub zastąpione sekcją "Nie dotyczy tego badania".

---

## Toolbar artefaktu — Standard (Warstwa 3)

> Obowiązuje identycznie dla InitiativeDocumentView i InsightViewer.

### Układ

```
[≡ Sections ▾]  [New]  [Export ▾]    · aktywna sekcja ·    │    [⚡ AI ▾]    [⎊]  [▶]    [⚡ AI Consultant]
```

Toolbar jest `sticky` — klei się pod Properties Strip, zawsze widoczny. Dwie strefy oddzielone separatorem: **lewa** (praca z treścią) i **prawa** (AI + tryby).

### Elementy

| Element | Typ | Zachowanie |
|---------|-----|-----------|
| `≡ Sections ▾` | Ghost | Dropdown: lista sekcji z checkboxami pogrupowana jak sidebar. Sekcje bez danych wyszarzone + tag "brak". Footer: "Przywróć domyślne." |
| `New` | Subtle fill | Kontekstowy — tworzy element w aktywnej sekcji inline (nie modal). Na sekcjach systemowych: disabled + tooltip. |
| `Export ▾` | Ghost | Selektor miejsca docelowego: → Notatki · → Idee (Mind Map/Whiteboard) · → Prezentacja · → PDF. "Tabela" disabled (wkrótce). |
| `· aktywna sekcja ·` | Label (nie przycisk) | Nazwa aktywnej sekcji. `text-[12px] text-slate-400` centered. Orientacja bez hałasu. |
| `│` | Separator | `w-px h-5 bg-slate-200 dark:bg-navy-700 self-center` |
| `⚡ AI Consultant ▾` | Split · teal-subtle | Lewa: embedded chat aktywnej sekcji. `▾`: Uzupełnij · Proponuj · Odśwież · Kontynuuj sesję. |
| `⎊` | Icon-only · ghost | Fork — otwiera nowy artefakt z tą samą strukturą, pustymi danymi. Tooltip: "Duplikuj jako nowy artefakt." |
| `▶` | Icon-only · ghost | Present — fullscreen bez chrome, jedna karta na raz, strzałki, Esc wychodzi. |
| `⚡ AI Consultant` | Solid · teal | Prawy panel ~360px z chatem i menu całego artefaktu. Najważniejszy przycisk toolbara. |

### Kolorystyka (Harvard palette)

| Element | Light | Dark |
|---------|-------|------|
| Ghost (Sections, Export) | `border-slate-200 text-slate-600 hover:bg-slate-50` | `border-navy-700 text-navy-300 hover:bg-navy-800/60` |
| Subtle fill (New) | `bg-slate-100 text-slate-700 hover:bg-slate-200/70` | `bg-navy-800 text-navy-200 hover:bg-navy-700` |
| AI split (sekcja) | `bg-teal-50 border-teal-200 text-teal-700` | `bg-teal-900/20 border-teal-700/40 text-teal-300` |
| AI solid (artefakt) | `bg-teal-600 text-white hover:bg-teal-700` | `bg-teal-700 text-white hover:bg-teal-600` |
| Icon-only (Fork, Present) | `text-slate-500 hover:text-slate-700 hover:bg-slate-100` | `text-navy-400 hover:text-navy-200 hover:bg-navy-800` |

### Standard przycisków

```
h-8 (32px) · text-[13px] font-medium · rounded-lg · gap-2
```

Zero czerwonych przycisków. Zero gradientów. Jeden kolor AI — teal. Destruktywne akcje (usuń, archiwizuj, share, rename) wyłącznie w kebab `⋯` na poziomie tabeli/listy.

---

## Odniesienia

- [Canon inicjatyw](./INITIATIVE_CANON.md) — mapowanie bloków do kart inicjatyw
- [Canon insightów](./INSIGHT_CANON.md) — mapowanie bloków do kart insightów
- [TABLE_AND_PREVIEW_CANON.md](./TABLE_AND_PREVIEW_CANON.md) — standard list i tabel w widokach hub
