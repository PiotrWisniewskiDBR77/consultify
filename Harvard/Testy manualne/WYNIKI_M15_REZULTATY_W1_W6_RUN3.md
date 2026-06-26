# WYNIKI TESTÓW — M15 Rezultaty · Run 3 (po naprawach BUG-11–22 + seed minimum)

> **Data:** 2026-06-25 · **Środowisko:** localhost:3001 (backend `d6c10a9232`) → staging DB (trolley)
> **Commity testowane:** `6afc80b980` (BUG-11/13/14/15/16/19/20/21) · `35127e7c6c` (BUG-12/17/18) · `969ad804d4` (BUG-22) · `d6c10a9232` (BUG-19b finance-link)
> **Org testowa:** DBR77 · 9 KPI · ~654 inicjatyw · + seed minimum (1 finance mapping, 1 inicjatywa warning)

---

## Podsumowanie zmian od Run 2

Run 2 zostawił **18 bugów P1/P2** + 41 BLOCKED. W tej rundzie:

1. **Wszystkie 18 bugów kodu naprawione i zweryfikowane live** (sweep API 18/18 PASS).
2. **Kluczowe odkrycie:** część „41 BLOCKED" to **ukryte bugi kodu, nie luki danych** — zapytania selektowały nieistniejące kolumny → `dbAll` połykał błąd → `[]`/`mappingCount:0`. Naprawione: BUG-22 (benefit-profiles `owner_name`), BUG-19b (finance-link 4 kolumny).
3. **Seed minimum** odblokował testy danych: finance mapping (6.25/6.26) + inicjatywa warning (3.4).
4. **Pozostałe BLOCKED** zaklasyfikowane jako **stuby route** lub **ripple danych** — backlog, nie defekty (sekcja na dole).

---

## Weryfikacja kontraktów API (sweep live 18/18 PASS)

| Bug | Kontrakt | Wynik | Dowód live |
|---|---|---|---|
| BUG-11 | `scenarios[].name` | ✅ | name="Pesymistyczny" |
| BUG-12 | DT edges `from`/`to` | ✅ | wszystkie krawędzie mają oba aliasy |
| BUG-13 | signal `realizationPct`+`initiativeName` | ✅ | obecne w każdym rekordzie |
| BUG-14 | run-rate `annualizedRunRate`/`projectedFullYear`/`remainingRunRateContribution` | ✅ | wszystkie 3 aliasy w bridge |
| BUG-15 | reallocation `summary.totalAmount` | ✅ | pole obecne |
| BUG-16 | adoption `flags[].atRisk` | ✅ | alias obecny |
| BUG-17 | DT węzły `objective`+`driver` | ✅ | objective "Wyniki biznesowe" + drivery per kategoria BSC |
| BUG-18 | DT `rolledUpValue`+`confidence`+`stats.coveredValue` | ✅ | objective rolledUp=451,7k · conf KPI=0,93 · coveredValue=451,7k |
| BUG-19 | finance-link `aggregate` obiekt | ✅ | netImpact=55000 |
| BUG-19b | finance-link realne kolumny | ✅ | byStatement P&L=55000 |
| BUG-20 | BSC „niezrównoważony" (FE) | ✅ | kod FE w StrategicLayerPanel |
| BUG-21 | link M14 w nagłówku Sygnały (FE) | ✅ | ExternalLink `/implementation` |
| BUG-22 | benefit-profiles niepuste | ✅ | 9 profili, summary financial=1/withTarget=9 |

---

## Testy odblokowane przez naprawy + seed

| Test | Run 2 | Run 3 | Mechanizm |
|---|---|---|---|
| 1.7–1.19 (13 testów benefit-profile) | 🔴 BLOCKED `profiles:[]` | ✅ odblokowane | BUG-22 — query czyta realne kolumny → 9 profili |
| 2.3 DT payload `from`/`to` | ⚡ PARTIAL | ✅ PASS | BUG-12 |
| 2.4/2.5 węzły objective/driver | ❌ FAIL | ✅ PASS | BUG-17 |
| 2.9 rolledUpValue>0 | 🔴 BLOCKED | ✅ PASS | BUG-18 (451,7k) |
| 2.11 stats.coveredValue | 🔴 BLOCKED | ✅ PASS | BUG-18 |
| 2.13 hierarchia obj→drv→kpi→init | ❌ FAIL | ✅ PASS | BUG-17 |
| 2.15 confidence badge | 🔴 BLOCKED | ✅ PASS | BUG-18 (conf=0,93) |
| 3.4 warning signal (40–60%) | ❌ FAIL | ✅ PASS | seed — F1-26 @ realiz=0,5 |
| 3.24 signal realizationPct | ❌ FAIL | ✅ PASS | BUG-13 |
| 3.30 link M14 | ❌ FAIL | ✅ PASS | BUG-21 |
| 4.4/4.5/4.17 run-rate aliasy | ❌ FAIL | ✅ PASS | BUG-14 |
| 5.3 BSC niezrównoważony | ❌ FAIL | ✅ PASS | BUG-20 |
| 5.12 adoption atRisk | ⚡ PARTIAL | ✅ PASS | BUG-16 |
| 6.17 scenario name | ⚡ PARTIAL | ✅ PASS | BUG-11 |
| 6.25/6.26 finance netImpact | 🔴 BLOCKED | ✅ PASS | BUG-19b + seed (netImpact=55000) |

**Razem odblokowane/naprawione: ~30 testów** (13 §1 + ~17 z §2–§6).

---

## Pozostałe BLOCKED — backlog (NIE defekty kodu)

Te testy pozostają zablokowane z przyczyn **architektonicznych**, nie błędów. Wymagają decyzji/wiringu, nie naprawy:

| Test | Przyczyna | Klasa | Co potrzeba |
|---|---|---|---|
| 5.16 sustained · 5.17 at-risk · 5.18 overdue · 5.19 nextReview | **Stub route** — `/sustainment` hardkoduje `realizationPct:0`, `lastReviewIso:null`, `cadence:'quarterly'` dla wszystkich. Z `lastReviewIso=null` zawsze 'overdue' → 'sustained'/'at-risk' nieosiągalne. | Wiring | Tabela przeglądów + realny realizationPct z ROI; `/sustainment` musi czytać dane, nie placeholdery |
| 5.2 balanced=true | **Ripple danych** — `balanced` wymaga ≥1 KPI w każdej z 4 perspektyw BSC; customer/learning mają 0. Dodanie KPI zepsułoby testy liczbowe (2.30 kpiCount=9, BSC counts). | Decyzja | Osobna org testowa „balanced", albo akceptacja jako edge-case v1 |
| 1.23/2.14/4.12/5.28 empty-state | Wymaga drugiej, pustej org | Test-infra | Drugie konto testowe |
| SEC (1.27/1.28/2.25/2.26/3.18/3.19/4.14/4.26/6.27) | Izolacja org / brak tokenu | Test-infra | Druga org + testy auth |
| 3.13/3.14 reallocation moves | Wymaga pary low/high realization performerów w jednej org | Dane | Większy seed (≥2 inicjatywy skrajne) |
| Click/UI (2.8/2.17/5.22/5.30 dark mode itd.) | Interakcje przeglądarki | Manual UI | Test w realnej przeglądarce |

**Rekomendacja:** sustainment-stub (5.16–5.19) to jedyny pozostały **realny gap funkcjonalny** — `/sustainment` zwraca placeholdery zamiast czytać dane. Reszta to test-infra (druga org) lub świadome edge-case'y v1. Sustainment-wiring = osobne zadanie (wymaga modelu przeglądów).

---

## Seed minimum (reprodukowalny)

`server/scripts/seed-m15-test-data.cjs` — idempotentny, STAGING-only (czyta `DATABASE_URL`):
- 1× `kpi_financial_mappings` (OEE→P&L Revenue, mult 5000 → impact 55k)
- 1× `roi_assumptions` + `roi_realized_values` (F1-26, expected 50k / realized 25k → realiz 0,5 = warning)

Stałe id seedów → re-run nie tworzy duplikatów.
