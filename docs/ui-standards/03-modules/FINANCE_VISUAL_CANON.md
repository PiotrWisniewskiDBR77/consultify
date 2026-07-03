# FINANCE VISUAL CANON — standard graficzny M16 Finanse

> Jeden kanon dla WSZYSTKICH wizualizacji finansowych M16 (wycena, decyzje, wartość, planowanie). Spójna semantyka kolorów + reużywalne prymitywy + wzorzec panelu. Część rodziny `CANON.md` / Visual Standard v1 / `TABLE_AND_PREVIEW_CANON.md`. Cel: poziom Gamma/McKinsey-grade. Stan: 2026-06-24 (F0).

## 1. SEMANTYKA KOLORÓW (znaczeniowa, nie dekoracyjna)
Tokeny CSS z Visual Standard v1; kolor NIESIE znaczenie:
| Token | Znaczenie | Tailwind (light) |
|--|--|--|
| `--fin-positive` | on-track · favorable · realized · zysk · go | `emerald-500/600` |
| `--fin-warning` | at-risk · uwaga · poniżej progu | `amber-500` |
| `--fin-negative` | missed · unfavorable · leakage · strata · kill | `rose-500/600` |
| `--fin-progress` | in-progress · committed · focus | `blue-500/600` |
| `--fin-baseline` | baseline · neutral · plan | `slate-300/400` |
| `--fin-accent` | wartość zaksięgowana · target | `violet-500` |
**Reguła czerwieni:** `--fin-negative` TYLKO dla realnej straty/przekroczenia/kill — nigdy dekoracyjnie (budżet czerwieni, Visual Standard v1).

## 2. WZORZEC PANELU FINANSOWEGO (każda powierzchnia M16)
Każda zakładka/panel = ta sama struktura:
```
┌ Panel (rounded-xl border bg-white p-4, data-testid="<name>-panel") ┐
│  Nagłówek (h3 text-sm font-semibold) + badge stanu (prawa)         │
│  KPI-strip (2-4 metryki, label + wartość + sparkline opcjonalnie)  │
│  GŁÓWNY WYKRES KANONICZNY (jeden z §3)                             │
│  Tabela drill-down (TABLE_AND_PREVIEW_CANON) — opcjonalnie         │
│  Akcje (przyciski) — opcjonalnie                                   │
└────────────────────────────────────────────────────────────────────┘
```
Każdy panel: flaga `ff_*` (default OFF), fail-soft (try/catch + notka), busy-state, `data-testid`.

## 3. PRYMITYWY KANONICZNE (biblioteka `src/components/Economics/charts/`)
Wszystkie: czysty SVG (bez ciężkich libów), responsywne (viewBox), props-driven, `data-testid`, accessible (aria-label), kolory z §1. Każdy = osobny komponent + test.

| Prymityw | Komponent | Wejście (props) | Użycie (zadania) |
|--|--|--|--|
| **Waterfall** | `FinanceWaterfall` | `steps:[{label,value,kind:'start'\|'increase'\|'decrease'\|'total'}]` | value bridge (3.1), variance bridge (5.1), attribution (2.4) |
| **Football Field** | `FootballField` | `ranges:[{label,low,mid,high}], point?` | wycena triangulacja (1.2) |
| **Sensitivity Heatmap** | `SensitivityHeatmap` | `xLabels[], yLabels[], matrix:[{x,y,value}], baseX?, baseY?` | sensitivity WACC×g (1.3), data-table (5.4) |
| **Tornado** | `TornadoChart` | `bars:[{label,low,high}], base` | wrażliwość 1-zm. (5.4), Monte Carlo drivers |
| **Bubble** | `PortfolioBubble` | `points:[{id,x,y,size,color,label}], quadrants?` | portfel NPV×ryzyko (4.2, 4.3) |
| **Histogram** | `DistributionHistogram` | `samples[]\|bins[], markers:[{value,label}]` | Monte Carlo NPV (4.5) |
| **Efficient Frontier** | `EfficientFrontier` | `curve:[{risk,value}], current?, optimal?` | frontier (4.7) |
| **S-curve** | `SCurve` | `plan:[{t,cum}], actual:[{t,cum}]` | realizacja wartości (2.6, 3.5) |
| **Sankey** | `GoldenThreadSankey` | `nodes[], links:[{source,target,value}], orphans?` | złota nić inicjatywa→KPI→wartość (2.2) |
| **Bullet** | `BulletChart` | `baseline,target,forecast?,actual,max` | baseline-target-realized per KPI (2.1) |
| **VaR Heatmap** | `RiskHeatmap` | `rows[], cols[], cells:[{r,c,intensity}]` | value-at-risk (2.7) |
| **Driver Tree** | `DriverTree` | `root:{label,value,formula?,children[]}` | driver-based planning (5.3) |
| **Scenario Fan** | `ScenarioFan` | `base[], bands:[{label,lo,hi}]` | scenariusze/forecast (5.2, 6.2) |
| **Runway Gauge** | `RunwayGauge` | `cashCurve:[{t,cash}], minCash` | cash/liquidity (6.4) |
| **Decision Tree** | `DecisionTree` | `root:{kind,p?,payoff?,children[]}` | real options (4.6), stage-gates (3.3) |

## 4. KONWENCJE WSPÓLNE
- **Format liczb:** waluta z separatorem tys. + skala (k/M/mld); % z 1 miejscem; ujemne w nawiasach lub ze znakiem + kolor `--fin-negative`.
- **Tooltip:** każda seria/słupek/komórka ma hover z dokładną wartością + kontekstem (label, okres, delta vs base).
- **Pusty stan:** „Brak danych — <akcja>" zamiast pustego SVG.
- **Legenda:** gdy >1 seria; pozycja góra-prawo; kliknięcie toggluje serię.
- **Drill-down:** klik elementu → callback `onSelect(id)` (panel pokazuje tabelę/szczegół).
- **Eksport:** każdy wykres → PNG/SVG (do decku/raportu) — spójne z generatorami deliverables.
- **Dark mode:** wszystkie tokeny mają wariant dark (`dark:`); kontrast WCAG AA.

## 5. ZGODNOŚĆ
Nowe komponenty NIE łamią `CANON.md` (typografia/spacing/focus) ani `TABLE_AND_PREVIEW_CANON.md` (tabele drill-down). Czerwień wg budżetu czerwieni. Każdy nowy wykres w M16 MUSI być jednym z §3 lub rozszerzać kanon (PR aktualizuje ten plik).
