# P11 — siedem mutacji zabezpieczeń

Każdą zmianę wykonano chwilowo, uruchomiono wyłącznie wskazany test, zapisano wynik RED i przywrócono kod. Końcowe wyniki po przywróceniu są w plikach `99-*.GREEN.txt`.

| # | celowana zmiana | test, który padł | RED | po przywróceniu |
|---:|---|---|---|---|
| 1 | dopuszczenie zastosowania propozycji bez statusu `ACCEPTED` | `PlanCard.zatwierdz.test.ts` | 1 failed | GREEN |
| 2 | podanie inicjatyw jako źródła wierszy listy planów | `PlanScenarioSurface.listaPlanow.test.tsx` | 1 failed | GREEN |
| 3 | zwrot surowego identyfikatora zamiast etykiety biznesowej | `nazwyBezKodow.test.ts` | 1 failed | GREEN |
| 4 | usunięcie `capacity_analysis` z rejestru kart N | `registry.kompletnosc.test.ts` | 1 failed | GREEN 3/3 |
| 5 | wyłączenie serwerowej bramki publikacji planu z konfliktami | `planPublish.konflikt.realdb.test.ts` na PG 54400 | 1 failed | GREEN |
| 6 | zamiana obsługi `noPressure` na wyjątek | `capacityAnalysis.brakPresji.test.tsx` | 1 failed | GREEN |
| 7 | usunięcie `name` z zapisywanego agregatu | `planScenario.name.realdb.test.ts` na PG 54400 | 1 failed | GREEN |

Wynik: **7/7 RED, 7/7 przywrócone, 10/10 końcowych asercji GREEN** (8 UI/rejestr + 2 RealPG). Fixture RealPG mają własne `organization_id`; po teście liczba organizacji fixture P11 wynosi 0.
