# F2-2 Realizacja E0/E1 — trzeci niezależny rereview

**Werdykt: ACCEPT dla zamrożonego checkpointu E0/E1 — jedyny otwarty P2 został zamknięty: powiązany Execution Case z `executionCaseVersion: null` renderuje opisowy brak danych bez `v—` przez realną granicę `TableWithPreviewLayout` → `StandardPreview`. Pełny pakiet F2-2 pozostaje HOLD na jawnych bramkach właściciela i zakresach odłożonych przez CTO.**

Przegląd: 2026-09-13 20:42 CDT. Recenzent nie implementował kodu i nie rozszerzał zakresu o produkcyjną sygnalizację ryzyka.

## Tożsamość i integralność exact freeze

- worktree: `/Users/piotrwisniewski/Developer/codex-wt/realizacja-cztery-przyciski-20260913`;
- gałąź: `codex/realizacja-cztery-przyciski-20260913`;
- baza: `c1e8fba7c219232177fe7aff21040de872858f64`;
- HEAD: `0c27c5e92a42c3c62d2f0014412f007c84636961`;
- `git merge-base --is-ancestor c1e8fba7c2 HEAD`: **PASS**; merge-base jest dokładnie bazą;
- `FREEZE_MANIFEST.json`: SHA-256 `a1912fb79acaa7d645d2cb8756355be0c80b3d2845034fb63e8d66c1b431b0fe`;
- manifest deklaruje **63** pliki i zawiera **63** wpisy; niezależne przeliczenie rozmiaru i SHA daje **63/63 zgodne, drift=0**;
- względem bazy: **0 migracji**.

## Zamknięcie P2 — brak wersji na realnej granicy podglądu

`executionBankModel` zachowuje brak numeru jako `executionCaseVersion: null`. `buildExecutionBankPreviewDeclaration` rozróżnia teraz trzy stany: brak powiązania, powiązanie bez zaraportowanej wersji oraz powiązanie z wersją. Dla drugiego stanu zwraca klucz i18n `execution.bank.preview.fact.caseVersionMissing` z tekstem EN `Linked · version not reported` i PL `Powiązana · wersja niezaraportowana`; prefiks `v` jest dodawany wyłącznie do wartości liczbowej.

Test `(9) powiązana realizacja bez wersji pokazuje opisowy brak danych bez prefiksu „v"` nie sprawdza samego źródła. Buduje realną deklarację z wiersza `executionCaseVersion: null`, montuje ją jako `TableWithPreviewLayout` → `StandardPreview embedded`, odnajduje blok szczegółów i dowodzi zachowania renderu: opisowy tekst jest widoczny, `Linked · v—` jest nieobecne i cały blok nie zawiera `v—`. To zamyka poprzednie osiągalne naruszenie.

## Świeże przebiegi recenzenta

- pięć plików focused Vitest: **5/5 plików, 32/32 testy PASS**, retry=0; obejmują model, wszystkie cztery renderery, pięć filtrów, tryb flagi OFF, natywną tożsamość Inicjatywy i kanoniczny podgląd;
- `npm run check:list-canon`: **PASS**; pełny skan **192** plików, **349 naruszeń = baseline 349**, brak nowego długu;
- ręczna inspekcja diffu potwierdza `VITE_EXECUTION_FOUR_BUTTONS` domyślnie **OFF**, a nowe zachowanie listy i pięć kontrolek filtrów są osiągalne tylko przy włączeniu flagi;
- pięć filtrów — projekt z jawnym `No project`, status, właściciel, priorytet i półotwarte okno czasu — nadal zasila jeden wspólny zbiór dla table/kanban/calendar/Gantt;
- rebase zachowuje kanon: `StandardTable`/`TableWithPreviewLayout`/`StandardPreview`, deklaracje `dataType`, pojedynczą kolumnę `primary` i domyślnie ukryte kolumny wtórne; świeży skan kanonu nie wykazał regresji;
- istniejący kontrolowany RED pozostaje zgodny z granicą checkpointu: **2/4 PASS**, czerwone wyłącznie `FULL_29_OF_29` oraz `riskSignalLevels`;
- nie stwierdzono kodowej zmiany produkcyjnej sygnalizacji ryzyka; jedyne nowe trafienie `riskSignalLevels` w diffie `src` należy do kontrolowanego testu kontraktu RED.

## Bramki jawnie pozostające HOLD

- `OWNER_E0_VARIANT_LETTER`: **HOLD** — brak pisemnej akceptacji właściciela wariantu prototypu;
- produkcyjna sygnalizacja ryzyka: **NOT STARTED / HOLD**;
- szósty filtr sygnału ryzyka: **NOT STARTED / HOLD**;
- artefakt `8c073b0a`: **EVIDENCE_MISSING**;
- pełny mianownik wymagań 29/29: **HOLD**.

ACCEPT dotyczy wyłącznie exact freeze checkpointu E0/E1 o SHA manifestu podanym wyżej. Nie wykonano commita, pushu, deployu, migracji ani zmian produkcyjnej sygnalizacji ryzyka.
