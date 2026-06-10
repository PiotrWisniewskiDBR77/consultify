---
brief: kpi-insights
module: KPI/OKR + Insights
sources: [Quantive, Perdoo, Workboard, Looker, Tableau, Databox (scrape 2026-03)]
status: done
grounding: knowledge   # scrape był zablokowany przez macOS TCC w trakcie sesji — patrz §Załączniki; do re-dystylacji na realnej treści
updated: 2026-06-10
---

# Benchmark: KPI/OKR + Insights

> Po co: rozdzielić i poprawnie zaprojektować dwa różne światy, które dziś mieszamy —
> (a) **zarządzanie celami (OKR/KPI)** spięte z Inicjatywami, oraz (b) **insighty/dashboardy**
> (analityka). To dwie różne doktryny danych; benchmark mówi, co od kogo wziąć.

## 1. Krajobraz konkurencji

| Narzędzie | Klasa | Pozycjonowanie | Killer feature |
|---|---|---|---|
| **Quantive** (d. Gtmhub) | OKR | Strategy execution na OKR | Insights/connectors auto-aktualizujące Key Resulty z danych |
| **Perdoo** | OKR | OKR + KPI rozdzielone metodycznie | Jasny podział KPI (health) vs OKR (change) + drzewo strategii |
| **Workboard** | OKR | Enterprise strategy execution | Biznesowe przeglądy (business reviews) + alignment góra-dół |
| **Tableau** | BI | Eksploracyjna wizualizacja danych | VizQL — interakcyjna eksploracja, dashboardy klasy enterprise |
| **Looker** | BI | Modelowany BI (LookML) | Semantyczna warstwa LookML — jedna definicja metryki dla całej firmy |
| **Databox** | KPI dashboards | Lekkie dashboardy KPI z wielu źródeł | Gotowe konektory + mobilne scorecardy + cele na metryce |

Wniosek: **Perdoo** daje nam doktrynę (KPI≠OKR), **Quantive** wzorzec auto-zasilanych metryk, **Looker** semantyczną warstwę metryk, **Databox** lekkość i scorecard, **Tableau** poziom eksploracji do którego NIE aspirujemy w v1.

## 2. Wzorce UX / IA (co działa)
- **Perdoo — rozdział KPI vs OKR:** KPI = ciągłe „zdrowie" (utrzymać poziom), OKR/Inicjatywa = zmiana w czasie. → u nas: KPI to osobny byt „health metric", a nie to samo co Key Result inicjatywy.
- **Quantive/Workboard — drzewo alignmentu:** cele firmy → zespołu → osoby z widoczną kontrybucją. → mapuje się na nasz `convergence point` inicjatywy (Kaplan-Norton w danych).
- **Databox — scorecard + metryka z celem i trendem:** jedna kafelka = wartość + cel + delta + sparkline. → wzorzec naszej karty KPI w Insights.
- **Looker — eksplorka na modelu:** użytkownik drąży metrykę bez pisania SQL, bo metryka zdefiniowana raz. → wzorzec dla „Insight drill-down".

## 3. Model danych / architektura
- **Dwie encje, nie jedna:**
  - `KPI/Metric` = definicja (źródło, agregacja, jednostka, kierunek good=up/down, cel, próg) + szereg czasowy wartości.
  - `Objective/KeyResult` = zmiana z terminem, podpięta do Inicjatywy; KR może *referować* metrykę (current value z KPI).
- **Semantyczna warstwa metryki (od Looker):** metryka zdefiniowana RAZ (formuła + źródło), używana w wielu kartach/dashboardach — zero rozjazdu definicji. To nasz odpowiednik „jednej prawdy" z `CARD_CONTENT_FORMULA`.
- **Auto-zasilanie (od Quantive/Databox):** wartość metryki z konektora (patrz `integrations.md`), nie ręcznie — KR aktualizuje się sam.
- **Rollup bottom-up:** wartości celów składają się w górę drzewa (Monday/Workboard) — spójne z `projects-initiatives.md`.

## 4. API / integracje
- Konektory danych = wspólne z `integrations.md` (connector→trigger→action→mapping). KPI to konsument tej warstwy.
- Wzorzec „metric snapshot": okresowy zapis wartości (cron/webhook) do szeregu czasowego, idempotentny po (metricId, period).

## 5. Decyzje dla Consultify
- ✅ **Kradniemy (Perdoo):** twardy rozdział **KPI (health) vs Key Result (change)** — to porządkuje cały moduł i spina się z Initiative Formula.
- ✅ **Kradniemy (Looker):** **semantyczna warstwa metryki** — definicja raz, użycie wszędzie; metryka jako obiekt (spójne z ontologią z `enterprise-aip.md`).
- ✅ **Kradniemy (Databox):** kartę-scorecard: wartość + cel + delta + trend; mobilny, czytelny na pierwszy rzut oka.
- ✅ **Kradniemy (Quantive):** auto-aktualizacja metryk z konektorów — KR „żyje", nie jest martwą liczbą wpisaną raz.
- ⚠️ **Adaptujemy:** drzewo alignmentu OKR → nasz model Inicjatywa↔KPI (nie kopiujemy korporacyjnej hierarchii zespołów 1:1).
- ❌ **Unikamy:** budowy własnego Tableau/Looker (silnik eksploracji BI) — to nie nasza altituda; Insights = kuratorowane karty + drill-down, nie pełny self-service BI.
- ❌ **Unikamy:** mieszania KPI i Insight-card w jeden byt — KPI to metryka z celem, Insight to wniosek/narracja (różne formuły treści).

## 6. Otwarte pytania
- Czy KPI to osobny moduł, czy zakładka w Insights + pole w Inicjatywie? (rekomendacja: encja `Metric` współdzielona, prezentowana w obu).
- Granica „Insights" (analiza z audytów/wywiadów) vs „KPI" (metryki ciągłe) — gdzie kończy się jedno?
- Skąd realne dane metryk u klienta DRD/konsultingowego — ręczny wpis vs konektor (większość celów transformacyjnych nie ma API).

## Załączniki
Surowe źródło: `Softs/0 KPI/{ QUANTIVE, QUANTIVE 2, PERDOO 1/2, WORKBOARD 1/2, Databox, Looker, Lookre 2, Looker 3, tableau, tableasu 2}`.
⚠️ **Grounding:** ten brief powstał z wiedzy domenowej + inwentarza scrape'a (nazwy/rozmiary folderów), bo dostęp do treści `Softs/` był w trakcie sesji zablokowany przez macOS TCC (`Operation not permitted`). Do **re-dystylacji na realnej treści** po przywróceniu Full Disk Access — wtedy potwierdzić §2–§3 i dograć 3–4 zrzuty (Databox scorecard, Quantive insights, Perdoo KPI-vs-OKR).
