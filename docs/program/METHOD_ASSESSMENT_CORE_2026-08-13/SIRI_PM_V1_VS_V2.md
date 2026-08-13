# SIRI PM v1 vs v2 — porównanie before/after na reprezentatywnym fixture

**Agent:** A11 (`codex/mac-a11-siri-pm-20260813`) · **Decyzja:** COORD-08 —
APPROVED WITH VERSIONING · **Data:** 2026-08-13

Ten dokument jest DOWODEM, że `siri_pm_v2` nie jest zmianą cichą/neutralną —
zmienia rangę wielu wymiarów na tych samych danych wejściowych. Liczby
poniżej pochodzą z realnego uruchomienia `rankByImpactValue()` (legacy_v1) i
`rankByImpactValueV2()` (siri_pm_v2) z `src/services/siriPrioritisation.ts`
na wszystkich 16 kanonicznych obszarach z `SIRI_PRIORITISATION_AREAS`
(`src/services/siriStructure.ts`) — nie są wyliczone ręcznie. Generator był
tymczasowym skryptem (`scripts/_tmp_a11_gen_v1_vs_v2.ts`), uruchomionym raz i
usuniętym po wygenerowaniu tego dokumentu — nie jest częścią commitu.

## Fixture

- 16 obszarów, `AMS` rozłożone nierówno w paśmie 0–5 (nie wszystkie równe —
  to by ukryło różnice w rankingu).
- Stały benchmark `BIC = 4` dla wszystkich obszarów.
- `costProfile` i `kpiImportance` celowo NIERÓWNE między wymiarami (niektóre
  dominują kosztowo, inne KPI) — to dokładnie ten kształt danych, który
  ujawnia Defekt 1 (brak normalizacji) najwyraźniej.
- `costRelevance = kpiRelevance = 1` dla wszystkich (pełna istotność —
  izoluje efekt normalizacji od DOR).
- Trzy horyzonty planowania, każdy z własnym presetem wag
  (`SIRI_PM_WEIGHT_PRESETS`).

## Wyniki

### Horyzont: strategic (weights: cost=0.3, kpi=0.4, proximity=0.3)

| # | Wymiar (id) | Blok | IV(v1) | ranga(v1) | IV(v2) | ranga(v2) | Δranga |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | facility_connectivity | TECHNOLOGY | 13.5 | 1 | 0.1 | 2 | -1 |
| 2 | horizontal_integration | PROCESS | 12.1 | 2 | 0.1 | 1 | +1 |
| 3 | vertical_integration | PROCESS | 10.7 | 3 | 0.09 | 4 | -1 |
| 4 | workforce_learning | ORGANIZATION | 10.3 | 4 | 0.1 | 3 | +1 |
| 5 | inter_intra_collaboration | ORGANIZATION | 10.1 | 5 | 0.08 | 6 | -1 |
| 6 | facility_automation | TECHNOLOGY | 8.1 | 6 | 0.06 | 8 | -2 |
| 7 | enterprise_connectivity | TECHNOLOGY | 8 | 7 | 0.08 | 5 | +2 |
| 8 | enterprise_intelligence | TECHNOLOGY | 6.3 | 8 | 0.06 | 9 | -1 |
| 9 | integrated_product_lifecycle | PROCESS | 5.8 | 9 | 0.07 | 7 | +2 |
| 10 | enterprise_automation | TECHNOLOGY | 4.9 | 10 | 0.05 | 10 | 0 |
| 11 | leadership_competency | ORGANIZATION | 4.4 | 11 | 0.05 | 11 | 0 |
| 12 | shop_floor_automation | TECHNOLOGY | 3.9 | 12 | 0.03 | 13 | -1 |
| 13 | facility_intelligence | TECHNOLOGY | 3.8 | 13 | 0.03 | 15 | -2 |
| 14 | shop_floor_intelligence | TECHNOLOGY | 3.1 | 14 | 0.04 | 12 | +2 |
| 15 | shop_floor_connectivity | TECHNOLOGY | 2.5 | 15 | 0.03 | 14 | +1 |
| 16 | strategy_governance | ORGANIZATION | 1.6 | 16 | 0.02 | 16 | 0 |

**Zmienionych rang: 13/16.**

Step 8 focus set (v1): `facility_connectivity, horizontal_integration, workforce_learning, vertical_integration`
Step 8 focus set (v2): `horizontal_integration, facility_connectivity, workforce_learning, vertical_integration`
Różnica w zbiorze focus (symmetric diff): **0** — sam zbiór 4 fokusów się nie zmienił na tym fixture, mimo że ranga w środku rankingu (5-16) mocno się przetasowała.

### Horyzont: tactical (weights: cost=0.45, kpi=0.3, proximity=0.25)

| # | Wymiar (id) | Blok | IV(v1) | ranga(v1) | IV(v2) | ranga(v2) | Δranga |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | vertical_integration | PROCESS | 14.85 | 1 | 0.12 | 1 | 0 |
| 2 | inter_intra_collaboration | ORGANIZATION | 13.25 | 2 | 0.1 | 2 | 0 |
| 3 | facility_connectivity | TECHNOLOGY | 11.05 | 3 | 0.09 | 4 | -1 |
| 4 | enterprise_connectivity | TECHNOLOGY | 10.6 | 4 | 0.09 | 3 | +1 |
| 5 | horizontal_integration | PROCESS | 10.25 | 5 | 0.08 | 5 | 0 |
| 6 | enterprise_intelligence | TECHNOLOGY | 8.15 | 6 | 0.07 | 7 | -1 |
| 7 | workforce_learning | ORGANIZATION | 8.05 | 7 | 0.08 | 6 | +1 |
| 8 | facility_automation | TECHNOLOGY | 6.75 | 8 | 0.05 | 10 | -2 |
| 9 | enterprise_automation | TECHNOLOGY | 6.45 | 9 | 0.06 | 9 | 0 |
| 10 | leadership_competency | ORGANIZATION | 5.4 | 10 | 0.05 | 11 | -1 |
| 11 | integrated_product_lifecycle | PROCESS | 4.9 | 11 | 0.06 | 8 | +3 |
| 12 | shop_floor_automation | TECHNOLOGY | 4.75 | 12 | 0.04 | 12 | 0 |
| 13 | shop_floor_intelligence | TECHNOLOGY | 3.75 | 13 | 0.04 | 13 | 0 |
| 14 | facility_intelligence | TECHNOLOGY | 3.3 | 14 | 0.02 | 15 | -1 |
| 15 | shop_floor_connectivity | TECHNOLOGY | 2.15 | 15 | 0.03 | 14 | +1 |
| 16 | strategy_governance | ORGANIZATION | 1.9 | 16 | 0.02 | 16 | 0 |

**Zmienionych rang: 9/16.**

Step 8 focus set (v1): `vertical_integration, inter_intra_collaboration, facility_connectivity, enterprise_connectivity`
Step 8 focus set (v2): `vertical_integration, inter_intra_collaboration, enterprise_connectivity, facility_connectivity`
Różnica w zbiorze focus (symmetric diff): **0**

### Horyzont: operational (weights: cost=0.6, kpi=0.2, proximity=0.2)

| # | Wymiar (id) | Blok | IV(v1) | ranga(v1) | IV(v2) | ranga(v2) | Δranga |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | vertical_integration | PROCESS | 19 | 1 | 0.14 | 1 | 0 |
| 2 | inter_intra_collaboration | ORGANIZATION | 16.4 | 2 | 0.12 | 2 | 0 |
| 3 | enterprise_connectivity | TECHNOLOGY | 13.2 | 3 | 0.11 | 3 | 0 |
| 4 | enterprise_intelligence | TECHNOLOGY | 10 | 4 | 0.08 | 4 | 0 |
| 5 | facility_connectivity | TECHNOLOGY | 8.6 | 5 | 0.07 | 7 | -2 |
| 6 | horizontal_integration | PROCESS | 8.4 | 6 | 0.07 | 5 | +1 |
| 7 | enterprise_automation | TECHNOLOGY | 8 | 7 | 0.07 | 6 | +1 |
| 8 | leadership_competency | ORGANIZATION | 6.4 | 8 | 0.06 | 9 | -1 |
| 9 | workforce_learning | ORGANIZATION | 5.8 | 9 | 0.06 | 8 | +1 |
| 10 | shop_floor_automation | TECHNOLOGY | 5.6 | 10 | 0.04 | 11 | -1 |
| 11 | facility_automation | TECHNOLOGY | 5.4 | 11 | 0.04 | 12 | -1 |
| 12 | shop_floor_intelligence | TECHNOLOGY | 4.4 | 12 | 0.04 | 13 | -1 |
| 13 | integrated_product_lifecycle | PROCESS | 4 | 13 | 0.05 | 10 | +3 |
| 14 | facility_intelligence | TECHNOLOGY | 2.8 | 14 | 0.02 | 15 | -1 |
| 15 | strategy_governance | ORGANIZATION | 2.2 | 15 | 0.02 | 16 | -1 |
| 16 | shop_floor_connectivity | TECHNOLOGY | 1.8 | 16 | 0.02 | 14 | +2 |

**Zmienionych rang: 12/16.**

Step 8 focus set (v1): `vertical_integration, inter_intra_collaboration, enterprise_connectivity, enterprise_intelligence`
Step 8 focus set (v2): `vertical_integration, inter_intra_collaboration, enterprise_connectivity, enterprise_intelligence`
Różnica w zbiorze focus (symmetric diff): **0**

## Podsumowanie liczbowe

| Horyzont | Zmienionych rang | Na ile pozycji (16) |
| --- | ---: | ---: |
| strategic | 13 | 16 |
| tactical | 9 | 16 |
| operational | 12 | 16 |
| **Łącznie (3 horyzonty × 16 obszarów = 48 par)** | **34** | **48** |

**34 z 48 par ranga(v1)/ranga(v2) różnią się** na tym fixture (71%). To
zdecydowanie NIE jest zmiana kosmetyczna — potwierdza tekst COORD-08:
„naprawa zmienia kolejność rankingu na istniejących danych, więc nie jest
zmianą neutralną".

**Ale: zbiór 4 fokusów Step 8 (1 per building block + 1 bonus) wyszedł
identyczny na wszystkich 3 horyzontach w tym konkretnym fixture** —
przetasowanie dotyczy głównie środka i dołu rankingu (pozycje 5–16), nie
samego zestawu rekomendacji najwyższego poziomu. **To NIE jest gwarancja
ogólna** — na innym rozkładzie danych (bliżej granic decyzyjnych) zbiór
focus też może się zmienić; to jest obserwacja na TYM fixture, nie dowód
matematyczny niezmienności Step 8.

## Wniosek dla decyzji o włączeniu flagi

Ta tabela jest materiałem do pokazania właścicielowi metody/Piotrowi PRZED
jakąkolwiek zmianą domyślnej ścieżki (`SIRI_PM_V2` flag OFF→ON) — zgodnie z
procedurą w `SIRI_PM_V2_BACKFILL_PLAN.md` §4. Sama poprawność matematyczna
(dowiedziona testami w `src/services/__tests__/siriPrioritisation.v2.test.ts`)
nie jest wystarczającym powodem do cichego przełączenia domyślnej ścieżki —
zmiana rangi na 71% par w tym fixture pokazuje, że rekomendacje dla klienta
faktycznie by się zmieniły.
