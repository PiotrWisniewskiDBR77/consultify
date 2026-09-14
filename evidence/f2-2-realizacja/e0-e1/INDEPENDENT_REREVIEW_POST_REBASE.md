# F2-2 Realizacja E0/E1 — drugi niezależny przegląd po rebase

**Werdykt: HOLD — dwa wcześniejsze P1 zostały odebrane, lecz wymaganie podglądu bez `v—` nadal ma osiągalne naruszenie P2 dla powiązanego Execution Case bez numeru wersji.**

Przegląd: 2026-09-13 20:32 CDT. Nie rozpoczęto ani nie oceniano jako defektów checkpointu produkcyjnej sygnalizacji ryzyka, szóstego filtra i pełnego mianownika 29/29.

## Tożsamość i integralność exact freeze

- gałąź: `codex/realizacja-cztery-przyciski-20260913`;
- baza: `c1e8fba7c219232177fe7aff21040de872858f64`;
- HEAD: `0c27c5e92a42c3c62d2f0014412f007c84636961`;
- `git merge-base --is-ancestor <base> HEAD`: **PASS**;
- manifest: `FREEZE_MANIFEST.json`, SHA-256 `79719d2d3a9065efa3cbb2c0825392a98193d1e57be5231dbb58b3310f654c48`;
- przed tym raportem: deklarowane **53**, obecne **53**, zgodny rozmiar i SHA **53/53**, `drift=0`;
- migracje względem bazy: **0**.

## Niezależnie powtórzone i sprawdzone dowody

- focused Vitest na czterech plikach: **4/4 pliki, 23/23 testy PASS**, świeży przebieg recenzenta, retry=0;
- `npm run check:list-canon`: **PASS**, 192 pliki, **349 naruszeń = baseline 349**, brak nowego długu;
- tabela deklaruje **15/15 `dataType`**, jedną kolumnę `primary: true` i trzy wtórne kolumny `defaultVisible:false`;
- zamrożony typecheck zawiera **189** błędów w 55 plikach, czyli mieści się w limicie CTO `≤192`; wszystkie 12 trafień w zmienionym `ExecutionHub.tsx` leży poza zakresami zmienionych linii, a pozostałe zmienione pliki implementacyjne mają 0 trafień;
- E0 PNG: oba pliki mają **1440×900**, różne sumy SHA-256, a receipt zapisuje 0 błędów, 0 ostrzeżeń i brak overflow. To pozostaje prototypem bez akceptacji właściciela.

## Odbiór wcześniejszych P1

### P1 zamknięty — OFF zachowuje mianownik i render bazowy, ON izoluje nową semantykę

`VITE_EXECUTION_FOUR_BUTTONS` pozostaje domyślnie OFF; jawny query/localStorage/env może go włączyć. Przy OFF model działa w `LEGACY`, zachowuje dwa techniczne case jednej Inicjatywy jako dwa wiersze, identyfikatory case, etykietę `Initiative / Case`, opis `Execution Case linked` i nie renderuje nowych filtrów. Przy ON dopiero następuje deterministyczny wybór najnowszego cienia, identyfikacja Inicjatywą, etykieta `Initiative`, projekt i nowe kontrolki. Test zachowania z dwoma case jednej Inicjatywy przechodzi w świeżym przebiegu.

### P1 zamknięty — pięć osiągalnych filtrów steruje wspólnym zbiorem

Projekt, status, właściciel, priorytet i półotwarte okno czasu mają osiągalne kontrolki przy fladze ON. Test interakcji przełącza także jawny koszyk `No project` i potwierdza ten sam przefiltrowany zbiór po zmianie table → kanban → calendar → Gantt. Szósty filtr ryzyka pozostaje prawidłowo poza checkpointem.

## Odbiór kanonu Wpisu 13 i wcześniejszego P2

Rebase przyjął `dataType`/`primary`, trzy wtórne kolumny ukryte domyślnie oraz `TableWithPreviewLayout` + `StandardPreview`. Diff względem bazy nie dodaje własnej pustki ani własnej stopki; używa odziedziczonego kanonicznego `PreviewActionBar`. Świeży test renderu potwierdza tabelę `properties`, brak surowego `UNKNOWN` w sprawdzonym podglądzie oraz ukrycie pustego bloku Relations.

### P2 otwarty — osiągalny tekst `Linked · v—`

`executionBankModel` jawnie zachowuje brak wersji jako `executionCaseVersion: null`, lecz `buildExecutionBankPreviewDeclaration` renderuje powiązany case jako ``Linked · v${row.executionCaseVersion ?? '—'}``. Diagnostyczny render recenzenta z realnym modelem, realną deklaracją i realnym `StandardPreview` potwierdził widoczny tekst **`Linked · v—`**. Istniejący test zielony używa wyłącznie case z wersjami 2/4/7, więc tej granicy nie broni.

**Wymagana poprawka:** dla powiązanego case bez wersji pokazać opisowy brak danych bez prefiksu `v` i dodać test renderu tej granicy na realnej deklaracji podglądu. Po poprawce potrzebny jest nowy exact freeze i świeży, krótki rereview.

## Jawne bramki poza scoped checkpointem

- `OWNER_E0_VARIANT_LETTER`: **HOLD**;
- produkcyjny sygnał ryzyka: **NOT STARTED / HOLD**;
- szósty filtr sygnału ryzyka: **NOT STARTED / HOLD**;
- artefakt `8c073b0a`: **EVIDENCE_MISSING**;
- pełny kontrakt 29/29: **HOLD**, zamrożony kontrolowany RED pozostaje 2/4 PASS (`FULL_29_OF_29` i `riskSignalLevels` czerwone).

Nie wykonano commita, pushu, deployu, migracji ani zmian produkcyjnej sygnalizacji ryzyka.
