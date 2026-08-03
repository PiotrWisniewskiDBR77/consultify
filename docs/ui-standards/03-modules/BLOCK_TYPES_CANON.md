# Canon typów bloków — Block Types

> **Przeznaczenie.** Ten dokument definiuje słownik ~12 typów bloków treści używanych w kartach (SectionCard) widoków artefaktów (InsightViewer, InitiativeDocumentView). Każdy typ bloku jest zdefiniowany **raz** — karty w kanonach artefaktów odwołują się do nich przez nazwę. Ten sam słownik obowiązuje dla eksportu PDF i PowerPoint.
>
> **Standard wizualny:** McKinsey & Company presentation quality. Zasada: każdy element musi zarabiać swoje miejsce. Zero dekoracji. Maksimum czytelności.

---

## Fundament — System typograficzny

Wszystkie bloki dziedziczą z tej hierarchii. Nie ma innych rozmiarów czcionek w widoku artefaktu.

| Poziom | Użycie | Klasa Tailwind |
|--------|--------|----------------|
| **L1 — Nagłówek bloku** | Label nad grupą pól, nagłówek sekcji w karcie | `text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-500` |
| **L2 — Tytuł elementu** | Nazwa karty w gridzie, tytuł hipotezy, temat | `text-[13px] font-semibold text-slate-800 dark:text-slate-100` |
| **L3 — Treść główna** | Prose, opisy, definicje | `text-[13px] font-normal leading-[1.6] text-slate-700 dark:text-slate-300` |
| **L4 — Treść wspierająca** | Atrybuty, metadane, opisy pola | `text-[12px] font-normal text-slate-500 dark:text-slate-400` |
| **L5 — Mikro / caption** | Timestamp, ID, tooltip | `text-[11px] font-normal text-slate-400 dark:text-slate-500` |
| **Q — Cytat** | Pull quote, inline quote | `text-[13px] font-normal italic leading-[1.65] text-slate-600 dark:text-slate-300` |
| **N — Liczba / dane** | Score, metryka, count | `text-[22px] font-semibold tabular-nums text-slate-800 dark:text-slate-100` |

**Zasada McKinsey:** hierarchy przez weight i color, nie przez rozmiar. Różnica między L2 a L3 to weight (semibold vs regular) — nie px. Duże skoki rozmiaru tylko dla liczb (N).

**SSOT implementacji:** `src/styles/typography.ts` eksportuje stałe `TEXT_L1`…`TEXT_L5`, `TEXT_N`, `TEXT_Q`.  
Import zamiast powtarzania raw Tailwind stringów:
```tsx
import { TEXT_L1, TEXT_L2 } from '@/styles/typography';
<span className={TEXT_L1}>Nagłówek sekcji</span>
```

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

**SSOT implementacji:** `src/index.css` — CSS custom properties `--c-success`, `--c-warning`, `--c-danger`, `--c-info`, `--c-accent` są autorytatywne. Hex'y w tabelach powyżej służą do identyfikacji wizualnej; w razie rozbieżności token CSS wygrywa. Dostęp przez Tailwind: `text-c-info`, `bg-c-danger/10`, `border-c-success` itd.
Runtime mapping statusów: `src/constants/statusColors.ts` → `getStatusStyle(status)`.

---

## 12 typów bloków

> **To jest słownik projektowy (design vocabulary), nie lista literalnych komponentów React.**
> Zweryfikowano `grep -rl "<Nazwa>" src` dla każdej z 12 nazw poniżej (2026-08-02): żadna nie istnieje
> jako samodzielny, nazwany komponent w `src/`. Renderowanie sekcji w `src/components/Interview/InsightViewer.tsx`
> i `src/components/Initiatives/InitiativeDocumentView.tsx` to dziś bespoke JSX w jednym dużym `switch (section.id)`
> — każdy `case` układa Tailwind ręcznie, zgodnie ze specyfikacją danego typu poniżej, ale bez pośredniego
> komponentu o tej nazwie. „Typ bloku" = nazwa wzorca wizualnego (anatomia + klasy + reguły eksportu), który
> ma być odtworzony w JSX-ie sekcji, nie typ do zaimportowania.
>
> Dwie realne warstwy komponentowe istnieją równolegle i **nie są z tym słownikiem tożsame**:
> - `src/components/shared/NModeBlocks/` — 6 generycznych, faktycznie importowanych prymitywów UI
>   (`Callout`, `ChecklistBlock`, `EmbeddedView`, `EmptyStateInline`, `InlineTable`, `ToggleBlock`;
>   patrz `NModeBlocks/index.ts`), używanych jako cegiełki WEWNĄTRZ sekcji (np. `InsightViewer.tsx`
>   importuje `Callout`, `EmptyStateInline`, `InlineTable`) — nie jeden-do-jednego z 12 typami niżej.
> - `src/components/Initiatives/cards/cardBlockSchema.ts` + `CardBlockRenderer.tsx` — osobny,
>   realny, schema-driven renderer z własnym słownikiem typów (`heading`, `paragraph`, `kpi_strip`,
>   `bullet_list`, `table`, `chart`, `callout`), używany tylko dla podzbioru kart inicjatyw (F3/D11,
>   4–6 „core" kart). Nie mylić z 12 typami poniżej — inna warstwa, inne nazewnictwo, inny zakres.
>
> Rozbieżność między dawną checklistą w § BLOK B3 (inne nazwy dla tych samych 12 pojęć) i tą listą
> ujednolicono 2026-08-02 na rzecz tej listy — patrz nota przy B3 i Changelog.

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
- Spacing między sekcjami prose: `gap-y-6` (24px, patrz zasada spacingu w § Reguły kompozycji wewnątrz SectionCard)

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
- Hover: `hover:border-slate-300 dark:hover:border-navy-600 hover:shadow-sm transition-[border-color,box-shadow] duration-base` (180ms, scoped — nie `transition-all`)
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
- Lewy akcent (opcjonalny dla top quotes ★): `border-l-3 border-c-border` (neutralny — crimson zakazany jako akcent dekoracyjny)
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
- Dot dla AI akcji: `bg-teal-500 dark:bg-teal-400` (AI = teal wyłącznie, zgodnie z regułą kolorystyczną w BLOK C — zakaz crimson na jakimkolwiek AI affordance)
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
- Link `→`: L5, `text-slate-500 dark:text-navy-400` (neutralny — nie crimson), pojawia się na hover

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
├── gap-y-6 między blokami
├── Block 2 (np. LabeledCardGrid)
├── gap-y-6
└── Footer (opcjonalny)
    └── [+ Dodaj element] — ghost link, L4
```

**Spacing wewnątrz karty:** `p-6` (24px padding, default) — `p-4` (16px) wyłącznie w gęstym/compact widoku (density compact). Wartości i nazewnictwo zgodne z `FOUNDATION_TOKEN_CONTRACT.md` §2: „padding karty: 16 px compact, 24 px default" — identyczne z BLOK F § SPACING McKinsey "air". Między blokami: `gap-y-6` (24px). Między sub-elementami w bloku: `gap-y-2` lub `gap-y-3`.

> Wcześniej ten dokument podawał tu `p-5`/`gap-y-5` (20px) — sprzeczne z BLOK F (`p-6`/`gap-6`/`space-y-6`, 24px) niżej w tym samym pliku. 20px jest technicznie w skali 4px z §2 kontraktu tokenów, ale nie jest wartością przypisaną do „padding karty" — ujednolicono na 24px default / 16px compact, zgodnie z rozstrzygnięciem z 2026-08-02 (patrz changelog).

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

## Mark Complete — Standard (Warstwa 4 · SectionCard)

> Obowiązuje identycznie dla InitiativeDocumentView i InsightViewer.

### Stany karty

| Stan | Znaczenie |
|------|-----------|
| **Open** (default) | AI może modyfikować sekcję podczas genesis i refresh |
| **Complete** | Zatwierdzone przez człowieka — AI pomija przy każdym refresh/genesis |

### Sygnały wizualne

- **Lewy border karty:** `border-l-2 border-success-500` (HBS Green) — ten sam wzorzec co aktywna sekcja używa crimson
- **Tło nagłówka karty:** `bg-success-50/40 dark:bg-success-900/10` — ledwo widoczne, nie przytłacza treści
- **Przycisk:** `[✓ Mark Complete]` → `[↩ Reopen]` w `text-success-700`

### Pola po Complete

Pola pozostają **w pełni edytowalne.** Zero readonly, zero banerów ostrzegawczych.

`Complete` = wyłącznie sygnał dla AI. AI sprawdza status karty przed każdą modyfikacją i pomija sekcje Complete. Użytkownik klika `[↩ Reopen]` gdy chce przywrócić AI-edycję.

### Lewa nawigacja

- `✓` przy nazwie sekcji (11px, `text-success-500`, prawa strona) — ikona sekcji bez zmian
- **Pasek postępu** na górze panelu nawigacji:

```
8 / 23 complete
●●●●●●●●○○○○○○○  ← 4px, success-500
```

### Persystencja

Baza danych — nie localStorage. Lazy ALTER pattern (`DB_MANAGED_SCHEMA=off`). Realny kod (nie uogólniony DDL) różni się między dwoma artefaktami:

- **Insighty** (`server/src/controllers/InterviewController.ts`, `ensureInsightSectionCompletionsColumn()`): tabela **`interview_insights`** (nie `insights`), kolumna **`TEXT`** (nie `JSONB`, string JSON). Existence sprawdzane najpierw przez `pg_attribute` (bez lock tabeli), dopiero potem `ALTER TABLE` — bez `IF NOT EXISTS`, bez `DEFAULT`:
  ```sql
  ALTER TABLE interview_insights ADD COLUMN section_completions TEXT
  ```
- **Inicjatywy** (`server/src/controllers/InitiativeController.ts`): tabela `initiatives`, kolumna również **`TEXT`**. Existence sprawdzane przez `getTableColumns()`, dopiero potem `ALTER TABLE` — również bez `IF NOT EXISTS`, bez `DEFAULT`; błąd „already exists"/„duplicate column" jest połykany w `try/catch` jako fallback:
  ```sql
  ALTER TABLE initiatives ADD COLUMN section_completions TEXT
  ```

Format: `{ "themes": true, "issues-risks": true }` — mapa `section_id → boolean`, zapisywana jako `JSON.stringify(...)` do kolumny TEXT.

Rozszerzenie w przyszłości: osobna tabela `section_completion_log` z `completed_by` i `completed_at` gdy potrzebny audit trail.

---

## AI Consultant Panel — Standard (Warstwa 3 · prawy panel)

> Obowiązuje identycznie dla InitiativeDocumentView i InsightViewer.

### Anatomia panelu (~360px, slide-in z prawej)

```
┌──────────────────────────────────┐
│  Kontekst: Themes           [✕] │  ← 40px: aktywna sekcja lub "Cały insight"
│  Q3 Leadership Survey            │     + nazwa artefaktu (L5)
├──────────────────────────────────┤
│  [Akcja 1]                       │  ← 3–4 przyciski, collapsible po pierwszej
│  [Akcja 2]                       │     wiadomości → schodzą do [+ Akcje] chipa
│  [Akcja 3]                       │
├──────────────────────────────────┤
│                                  │
│  WĄTEK ROZMOWY (scrollable)      │  ← flex-1
│                                  │
│  AI: [odpowiedź...]              │
│  [Kontynuuj] [Pokaż inaczej]     │  ← suggestion chips po każdej odpowiedzi
│             [Dodaj do karty]     │
│                                  │
├──────────────────────────────────┤
│  [Napisz co chcesz...]      [→]  │  ← 56px fixed bottom
└──────────────────────────────────┘
```

### Kontekst: sekcja vs. artefakt

Jeden panel, jedna historia rozmowy, zmienny kontekst. Kontekst widoczny w nagłówku:
- `⚡ AI Consultant ▾` (split button) → `Kontekst: [nazwa sekcji]`
- `⚡ AI Consultant` (solid) → `Kontekst: Cały insight / Cała inicjatywa`

Przy zmianie sekcji AI potwierdza krótko: *"Przechodzę do sekcji Issues & Risks."* Historia rozmowy nie restartuje.

### Zagajenie — kontekstowe opening message

Panel nigdy nie otwiera się z pustym ekranem. AI czyta stan artefaktu i zagaja konkretnie:

| Sytuacja | Opening |
|----------|---------|
| Karta pusta, sesje dostępne | *"Masz 3 sesje bez wyodrębnionych tematów. Mogę przeanalizować i zaproponować 6–8 tematów z cytatami."* |
| Karta częściowa, luki | *"Wykryłem 4 twierdzenia bez cytatów. Chcesz żebym znalazł dowody?"* |
| Karta Complete | *"Ta sekcja jest zatwierdzona. Mogę analizować bez zmian lub otworzyć ją jeśli potrzebujesz edycji."* |

### "Dodaj do karty"

Chip `[Dodaj do karty]` pod każdą odpowiedzią AI. Klik → AI sam decyduje do którego pola w aktywnej karcie trafia treść. Nie ma selectora — AI zna strukturę sekcji i wybiera właściwe miejsce. Zero copy-paste.

### Sesja

Panel otwiera się świeżo za każdym razem. Brak persystentnej historii w V1. "Kontynuuj poprzednią sesję" = feature V2.

---

## Present Mode — Standard (`[▶]`)

### Zachowanie

- Fullscreen: zero chrome (brak toolbara, sidebara, nawigacji)
- Wyświetla karty **w kolejności sidebarowej** (personalna kolejność użytkownika, nie kanoniczna)
- Jedna karta na ekranie na raz
- Nawigacja: `←` `→` strzałki klawiatury lub kliknięcie
- Wyjście: `Esc`

### Kontrola kolejności

W Present mode aktywna jest możliwość **zmiany kierunku i kolejności kart** bezpośrednio w trybie prezentacji — drag lub przyciski `↑↓` na karcie. Zmiany zapisują się do osobistej kolejności sidebarowej (localStorage).

### Które karty

Wszystkie karty widoczne w sidebarze (zgodnie z ustawieniami `≡ Sections ▾`). Karty ukryte przez użytkownika nie pojawiają się w Present mode.

---

## Fork — Standard (`[⎊]`)

### Zachowanie

Klik → nowy artefakt otwiera się natychmiast (nie wraca do listy). Nowy artefakt zawiera:
- Identyczną strukturę sekcji
- Puste dane (treść nie jest kopiowana)
- Tag **"Forked from: [nazwa oryginału]"** widoczny w Properties Strip
- Link do oryginalnego artefaktu

Traceability jest zachowana — klient może zawsze zapytać o źródło analizy.

---

## Canon Completeness Checklist

> Używaj tej listy do weryfikacji każdego kanonu artefaktu przed startem implementacji. Kanon jest gotowy gdy wszystkie pola są zaznaczone.

```
WARSTWA 1 — IDENTITY
□ Title: font, max długość, inline edit, auto-save
□ Status dot: kolory i stany, powiązanie z Properties Strip
□ Artifact ID: format (INI-XXXX / INS-XXXX), UX kopiowania, feedback
□ Saved indicator: stany (idle / saving / saved)
□ N/C toggle: zachowanie, localStorage

WARSTWA 2 — PROPERTIES STRIP
□ Dokładnie 6 pól — niezmienne
□ Każde pole: wartości + pełna semantyka kolorów
□ Click-to-change behavior

WARSTWA 3 — TOOLBAR
□ Układ zgodny z BLOCK_TYPES_CANON § Toolbar
□ Export destinations: → Notatki · → Idee · → Prezentacja · → PDF
□ AI kolor: teal (bg-teal-600 solid / bg-teal-50 subtle)
□ Fork (⎊): nowy artefakt + tag "Forked from"
□ Present (▶): kolejność sidebarowa, reorder w trybie

WARSTWA 4 — CONTENT
□ Wszystkie karty z pełnym kontraktem (10 pól inicjatywa / 11 pól insight)
□ cSpan + cHidden per każda karta
□ Canvas grid reference: 2-col, 530px, gap 24px
□ Grupy nawigacyjne kompletne

STANY SPECJALNE
□ Mark Complete: visual state, AI lock, progress bar, DB storage
□ Empty state: komunikat + CTA per karta (pole "Pusty stan")
□ Loading: szkielet podczas AI genesis (⚠ patrz: Loading States — do dodania)
□ Error: AI failure handling (⚠ patrz: Error States — do dodania)

EKSPORT
□ Export destinations = BLOCK_TYPES_CANON SSOT
□ Kolejność kanoniczna zdefiniowana
□ Per-karta pole "Eksport" wypełnione

CROSS-REFERENCES
□ Link do BLOCK_TYPES_CANON na górze dokumentu
□ Toolbar sekcja referuje BLOCK_TYPES_CANON
□ Brak "TBD" w żadnym polu
```

> ⚠ **Do dodania w przyszłości:** Loading States (szkielet podczas genesis), Error States (AI failure UX), Mobile Behavior (< 768px), Keyboard Navigation / Accessibility, Multi-user Conflict Resolution. Te sekcje nie blokują V1 implementacji ale muszą powstać przed GA.

---

## Checkpointy walidacji implementacji

> **Cel:** Ten checklist jest odwrotnością "Canon Completeness Checklist" powyżej.
> Tamten pyta _czy spec jest kompletny_ (faza projektowania).
> Ten pyta _czy build jest poprawny_ (code review + smoke-test po implementacji).
>
> **Jak używać:**
> 1. Po implementacji nowego widoku — przejdź przez Bloki A–F i zaznacz każdy punkt.
> 2. Po dodaniu nowej karty — przejdź przez Blok B + odnośne punkty z Bloku C.
> 3. Niezaznaczone punkty = blokery przed mergem. Wyjątki opisuj w PR.
> 4. Każdy artefakt ma własny checklist rozszerzający →
>    INSIGHT_CANON.md § Checkpointy · INITIATIVE_CANON.md § Checkpointy

---

### BLOK A — Chrome widoku (raz per widok)

Otwierasz widok i weryfikujesz każdy podsystem jako całość.

**A1 — Warstwa Identity**

```
□ Title: inline edit działa, auto-save na blur, nie wysyła pustego stringa
□ Status dot: każdy stan (Draft / Active / Done / Archived) ma poprawny kolor
□ Artifact ID (INS-XXXX / INI-XXXX): widoczny, kopiuje się jednym kliknięciem, toast feedback
□ Saved indicator: trzy stany (idle / saving / saved) bez race condition
□ N/C toggle: przełącza layout, stan w localStorage, brak flash przy powrocie do widoku
```

**A2 — Properties Strip**

```
□ Dokładnie 6 pól, w kanonicznej kolejności (bez przesunięć)
□ Każde pole ma pełną semantykę kolorów (Priority: red/amber/green; Status: per kanon)
□ Click-to-change: dropdown otwiera się, wybranie wartości zapisuje ją natychmiast
□ Brak pól z wartością null lub "—" bez zdefiniowanego fallbacku w spec
□ Strip widoczny w trybach N i C; ukryty w trybie Present
```

**A3 — Toolbar**

```
□ STICKY: nie scrolluje razem z contentem
     Klasy: sticky top-0 z-30 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm
□ Slot 1 — Sections dropdown: lista sekcji działa, kliknięcie scrolluje canvas do sekcji
□ Slot 2 — New button: tworzy nowy element lub otwiera właściwy formularz
□ Slot 3 — Export dropdown: 4 destynacje widoczne (Notatki · Idee · Prezentacja · PDF)
□ Slot 5 — AI sekcja: kolor TEAL (bg-teal-50 border-teal-200 text-teal-700), NIE primary
□ Slot 6 — Fork (⎊): GitFork icon, tworzy kopię z tagiem "Forked from INX-XXXX"
□ Slot 7 — Present (▶): Monitor icon, uruchamia tryb prezentacji
□ Slot 9 — AI artefakt: solid teal (bg-teal-600 text-white), otwiera AI Consultant panel
□ ZERO primary (crimson) buttonów w toolbarze — crimson wyłącznie w CTA modalnych
□ Dark mode: wszystkie tokeny mają dark: odpowiedniki
```

**A4 — Left Navigation (NModeLeftNav)**

```
□ Wszystkie grupy sekcji wyświetlone w kanonicznej kolejności
□ Drag & drop działa wewnątrz grupy, nie przenosi między grupami
□ Aktywna sekcja podświetlona; klik w nav przełącza widoczną sekcję
     (UWAGA: canvas pokazuje JEDNĄ sekcję naraz — model "click-to-switch",
      nie scroll-all. Scroll-spy/IntersectionObserver NIE dotyczy tego layoutu;
      poniżej lg breakpointu nawigacja przechodzi do dropdownu Sections w toolbarze)
□ ✓ badge pojawia się na sekcjach z completed=true
□ Pasek postępu na dole: "completedCount / completableSections" widoczny
□ Pasek postępu pojawia się TYLKO gdy ≥ 1 sekcja ma completed=true (showProgress guard)
□ Pasek animuje się płynnie (transition-[width] duration-slow — 220ms max, scoped — nie `transition-all`/`duration-500`)
□ Sidebar collapse działa poprawnie na < 1024px
```

---

### BLOK B — Walidacja per karta

> Dla każdej sekcji w kanonie artefaktu przejdź przez poniższe punkty osobno.
> Przy code review oznacz numer karty przy każdym przebiegu (np. "B2 ✓ initiative-definition").

**B1 — Kontrakt karty (spec)**

```
□ Karta ma kompletny kontrakt w kanonie:
     inicjatywa — 10 pól: ID · Nazwa · Typ bloku · Opis · Pusty stan
                           · cSpan · cHidden · Badge · AI w sekcji · Eksport
     insight    — 11 pól: jak wyżej + Wymóg dowodu
□ Pole "Eksport" zdefiniowane — określa co i jak trafia do PDF/Prezentacji
□ Pole "Pusty stan" ma komunikat (pl + en) i CTA (nie pusty div)
□ Każdy blok ma przypisany typ z 12-type vocabulary
□ cSpan: wartość lub świadome pominięcie (1 = default, nie zapomniane)
□ cHidden: warunek lub świadome pominięcie (nie zapomniane)
```

**B2 — Nagłówek sekcji (NModeSectionWrapper)**

```
□ heading={{ en: '...', pl: '...' }} przekazany
□ Sekcje z AI w spec: aiAction lub aiActions przekazane
□ AI button kolor: teal (border-teal-200 text-teal-700 bg-teal-50), nie primary
□ Mark Complete visual:
     - border-l-2 border-success-500 na headerze sekcji
     - bg-success-50/40 tło headera
     - CheckCircle2 icon obok tytułu sekcji
     - Pola karty POZOSTAJĄ edytowalne (nie są disabled po mark complete)
```

**B3 — Typ bloku (12-type vocabulary)**

> **Naprawiono 2026-08-02:** ta checklista miała wcześniej WŁASNY zestaw 12 nazw (RichText, LabeledCard,
> BlockQuote, TagCloud, FileAttachment, CommentThread, ProgressRing, ScoreCard, SourcePack, Timeline…),
> sprzeczny z kanonicznym słownikiem w § 12 typów bloków (ProseBlock, LabeledCardGrid, QuoteItem…) — dwa
> konkurujące „kanony" w jednym pliku. Ujednolicono na jedną listę: nazwy poniżej = dokładnie 12 typów
> z § 12 typów bloków (przeczytaj tam pełną anatomię + spec Tailwind + eksport przed code review).

```
□ ProseBlock:     L1 nagłówek + separator, treść L3 max-w-prose, cytat inline (border-l-2 + Q level)
□ LabeledCardGrid: karta 2-kol grid, badge severity/status opcjonalny, hover scoped (border-color,box-shadow)
□ QuoteItem:      guillemets dekoracyjne, treść Q level, atrybucja L5, ★ dla top quote
□ DataTable:      zero pionowych linii, separator wierszy dashed, komórki numeryczne text-right tabular-nums
□ StatusList:     status dot/pill wg semantyki statusów, opis L4 wcięty pod tytułem L2
□ ScoreBar:       N (duża liczba) + progress bar (gradient red→amber→emerald) + skale L5
□ HeatmapMatrix:  komórki ●/○ z bg wg obecności/sentymentu, summary row (coverage) wyróżniony
□ MetricCard:     N + L4 jednostka + trend opcjonalny (↑ emerald / ↓ red)
□ TimelineItem:   linia pionowa + dot (AI = teal wyłącznie), timestamp L5, opis L4
□ FileCard:       ikona typu pliku per format, metadane L5, przyciski akcji ghost h-7
□ SessionRow:     ikona typu sesji, metadane L5 z separatorem „·", link „→" na hover
□ EmptyState:     ikona 24px + komunikat L3 + opis L4 opcjonalny + CTA — nigdy pusty div
□ ZAKAZ typów "custom" / "generic-text" gdy istnieje właściwy typ z listy 12
```

**Otwarte pytanie — nazwy z poprzedniej (usuniętej) listy bez odpowiednika w 12-type vocabulary:**
`TagCloud`, `CommentThread`, `ProgressRing`, `ScoreCard`. Zero wystąpień w `src/` (grep, 2026-08-02) i zero
w § 12 typów bloków. Kandydaci na przyszłość: `TagCloud` (tagi klikalne z overflow — brak dziś odpowiednika),
`ProgressRing` (wariant kołowy `ScoreBar` — dziś tylko liniowy pasek), `ScoreCard` (możliwy duplikat
`MetricCard`/`ScoreBar` — do rozstrzygnięcia, który jest właściwy), `CommentThread` (kanon mapowania kart,
wiersz `comments` w § Mapowanie kart do typów bloków, już przypisuje `StatusList (wątkowe)` — więc
`CommentThread` mógł być tylko synonimem, nie brakującym typem). Nie rozstrzygnięto greppem który wariant
jest zamierzony — decyzja należy do właściciela produktu, nie do tej rewizji.

**B4 — FieldAIButton (poziom pola)**

**SSOT:** `src/components/shared/NModeLayout/FieldAIButton.tsx`  
Import: `import { FieldAIButton } from '@/components/shared/NModeLayout';`

```
□ ✨ pojawia się przy każdym polu oznaczonym AI w spec karty
□ Loading state: Sparkles zastąpiony spinnerem (Loader2 animate-spin)
□ Disabled gdy sekcja ma completed=true lub pole jest locked
□ Wynik AI trafia do konkretnego pola (nie do clipboard, nie do toastu)
□ Wrapper rodzica musi mieć className="group" (hover reveal przez group-hover:opacity-100)
```

**B5 — Stany graniczne karty**

```
□ Empty state: ikona + komunikat (pl/en) + CTA widoczne (nie pusty biały obszar)
□ Loading state: skeleton loader (nie puste boxy, nie full-page spinner)
□ Error state: komunikat + przycisk "Spróbuj ponownie" (nie crash widoku)
□ Brak "flash of empty" przy ładowaniu — skeleton trzyma layout karty
```

---

### BLOK C — Architektura AI (trzy poziomy)

```
□ POZIOM 1 — POLE (FieldAIButton):
     Działa dla każdego pola z AI-in-spec
     Wynik wpisywany do konkretnego pola (nie ogólnie "do sekcji")

□ POZIOM 2 — SEKCJA (SectionAIButton):
     Teal button widoczny w headerze sekcji (NModeSectionWrapper)
     Wysyła kontekst aktywnej sekcji (nie całego artefaktu)
     Aktualizuje pola sekcji (nie przeładowuje widoku)

□ POZIOM 3 — ARTEFAKT (AI Consultant):
     Solid teal button w toolbarze — slot 9 (bg-teal-600 text-white)
     Panel po PRAWEJ stronie (nie modal, nie overlay na canvas)
     Kontekst = cały artefakt (wszystkie sekcje + metadata)
     Full synthesis: pytania, scenariusze, analiza luk

□ GENESIS (sekcje oznaczone ★ w kanonie):
     Wypełniane automatycznie przy tworzeniu artefaktu
     AI genesis nie blokuje — użytkownik edytuje natychmiast po wygenerowaniu
     Spinner / skeleton widoczny podczas genesis (nie pusty ekran)

     ⚠ **Świadoma luka (CANON.md §3.2):** ten dokument opisuje tylko widoczny
     efekt genesis (spinner/skeleton, brak blokady edycji). NIE rozstrzyga:
     idempotency retry (co jeśli użytkownik odświeży/dubluje request w trakcie
     generowania), partial failure (część sekcji wygenerowana, część padła),
     resume po odświeżeniu strony w trakcie genesis, ani Save draft/Cancel dla
     samego kroku generowania. Pełny kontrakt wizarda/generatora — zgodnie z
     `CANON.md` §8 i `UI_UX_IMPLEMENTATION_STANDARD.md` §8 — mieszka w
     `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` (kontrakt generatora).
     Nie traktować milczenia w tym miejscu jako "brak wymogu" — temat jest
     świadomie nierozstrzygnięty tutaj, nie pokryty.

□ MARK COMPLETE (AI signal):
     Kliknięcie zapisuje section_completions w DB (nie tylko w stanie UI)
     Pola sekcji NIE są disabled po mark complete
     AI level 2 pomija sekcje z completed=true w kolejnych sugestiach

□ KOLOR AI — reguła bezwzględna:
     Każdy AI button (wszystkie 3 poziomy) = TEAL WYŁĄCZNIE
     Brak primary (crimson) na jakimkolwiek AI affordance
```

---

### BLOK D — Persystencja i DB

```
□ Auto-save na blur: wszystkie pola tekstowe (nie tylko submit lub Enter)
□ Auto-save guard: wartość niezmieniona → request nie jest wysyłany
□ Optimistic UI: zmiana widoczna natychmiast, rollback (toast błędu) przy HTTP error

□ section_completions:
     - lazy ALTER TABLE ADD COLUMN przed pierwszym zapisem (getTableColumns() check)
     - typ kolumny: TEXT (JSON string), nie JSONB (kompatybilność SQLite + libSQL)
     - zapis: JSON.stringify({ "section-id": true, "other-section": false })
     - odczyt: JSON.parse() z fallback {} na null / undefined / ""

□ section_order:
     Personalna kolejność sekcji zapisana między sesjami (localStorage lub DB)

□ JSON_FIELDS (tags, custom_fields, itp.):
     stringify przy zapisie, parse przy odczycie
     Brak double-serialize (nie JSON.stringify(JSON.stringify(...)))

□ Brak orphan records:
     Usunięcie artefaktu kaskadowo usuwa powiązane dane (insights → sessions, itp.)
```

---

### BLOK E — Eksport

```
□ DESTYNACJE — wszystkie 4 działają:
     → Notatki:      tworzy nową notatkę z tytułem artefaktu + treścią kanoniczną
     → Idee:         dodaje kartę/node do aktywnej przestrzeni Idei
     → Prezentacja:  tworzy slide deck (1 sekcja = 1 slide, cSpan respektowany)
     → PDF:          generuje PDF, paginacja szanuje cSpan kart

□ KOLEJNOŚĆ EKSPORTU = kolejność kanoniczna (z kanonu artefaktu)
     NIE kolejność sidebarowa (drag w navie nie zmienia kolejności eksportu)

□ FILTRY EKSPORTU:
     Puste sekcje (EmptyState) → nie eksportowane
     cHidden=true → nie eksportowane

□ PER-KARTA:
     Pole "Eksport" z kanonu określa co jest renderowane
     Bloki bez eksport-definicji pomijane

□ PREZENTACJA — cSpan → slajd:
     cSpan 1 = pół slajdu (2-kol layout)
     cSpan 2 = pełny slajd (2-kol, duży content)
     cSpan 3 = pełny slajd (1-kol, duży font, hero card)
```

---

### BLOK F — QA wizualne (Harvard/McKinsey standard)

```
□ PALETA HARVARD/HBS:
     primary #85182F (Harvard Crimson) = wyłącznie CTA modalne ("Zapisz", "Zatwierdź")
     teal #00979D (HBS Teal)           = wyłącznie AI affordances
     success (green)                   = Mark Complete + pozytywne stany
     Brak niestandardowych kolorów poza design tokenami z tailwind.config

□ TYPOGRAFIA McKinsey — 5 poziomów (nie mniej, nie więcej):
     H1 — tytuł artefaktu:   text-2xl font-bold text-slate-900 dark:text-slate-50
     H2 — nagłówek sekcji:   text-lg font-semibold text-slate-800 dark:text-slate-100
     H3 — nagłówek karty:    text-base font-medium text-slate-700 dark:text-slate-200
     Body — treść:           text-sm text-slate-700 dark:text-slate-300
     Caption / meta:         text-xs text-slate-500 dark:text-slate-400
     Zakaz: text-xl, text-3xl, font-extrabold poza MetricCard value

□ SPACING McKinsey "air" (jedyna skala — patrz też § Reguły kompozycji wewnątrz SectionCard):
     gap-6 między kartami w sekcji
     space-y-6 wewnątrz sekcji (NModeSectionWrapper default)
     p-6 padding kart i paneli (default 24px; p-4/16px wyłącznie w density compact)
     Zakaz: gap-2, gap-4 tam gdzie spec mówi gap-6; zakaz p-5/gap-y-5 (20px) — nie jest wartością „padding karty" wg `FOUNDATION_TOKEN_CONTRACT.md` §2

□ GRADIENTY:
     Dozwolony: bg-gradient-to-br na głównym kontenerze widoku (tło)
     Zakaz: gradienty na kartach, buttonach, toolbarze, navie

□ DARK MODE:
     bg-white → dark:bg-navy-900 lub dark:bg-navy-800 (nie brak dark: klasy)
     text-slate-X → dark:text-slate-Y (odpowiedni poziom kontrastu)
     border-slate-X → dark:border-navy-X
     Sprawdź: toolbar, nav, karty, Properties Strip, modale — brak "białych dziur"

□ RESPONSIVE:
     < 1024px: sidebar collapse, lg:grid-cols-2 → grid-cols-1
     < 768px: Properties Strip collapse lub horizontal scroll
     Brak horizontal overflow na głównym canvasie (overflow-x-hidden na root)
```

---

> **Szybki checklist przed mergem (skrót dla code review):**
>
> 1. Toolbar sticky i teal AI? → A3
> 2. Żaden AI button nie jest crimson? → A3 + C
> 3. Każda karta ma empty state? → B5
> 4. Auto-save działa na blur (nie tylko Enter)? → D
> 5. section_completions: lazy ALTER zaimplementowany? → D
> 6. Eksport: kolejność kanoniczna, nie sidebarowa? → E
> 7. Dark mode: zero białych dziur? → F
> 8. Typy bloków z 12-type vocabulary (nie "custom text")? → B3

---

## Odniesienia

- [Canon inicjatyw](./INITIATIVE_CANON.md) — mapowanie bloków do kart inicjatyw
- [Canon insightów](./INSIGHT_CANON.md) — mapowanie bloków do kart insightów
- [TABLE_AND_PREVIEW_CANON.md](./TABLE_AND_PREVIEW_CANON.md) — standard list i tabel w widokach hub

---

## Changelog

| Data | Zmiana |
|------|--------|
| 2026-08-02 | **Panel adwersaryjny — 4 defekty naprawione (K-08…K-11).** K-08: zła ścieżka SSOT statusów `src/services/statusColors.ts` → poprawiona na realną `src/constants/statusColors.ts` (§ Fundament — Semantyka kolorów). K-09: DDL `section_completions` w § Persystencja poprawiony na zgodny z realnym kodem — tabela `interview_insights` (nie `insights`), kolumna `TEXT` (nie `JSONB`), bez `IF NOT EXISTS`/`DEFAULT`, osobno opisane `InterviewController.ts` i `InitiativeController.ts` (różne strategie sprawdzania istnienia kolumny). K-10: poprzedni wpis changelogu o naprawie motion Left Nav przeformułowany — kłamał, że zmieniono kod; naprawiono tylko specyfikację, `NModeLeftNav.tsx:470` nadal ma `transition-all duration-500` (otwarty dług, patrz wpis niżej). K-11: dwie sprzeczne listy „12 typów bloków" (§ 12 typów bloków vs BLOK B3) ujednolicone na jedną — § 12 typów bloków jako kanoniczna, z jawną notą że to słownik projektowy (żaden z 12 nie istnieje jako nazwany komponent w `src/`; realne warstwy komponentowe to `NModeBlocks/` i `cardBlockSchema.ts`/`CardBlockRenderer.tsx`, obie inne i nietożsame). BLOK B3 przepisany na te same 12 nazw; cztery nazwy z usuniętej listy (`TagCloud`, `CommentThread`, `ProgressRing`, `ScoreCard`) bez odpowiednika oznaczone jako otwarte pytanie z listą kandydatów, nie rozstrzygnięte. Weryfikacja: patrz zlecenie z panelu adwersaryjnego (K-08…K-11), każdy punkt sprawdzony poleceniem `grep`/odczytem kodu. |
| 2026-08-02 | **Motion — poprzedni wpis poprawiony (nieprawdziwy: sugerował naprawę kodu).** Ta rewizja zmieniła wyłącznie **specyfikację w tym dokumencie** (agent miał zakaz dotykania `src/`): `LabeledCardGrid` hover-spec i pasek postępu Left Nav (A4) w tekście kanonu dostały docelowe klasy `transition-[border-color,box-shadow] duration-base` (180ms) / `transition-[width] duration-slow` (220ms max) zamiast `transition-all`/`duration-500`. **Runtime nie został tknięty**: `src/components/shared/NModeLayout/NModeLeftNav.tsx:470` nadal ma `transition-all duration-500` (zweryfikowano `grep -n "transition" NModeLeftNav.tsx`, 2026-08-02) — to jest **otwarty dług**, nie naprawiony bug. `LabeledCardGrid` jako taki nie ma literalnego odpowiednika w `src/` (patrz § 12 typów bloków — nota o realnym słowniku), więc dla niego zmiana też jest czysto specyfikacyjna. `npm run lint:motion:ci` (`server/scripts/check-motion-compliance.ts`) istnieje i liczy globalny dług (`docs/ui-standards/.motion-baseline.json`), ale nie potwierdza naprawy tego konkretnego miejsca. |
| 2026-08-02 | **Ujednolicona skala odstępów.** Usunięto sprzeczność między § Reguły kompozycji wewnątrz SectionCard (dawniej `p-5`/`gap-y-5`, 20px) a BLOK F (`p-6`/`gap-6`/`space-y-6`, 24px). Rozstrzygnięcie: padding karty = 24px default (`p-6`) / 16px compact (`p-4`), zgodnie z `FOUNDATION_TOKEN_CONTRACT.md` §2. `ProseBlock` spacing między sekcjami: `gap-y-5` → `gap-y-6`. |
| 2026-08-02 | **Usunięty crimson jako akcent.** Trzy wystąpienia `primary-*` w roli dekoracyjnej/stanu, nie marki: `QuoteItem` lewy akcent top quote `border-primary-400` → `border-c-border` (neutralny); `TimelineItem` dot AI akcji `bg-primary-400` → `bg-teal-500 dark:bg-teal-400` (AI = teal wyłącznie); `SessionRow` link `→` `text-primary-500` → `text-slate-500 dark:text-navy-400` (neutralny). `primary-*` = crimson `#85182F`, dozwolony wyłącznie jako znak marki / Talk-to-Teresa / semantyka destrukcyjna — nigdy jako fokus/stan aktywny/akcent. |
| 2026-08-02 | **Oznaczona świadoma luka kontraktu generatora.** Sekcja GENESIS (BLOK C) uzupełniona notą: ten dokument nie rozstrzyga idempotency retry, partial failure, resume po odświeżeniu ani Save draft/Cancel dla kroku generowania — zgodnie z `CANON.md` §3.2 („Luka w standardzie = oznaczona jawnie… nie wypełniana nowym samowolnym plikiem"). Pełny kontrakt wizarda/generatora (`CANON.md` §8, `UI_UX_IMPLEMENTATION_STANDARD.md` §8) mieszka w `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`. |
