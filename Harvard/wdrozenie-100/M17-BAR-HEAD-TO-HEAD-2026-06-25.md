# M17 — KROK ZEROWY: BAR PIĘKNA (head-to-head) · 2026-06-25

> **Po co:** handoff §11 krok 2 — „NIE budować szeroko, póki bar nieustalony". Ten dokument USTALA mierzalny bar przez realne porównanie: nasz silnik premium (Sonnet) vs realna Gamma DBR77, ten sam brief (diagnoza gotowości firmy produkcyjnej na AI). Wykonane autonomicznie (CTO), do finalnej akceptacji Piotra na oczy.

## Materiały do porównania (na dysku)
| Strona | Plik | Co to |
|---|---|---|
| **NASZ** raport | [`runs/2026-06-24-AI-readiness-PREMIUM.docx`](../../docs/qa/deliverables/runs/2026-06-24-AI-readiness-PREMIUM.docx) (69 KB) | Word, mózg premium ON, realna treść |
| **NASZ** model | [`runs/2026-06-24-AI-readiness-PREMIUM.xlsx`](../../docs/qa/deliverables/runs/2026-06-24-AI-readiness-PREMIUM.xlsx) (7 KB) | Excel, 3-statement |
| **NASZ** deck | (JSON 14 slajdów — **brak renderu PPTX**, patrz F4.1) | tylko plan/JSON |
| **GAMMA** deck | [`runs/2026-06-25-GAMMA-AI-readiness-HEADTOHEAD.pptx`](../../docs/qa/deliverables/runs/2026-06-25-GAMMA-AI-readiness-HEADTOHEAD.pptx) (22 MB) | 10 slajdów, branded DBR77, online: gamma.app/docs/xseikmkzkmxxcdq |

## WERDYKT (mierzalny)

### Gdzie Gamma BIJE nas DZIŚ (to jest bar do pobicia)
1. **Tytuły-headline'y** — Gamma: „Indeks Gotowości AI: 58/100", „Firmy Produkcyjne w Polsce i CEE Stoją Przed Dylematem AI". **Nasz deck: tytuły S1/S3 to całe akapity ~60 słów** — łamią doktrynę action-title. → **defekt F1.1**.
2. **Chipy sekcji** — każdy slajd Gammy ma label-kategorię (Streszczenie Wykonawcze / Metodyka / Wyniki / Rekomendacje…). Silna architektura informacji. My nie mamy. → **F3**.
3. **Arsenał smart-layoutów** — Gamma użyła: `barStats` (5 wymiarów gotowości jako paski %), `timeline` (3-fazowa roadmapa landscape), `arrows` (land-and-expand), `processSteps` (numerowane następne kroki), `stats` (KPI-kafle), `iconsText` (5 wymiarów z ikonami), auto-`infographic` macierz 2×2 wpływ/wysiłek, tabela ryzyk 4-kol. **To dokładnie arsenał z handoff §5A (≥20 archetypów).** My mamy `composition` (regiony) ale renderer tego nie pokazuje wizualnie. → **F3 + F11 (wykresy)**.
4. **Branding** — logo DBR, motyw (Montserrat/Heebo, fiolet/aurora), obrazy AI per slajd (flux-2-klein, fabryka). → **F8 brand-ingestion + F9 obrazy**.
5. **Renderuje się do realnego PPTX** — otwiera się w PowerPoint. **My nie mamy renderu decka w ogóle.** → **F4.1 = bloker uczciwego porównania wizualnego decka**.

### Gdzie MY bijemy Gammę (nasz moat — utrzymać)
1. **Liczby ugruntowane, nie zmyślone.** Gamma wymyśliła: „72% firm CEE", „n=47 respondentów", „ROI w 8 miesięcy", „redukcja 25–35%" — plauzybilne ale FIKCYJNE, nieidentyfikowalne do źródła. Dla realnej faktury klienta to ryzyko. Nasz silnik kotwiczy w SPINE/FinancialEngine. → **moat F10 provenance**.
2. **Finanse klasy CFO.** Mamy 3-statement, LTV/CAC 4.15×, Rule of 40 = 71, scenariusze bull/base/bear EBITDA, ARR bridge, payback. Gamma finansowo płytka. → **utrzymać**.
3. **Czerpie z realnych artefaktów org** (insight/inicjatywa/decyzja/KPI) — Gamma jest generyczna. To „prezentuje NAJLEPSZE DANE" z wizji §1.

### Defekty danych wykryte przy okazji (→ bramka treści F1.4)
- **`keyMessage: "8 200 000 thousands EUR"`** w deck JSON — błąd jednostek (mnożnik „thousands" doklejony do już-pełnej liczby). → bug w `formatHero`/`buildMarketSizing` (unit z LLM niesanityzowany).
- **„ARR rośnie do 0 PLN w 2027"** (regen 2026-06-25) — zdegenerowany hero-number (ARR=0) trafia na slajd. **Bramka treści F1.4 musi odrzucać hero=0/None.**
- **„LTV/CAC 19.2×, payback 3.13 mies"** — nierealna ekonomika (zdrowe LTV/CAC = 3–5×). Model przyjął skrajne drivery z LLM. → walidator zakresów w CFO-review.
- **Zmienność run-to-run**: TAM skacze 1,2 mld EUR ↔ 1,8 mld PLN między runami tego samego briefu — LLM swobodnie regeneruje założenia. → potwierdza potrzebę **księgi faktów / groundingu (F10)**.

### Status realizacji (po wykryciu git-race 2026-06-25)
Równolegle inny agent na `feat/deliverables-w1` domknął bazowe **F1.1** (`d7974eb65c` — wpięcie defaultów w B1/B3/B4: paleta, minDistinctLayouts, register, seedRows), **F1.3** (`272defef75` — beauty gate VisionQA), **F1.4** (`a541716252` — content gate: skaner placeholderów + spójność hero-numbers).
**Moja unikalna, NIEpokryta dokładka (ten commit):** klamra action-title (`maxWordsPerTitle` + `clampActionTitle` w SPINE) — **jedyna naprawa defektu #1 bara (tytuły-akapity)**, której bazowe F1.1 nie ruszyło; + gęstość prozy w `documentBlockContentGenerator` (komplementarna do ich `documentStructureGenerator`). Zweryfikowane live: S1/S3/S13 zwięzłe, hardcode'owane tytuły nietknięte.
**Uwaga infra:** gałąź ma ~110 błędów tsc (baseline WIP innych agentów, 0 w moich plikach) — do osobnego sprzątania.

## BAR (definicja „done" dla decka premium)
> **Gamma-level polish (punchy tytuły + chipy sekcji + bogaty arsenał smart-layoutów + branding + realny PPTX) NA WIERZCHU naszej ugruntowanej, CFO-grade treści.** Pojedynczy slajd ma wyglądać jak think-cell/McKinsey, a każda liczba ma mieć źródło.

To potwierdza strategię handoff §5: Gamma piękna ale **generyczna i samowtórna** — wygrywamy (A) bogatszym arsenałem + (B) kompozycją + **ugruntowaniem treści**.

## CO Z TEGO WYNIKA DLA KOLEJNOŚCI FAZ (rewizja)
Bar pokazał, że **wizualny deck to nasza największa luka**. Rekomendowana korekta kolejności:
1. **F1.1** — defaulty + **enforce maxWordsPerTitle** (napraw akapity-tytuły) — tani, natychmiastowy zysk jakości.
2. **F4.1** — **PPTX render z wiązki** (PODNIEŚĆ priorytet — bez tego nie ma uczciwego porównania wizualnego ani „pobierz komplet").
3. **F3** — chipy sekcji + rejestr motywów + gramatyka układu §5B (arsenał archetypów = serce przewagi).
4. **F11** — silnik wykresów (barStats/timeline/2×2/waterfall) — Gamma to ma auto, my musimy dorównać.

## Bramka wstępna (nadal ⛔ Piotr)
- `ENABLE_DELIVERABLES_PREMIUM=true` na Railway demo — bez tego user widzi placeholdery (lokalnie/harness premium DZIAŁA, dowód powyżej).
- Klucze obrazów (`GEMINI_API_KEY`) — F9.

_Koszt head-to-head: 68 kredytów Gamma (z konta DBR, pozostało 4629)._
