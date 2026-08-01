---
doc_id: ssot-quality-delivery
truth_type: delivery-status
status: canonical
owner: engineering-quality
last_reviewed: 2026-07-30
---

# Jakość, dowody i dostarczanie

## Poziomy dowodu

| Poziom | Co potwierdza |
| --- | --- |
| kod znaleziony | funkcja ma implementację lub ślad |
| test jednostkowy | wybrany kontrakt lokalny |
| test komponentu/API | współpracę kilku elementów |
| test E2E | podróż użytkownika w kontrolowanym środowisku |
| smoke właściwego środowiska | że wdrożony runtime działa teraz |
| odbiór biznesowy | że rezultat spełnia potrzebę użytkownika |

Niższy poziom nie może być przedstawiany jako wyższy.

## Główne bramki repo

- typy i build;
- testy jednostkowe, komponentowe i integracyjne;
- testy E2E/smoke odpowiednie dla zmiany;
- bezpieczeństwo i zależności;
- migracje i integralność danych;
- standardy UI i dostępność;
- `npm run check:ssot`;
- `git diff --check`.

Dokładny zestaw wybiera się proporcjonalnie do ryzyka. Samo istnienie skryptu w
`package.json` nie dowodzi, że przechodzi.

## Evidence

Dowód powinien zawierać:

- commit/revision;
- środowisko;
- czas;
- scenariusz;
- wynik;
- wykonawcę;
- ograniczenia;
- link do logu, zrzutu lub raportu.

Datowany raport zachowuje ważność historyczną, ale nie potwierdza automatycznie
dzisiejszego runtime.

## Release

Standardowy ruch:

`feature → develop → staging validation → main → production validation`

Aktywny program najbliższego odbioru:
`docs/program/WEEKEND_COMPLETION_2026-08-01/README.md`.

Przed publikacją wymagane są aktualne dowody, kontrola migracji, rollback i
akceptacja odpowiednia do ryzyka. W tym porządkowaniu nie wykonano commita,
push, wdrożenia ani zmian zewnętrznych.

## Aktualnie znane wyniki

- kontrola SSOT: PASS;
- 16/16 pozycji menu ma zarejestrowany kontrakt;
- testy celowane Chat/Canvas z 2026-07-29: 70/74 PASS;
- Canvas pozostaje NO_GO;
- szeroki przypadkowo uruchomiony pakiet ujawnił regresję dostępności widoku
  incydentów SuperAdmin; wymaga osobnej naprawy;
- pełny globalny release gate nie został wykonany w ramach porządkowania.
