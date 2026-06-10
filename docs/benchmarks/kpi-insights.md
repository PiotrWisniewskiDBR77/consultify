---
brief: kpi-insights
module: KPI/OKR + Insights
sources: [Quantive (help.quantive.com), Perdoo (support.perdoo.com + perdoo.com), Workboard (learn.workboard.com), Looker (cloud.google.com/looker/docs), Tableau (help.tableau.com), Databox (help.databox.com) — scrape 2026-03]
status: done
grounding: scrape   # zrewidowane na realnej treści scrape'a 2026-06-10; Tableau cienki (tylko docs API), reszta bogata
updated: 2026-06-10
---

# Benchmark: KPI/OKR + Insights

> Po co: rozdzielić i poprawnie zaprojektować dwa różne światy, które dziś mieszamy —
> (a) **zarządzanie celami (OKR/KPI)** spięte z Inicjatywami, oraz (b) **insighty/dashboardy**
> (analityka). To dwie różne doktryny danych; benchmark mówi, co od kogo wziąć.

## 1. Krajobraz konkurencji

| Narzędzie | Klasa | Pozycjonowanie | Killer feature (potwierdzone w docs) |
|---|---|---|---|
| **Quantive** (d. Gtmhub) | OKR + KPI + Insights | „Strategy execution" na OKR; KPI jako osobny moduł | **Insightboards** (kodowane SQL+HTML lub codeless z data-source) → **Automated/dynamic Key Results** zasilane z 170+ systemów |
| **Perdoo** | OKR + KPI | Strategy Execution; KPI i OKR rozdzielone metodycznie | **Strategy Map** + **KPI Boards** per Strategic Pillar; doktryna „KPI = BAU/health, OKR = change" |
| **Workboard** | OKR (enterprise) | Strategy execution + „digital operating rhythm" | **Scorecards** (jedna strona, reuse na każde spotkanie) + **Business Reviews** + **Co-Author** (GenAI piszący OKR-y) |
| **Tableau** | BI | Eksploracyjna wizualizacja (VizQL) | Scrape = warstwa **developer/API** (VizQL Data Service, Explore-in-Tableau API, Metadata/Embedding API) — nie UI eksploracji |
| **Looker** | Modelowany BI | Semantyczna warstwa LookML + Gemini | **LookML** (definicja metryki raz) + **Explores** (drill bez SQL) + **Conversational Analytics** (NL) |
| **Databox** | KPI dashboards | Lekkie dashboardy/databoardy KPI z wielu źródeł | **Metric block** = wartość + cel + delta + compare-to-period; Goals + scorecardy mobilne |

Wniosek: **Perdoo** daje doktrynę (KPI≠OKR), **Quantive** wzorzec auto-zasilanych metryk + osobny moduł KPI,
**Looker** semantyczną warstwę metryk, **Databox** kartę-metrykę, **Workboard** rytuał przeglądu (scorecard),
**Tableau** — z tego scrape'a tylko warstwę API (nie aspirujemy do silnika eksploracji BI w v1).

## 2. Wzorce UX / IA (co działa)

- **Perdoo — twardy rozdział KPI vs OKR (potwierdzone w treści):** KPI to „business as usual / health"
  (sekcja *„KPIs by status: How's your business as usual performing?"* — niezdrowe KPI klikasz „Unhealthy" →
  filtrowana lista), OKR to zmiana w czasie. Marketing wprost: *„Create an OKR to improve a KPI"*. KPI Boards
  buduje się per **Strategic Pillar**, z targetami na przyszłość. → `assets/kpi-insights/03-perdoo-performance-dashboard.png`
  (jeden dashboard: *OKRs progress over time* + gauge *OKRs overall progress 38% vs expected 48%* + *OKRs by status* +
  *Goals count: Objectives/Key Results/Initiatives* + **osobny pie *KPIs by status*** + per-team breakdown).
  → u nas: KPI to osobny byt „health metric", a nie to samo co Key Result inicjatywy.
- **Quantive — karta KPI z pełną definicją (potwierdzone, screen):** tworzenie KPI to formularz z polami
  *Owner, Permissions, Summarize with (Last Value/Sum/Average), Unit, Decimal places, Direction (More/Less is better),
  Add to group* + przycisk **Automate** (dynamic KPI z insightu). Kolor komórki KPI liczony względem poprzedniego
  wpisu wg Direction. → `assets/kpi-insights/01-quantive-create-kpi.png` — to niemal 1:1 nasza specyfikacja schematu metryki.
- **Quantive — Insightboards + Marketplace:** Insight = widget kodowany (SQL na predefiniowanych encjach
  `quantiveresultsgoals/metrics/users` + szablon HTML z `<metric>`), ALBO codeless z data-source. Jest **Marketplace**
  z gotowymi insightami i **8 pre-built Insightboards „one-click"**. Z insightu robisz Automated KR:
  hover „green dot" → *„Add this number as a target"* → *Add as Key result*. → wzorzec „Insight → metryka → cel".
- **Databox — scorecard/metric block (potwierdzone, screen):** jedna kafelka = wartość (np. **85**) + **delta (▼39%)**
  + **Compare: 139** (poprzedni okres) + źródło (HubSpot) + zakres dat. → `assets/kpi-insights/04-databox-databoard.png`
  — wzorzec naszej karty KPI: wartość + cel + delta + compare-to-period + sparkline.
- **Looker — eksplorka na modelu (potwierdzone w nawigacji docs):** użytkownik drąży **Explore** (dimensions/measures)
  bez pisania SQL, bo metryka zdefiniowana raz w **LookML**; dochodzi **Conversational Analytics** (pytanie w języku
  naturalnym) i „Write LookML using natural language" (Gemini). → wzorzec dla „Insight drill-down".
- **Workboard — Scorecard jako rytuał:** jedna strona, „bez kopiowania danych i bez rozjazdu z prawdą", zbudowana raz
  i reużywana na każde spotkanie (Business Reviews / operating rhythm), z kolorami brandu. → wzorzec naszego
  „one-page przegląd inicjatyw/KPI".

## 3. Model danych / architektura
- **Trzy encje, nie jedna (skorygowane vs poprzednia wersja):**
  - `KPI/Metric` = definicja (źródło, **summarize: last/sum/avg**, jednostka, decimal, **direction good=up/down**, cel,
    **projekcja/target line**) + szereg czasowy. U Quantive to *osobny moduł* (manual lub dynamic), nie podtyp KR.
  - `Objective/KeyResult` = zmiana z terminem, podpięta do Inicjatywy; **KR może być „automated" — referuje Insight lub KPI**
    i aktualizuje się sam (Quantive: KR ← Insight ← data-source / KPI).
  - `Insight/Insightboard` = wniosek/widget liczony z danych (SQL+HTML lub codeless), grupowany w board; źródło wartości dla KR.
- **Semantyczna warstwa metryki (Looker LookML, potwierdzone):** metryka (dimension/measure) zdefiniowana RAZ w modelu,
  użyta w wielu Explore'ach/dashboardach — zero rozjazdu definicji. Nasz odpowiednik „jednej prawdy" z `CARD_CONTENT_FORMULA`.
- **Auto-zasilanie (Quantive/Databox, potwierdzone):** „Automated Key Results connect to an Insight and are updated
  automatically" — UWAGA: *automated KR nie aktualizuje się poza datami sesji*. Databox/HubSpot itp. wnoszą wartość przez konektor.
- **Tagowanie zamiast sztywnych grup (Quantive KPI 2.0 beta):** KPI Groups **zdeprecjonowane → Tagi**; grid grupowalny po tagu,
  filtry po owner/tag/okres, **Saved & Shared views**. → dla nas: KPI organizujemy tagami + zapisywalne widoki, nie sztywną hierarchią.
- **Rollup bottom-up:** progres celu liczony z KR i child-objectives (Quantive: średnia KR + child-objectives), spójne z `projects-initiatives.md`.

## 4. API / integracje
- Konektory danych = wspólne z `integrations.md` (connector→trigger→action→mapping). KPI/Insight to konsument tej warstwy
  (Quantive: 170+ systemów; data-source „Quantive jako źródło" jest immutable/read-only).
- Wzorzec „metric snapshot": okresowy zapis wartości (cron/webhook) do szeregu czasowego, idempotentny po (metricId, period).
- **Tableau z tego scrape'a = wzorzec embeddowania/API, nie UI:** Explore-in-Tableau API (TDS → URL sesji web-authoring),
  VizQL Data Service, Metadata/Embedding API. Jeśli kiedyś integrujemy zewnętrzny BI, to ten kontrakt jest wzorcem.
- **Warstwa AI/NL u wszystkich OKR/BI:** Looker (Conversational Analytics), Workboard (Co-Author OKR), Quantive
  (Platform Intelligence: suggested KR/description/tasks) — potwierdza kierunek Teresy jako asystenta nad metrykami/celami.

## 5. Decyzje dla Consultify
- ✅ **Kradniemy (Perdoo):** twardy rozdział **KPI (health/BAU) vs Key Result (change)** + „OKR poprawia KPI" — porządkuje moduł i spina z Initiative Formula.
- ✅ **Kradniemy (Quantive):** **schemat karty KPI 1:1** (owner, summarize last/sum/avg, unit, direction more/less-is-better, target/projekcja, tagi) + manual vs dynamic.
- ✅ **Kradniemy (Looker):** **semantyczna warstwa metryki** — definicja raz, użycie wszędzie (spójne z ontologią z `enterprise-aip.md`).
- ✅ **Kradniemy (Databox):** kartę-scorecard: wartość + cel + delta + **compare-to-period** + trend; mobilna, czytelna od razu.
- ✅ **Kradniemy (Quantive):** auto-aktualizacja KR z Insight/konektora — KR „żyje" (z guardrailem: tylko w oknie sesji).
- ✅ **Kradniemy (Workboard):** **Scorecard jako rytuał przeglądu** — jedna strona reużywana na spotkania, bez kopiowania danych.
- ⚠️ **Adaptujemy:** drzewo alignmentu OKR → nasz model Inicjatywa↔KPI (nie kopiujemy korporacyjnej hierarchii zespołów 1:1).
- ⚠️ **Adaptujemy:** Insightboard Quantive — ale **bez wymogu SQL+HTML od użytkownika** (u nich custom insight wymaga PostgreSQL+HTML); u nas kuratorowane karty/codeless, kod tylko dla power-userów.
- ❌ **Unikamy:** budowy własnego Tableau/Looker (silnik eksploracji BI) — to nie nasza altituda; Insights = kuratorowane karty + drill-down, nie self-service BI.
- ❌ **Unikamy:** mieszania KPI i Insight-card w jeden byt — KPI to metryka z celem, Insight to wniosek/narracja (różne formuły treści, vide §3).

## 6. Otwarte pytania
- Czy KPI to osobny moduł (jak w Quantive/Perdoo), czy zakładka w Insights + pole w Inicjatywie? (rekomendacja: encja `Metric` współdzielona, prezentowana w obu).
- Granica „Insights" (analiza z audytów/wywiadów) vs „KPI" (metryki ciągłe) — gdzie kończy się jedno; czy Insight zasila KPI (jak w Quantive)?
- Skąd realne dane metryk u klienta DRD/konsultingowego — ręczny wpis (manual KPI) vs konektor (większość celów transformacyjnych nie ma API).
- Czy idziemy w tagi + zapisywalne widoki (Quantive KPI 2.0) zamiast sztywnych grup od razu w v1?

## Załączniki
Zrzuty (realne UI) w `assets/kpi-insights/`:
- `01-quantive-create-kpi.png` — formularz „Create new KPI" (summarize/unit/direction/automate/group) = wzorzec schematu metryki.
- `03-perdoo-performance-dashboard.png` — Performance dashboard z **osobnym pie „KPIs by status"** obok OKR-ów = wizualny dowód rozdziału KPI/OKR.
- `04-databox-databoard.png` — edytor databoardu z metric-blockiem (85 / ▼39% / compare 139 / HubSpot) = wzorzec karty-scorecard.

Surowe źródło: `Softs/0 KPI/{ QUANTIVE, QUANTIVE 2, PERDOO 1/2, WORKBOARD 1/2, Databox, Looker, Lookre 2, Looker 3, tableau, tableasu 2}`.

Uwagi do źródeł:
- **Quantive** = najbogatsze: pełny help (KPI module, KPIs 2.0 beta, Insightboards, Automated KR, data-sources, KPI projections). Realne screeny produktu (Intercom CDN).
- **Perdoo** = support (Intercom) + marketing; mocne na doktrynie KPI vs OKR (Performance dashboard, „KPIs by status", Strategy Map/KPI Boards). Screeny CleanShot realne.
- **Workboard** = learn.workboard.com (Skilljar, kursy) — koncepty Scorecards / Business Reviews / Co-Author GenAI; screeny produktu głównie `.avif` (pominięte na rzecz mocniejszych PNG).
- **Looker** = docs Google Cloud (LookML, Explores, Gemini/Conversational Analytics) — nawigacja bogata, mocna na semantycznej warstwie.
- **Tableau** (`tableau`, `tableasu 2`) = wyłącznie **developer/API docs** (VizQL Data Service, Explore-in-Tableau, Metadata/Embedding) — brak UI eksploracji; do warstwy integracyjnej, nie UX.
- **Looker 3** / **Lookre 2** = ten sam wendor (Google Looker docs), różne podzbiory; nie odrębne narzędzia.
</content>
