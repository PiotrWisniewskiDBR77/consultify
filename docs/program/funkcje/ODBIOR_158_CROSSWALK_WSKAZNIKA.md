---
doc_id: funkcje-odbior-158
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# ODBIÓR 158 — crosswalk rejestru wskaźnika i odczyt-cień

**Klasyfikacja rozdzielona.** Dyżur ma trzy części i **nie zasługują na tę samą ocenę**.

| Część | Ocena | Uzasadnienie |
|---|---|---|
| R1 — migracja crosswalk | **A** | addytywna, idempotentna, FK/unique sprawdzone na żywej bazie |
| R2 — zapis potwierdzonych powiązań | **A** | dowód mutacyjny złapał zepsucie |
| R3 — logika porównania cienia | **A** | dowód mutacyjny złapał zepsucie |
| R3 — cień jako **mechanizm produkcyjny** | **D** | **martwy kod, zero wywołań** |

Marker `43322a8b31`, 5 commitów, **6 plików, 746 wstawień, 0 usunięć**.

## Dwa dowody mutacyjne — OBA PRZESZŁY

Środowisko odtworzone od zera na osobnym kontenerze (867 migracji), nie na
artefaktach wykonawcy.

1. `kpiCrosswalkService.ts:64` — `inserted += result.rowCount` → `inserted += 1`
   (ignoruj realny wynik zapisu). Test **złapał**: `expected { inserted: 2 } to
   deeply equal { inserted: 1 }`.
2. `kpiShadowReadService.ts` — `comparable()` zwraca stałą (maskuje każdą różnicę).
   Test **złapał**: `expected 1 to be +0`.

Bez retry. Drzewo po przywróceniu czyste. **To są prawdziwe testy.**

## Migracja — sprawdzona na żywej bazie

`20260830_day158_kpi_crosswalk.sql`: wyłącznie `CREATE TABLE IF NOT EXISTS`
+ 2× `CREATE INDEX IF NOT EXISTS`. **Zero ALTER, zero DROP** — addytywna, bez
rollbacku. Drugi przebieg migracji: `Applying migrations: 0`.

`\d kpi_crosswalk` na żywo potwierdza: FK `canonical_kpi_id → rvn_kpi_definitions
ON DELETE RESTRICT`, `UNIQUE (organization_id, source_system, source_id)`.

**Brak heurystyki dopasowania** — `kpiCrosswalkService.ts:44-63` wymaga jawnego
`sourceId` + `canonicalKpiId`. Żadnego `WHERE name = name`. To dobrze: automat
zgadujący po nazwie sklejałby wskaźniki różnych organizacji.

## ★ Odczyt-cień NIE JEST odczytem-cieniem

Cel dyżuru brzmiał: czytać z nowego źródła **równolegle**, bez zmiany zachowania.
Zmierzyłem, kto woła obie nowe funkcje:

```text
$ grep -rn "runInitiativeKpiShadowRead|registerConfirmedInitiativeKpiMappings" server/src src
kpiCrosswalkService.ts:36:export async function registerConfirmedInitiativeKpiMappings(
kpiShadowReadService.ts:56:export async function runInitiativeKpiShadowRead(
```

**Tylko definicje.** Poza testami — zero wywołań. Ani trasy, ani crona, ani workera.
Sprawdziłem też, czy jest choćby wyłączona flaga (`KPI_CROSSWALK`, `KPI_SHADOW`,
`SHADOW_READ`) — **nie ma żadnej**.

To ważne rozróżnienie: **nie jest to „gotowe za flagą OFF"**, co byłoby normalnym
stanem przed akceptem. To zwykły nieużywany moduł biblioteczny. Nic go nie uruchamia
i nic nie może go uruchomić bez dopisania kodu.

Raport wykonawcy to **przyznaje wprost** — nie skłamał. Ale klasyfikuje to jako
„zrobione", i tak by to weszło do rejestru, gdyby nie odbiór.

## Co ten dyżur naprawdę dał

Rozbieżność między dwoma rejestrami wskaźnika jest **zmierzona i policzona**:
`comparedPairs: 1, matchingPairs: 0, divergentPairs: 1` — różnice w wartości
(`12` vs `'11'`), statusie (`on_track` vs `active`) i widoczności (`null` vs
`OPEN_ORG`). Odtworzyłem te liczby na własnej bazie z losowymi UUID; to
deterministyczna właściwość kodu, nie liczba przepisana z raportu.

Dowód „źródło niezmienione" jest **mocny**: test montuje realny `ApiGateway`,
podpisuje JWT, woła `supertest` na `GET /api/initiatives/:id/kpis` i porównuje
`JSON.stringify` przed i po. Łańcuch konsumenta potwierdzony:
`BenefitsHub.tsx:199` → `pmo/initiatives.routes.ts:3349` → `getInitiativeKpis`.

## ★ Naprawa nadzorcy — test przechodził tylko na jednej maszynie

`day158.kpi-crosswalk.pg.test.ts:116` zawierał:

```ts
expect(databaseUrl).toContain('127.0.0.1:6045/cx158');
```

Asercja tożsamości bazy **przypięta do portu i nazwy bazy wykonawcy**. Na każdej
innej maszynie — i w CI — ten test padał z przyczyn środowiskowych, nie funkcjonalnych.
Audytor potwierdził to empirycznie: u niego 3/4 PASS + 1 porażka czysto środowiskowa.

Naprawiłem, zachowując **intencję** (dowód, że test biegł na Postgresie, a nie na
sqlite przypiętym w `server/vitest.config.ts:17`):

```ts
expect(databaseUrl).toMatch(/^postgres(ql)?:\/\//);
expect(databaseUrl).not.toMatch(/sqlite/i);
```

Sprawdzone na pięciu adresach: przechodzi dla maszyny wykonawcy, innego portu i CI;
**odpada** dla `file:./test.sqlite` i `sqlite::memory:`. Intencja zachowana,
przenośność zyskana.

## Ryzyko na przyszłość

Oba nowe serwisy mają `try/finally` (zwolnienie klienta), ale **żadnego `try/catch`
na zapytania**. Dziś nieszkodliwe, bo nic ich nie woła. **W dniu podłączenia do trasy**
błąd zapytania — np. przy pustym `rvn_kpi_definitions` — przejdzie jako nieobsłużony
wyjątek i wywróci żądanie. Do wpisania w instrukcję dyżuru podłączającego.

## Czego NIE zweryfikowałem

- Zachowania na demo/staging/produkcji — **zakaz, i słusznie**.
- Pełnego korpusu testów repo na markerze vs HEAD (wykonawca też nie — przyznał
  `EVIDENCE_MISSING` wprost).
- FK `RESTRICT` przy realnym `DELETE` z `rvn_kpi_definitions` z istniejącym crosswalkiem.
- Tabeli konsumentów R4 w całości — sprawdzone punktowo dwa wpisy.
- **Mojej własnej naprawy nie uruchomiłem przez Postgresa** — sprawdziłem logikę
  asercji na pięciu adresach, nie pełnym przebiegiem testu.

## Werdykt

**Do scalenia.** Trzy części na A z dowodami mutacyjnymi, jedna na D.

**Wniosek dla mnie:** ten dyżur pokazuje, że „zrobione" trzeba rozbijać na części.
Gdyby wszedł do rejestru jako jedna pozycja, zapisalibyśmy, że odczyt-cień działa —
a on nie istnieje w runtime. **To byłby jedenasty kształt fałszywego gotowe:
biblioteka bez wywołania, sprawdzona testami do zieloności.**
