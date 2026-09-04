# Dyżur 353 — R3: pięć modułów A i trzy bloki

## Rozstrzygnięcie licencji i mutacji

`Z40` oraz tabela licencji zakazują zapisu w `src/**` i `server/src/**` poza tymczasową mutacją `TaskController.ts` wykonaną w R2. R3 jednocześnie wymaga mutacji zabezpieczenia w innych plikach produktu. Zastosowałem bezpieczniejsze rozstrzygnięcie z §0.5: nie modyfikowałem niedopuszczonych plików produktu; istniejące testy uruchomiłem, a brak dopuszczonego dowodu mutacyjnego zapisałem jako pięć czerwonych z założenia kontraktów i briefów. To nie podnosi żadnego wiersza.

## Wyniki per moduł

| Moduł | Kandydat uruchomiony | Wynik | Ocena luki i czerwony kontrakt |
| --- | --- | --- | --- |
| 04_ASSESSMENT | `day274-ocena-dociera-do-listy.pg.test.ts` (2/2 w Bloku 3), `day275-method-outputs-kontrakt.pg.test.ts` (1/1) | ApiGateway/RealPG działa na czystej bazie; day274 ma odmowę obcego, day275 tylko właściciela | Brak mutacji strażnika odczytu istniejącej oceny; `tests/unit/day353-g19-04-assessment.contract.test.ts` RED |
| 05_INITIATIVES | `day277-decyzje-zapis.pg.test.ts` (2/2) | właściciel zapisuje i czyta, obcy dostaje 404 | Brak dopuszczonej mutacji filtra organizacji zapisu/odczytu; `tests/unit/day353-g19-05-initiatives.contract.test.ts` RED |
| 06_EXECUTION | `initiativesExecutionRuntime.dropdown.pg.test.ts` | 2/2, jawny PostgreSQL i tytuł inicjatywy | Test nie ma obcego tenanta ani mutacji; `tests/unit/day353-g19-06-execution.contract.test.ts` RED |
| 11_MATERIALS | `day276-deck-autosave-persist.pg.test.ts` (2/2), `day276-workbook-cell-persist.pg.test.ts` (2/2) | persistencja działa; workbook odmawia obcemu | Brak dopuszczonej mutacji filtra organizacji; deck nie ma pary; `tests/unit/day353-g19-11-materials.contract.test.ts` RED |
| 13_CHAT | `ai.agentHubRateLimitRouting.test.ts` | 9/9 w Bloku 3 | To test tekstowy limitera, nie ApiGateway/JWT/RealPG ani izolacja; `tests/unit/day353-g19-13-chat.contract.test.ts` RED |

Pakiet pięciu kontraktów: `numTotalTests=5`, `numPassedTests=0`, `numFailedTests=5`, exit 1 — czerwony zgodnie z założeniem i nagłówkami plików.

## Trzy bloki na markerze 29fcbd4de2

| Blok | Dziedziczone | Mój przebieg | Wniosek |
| --- | --- | --- | --- |
| 1, wariant C z roota | 131 / 127 / 4 | **131 / 131 / 0**, exit 0 | cztery dziedziczone czerwienie nie odtworzyły się; nie naprawiałem ich |
| 2, jednostkowy z roota | 218 / 218 / 0 | 218 / 218 / 0, exit 0 | zgodne; nie dowodzi RealPG |
| 3, wariant B z `server/` | 18 / 11 / 7 | **18 / 18 / 0**, exit 0 | siedem dziedziczonych czerwieni nie odtworzyło się na czystej bazie |

Pierwsza próba Bloku 2 z `server/` wykonała 0 testów i miała exit 1; została odrzucona jako błąd komendy. Ważny przebieg użył konfiguracji roota, która rzeczywiście obejmuje sześć ścieżek `tests/unit/**`.

## Pomiar nazw

Zbiory obejmują ważne przebiegi Bloków 1–3, day307 i dropdown Execution. `przed-nazwy.txt` ma 371 pełnych nazw. `po-nazwy.txt` ma 376. Diff zawiera dokładnie pięć dodanych nazw czerwonych kontraktów i zero nazw znikniętych.

## Pułapki dowodowe

- Blok 1 i Blok 2 są jednostkowe (`RUN_DB_TESTS=0 MOCK_DB=true`); nie są dowodem działania na PostgreSQL ani ścieżki HTTP.
- Blok 3 i dropdown miały w jednej linii pełne env RealPG, `ENABLE_TEST_AUTH_BYPASS=false`, `ENABLE_V8_GLOBAL=true`, tryb enforce, lokalny `DATABASE_URL` oraz `--retry=0`; testy montują realny `ApiGateway`.
- Zielone testy scenariuszy nie zostały nazwane dowodem mutacyjnym. Tam, gdzie nie wolno było usunąć zabezpieczenia, wynik pozostaje czerwonym kontraktem.
- `ai.agentHubRateLimitRouting` nie dotyka bazy i dowodzi wyłącznie przypisania limitera.

## Artefakty poza repo i SHA-256

- `blok1-po.json`: `11c2bce3a69b3f79379c880bb1331f8b006b2f0eb53653e1cb7650da06a256c9`
- `blok2-po.json`: `92ddc9f51c48b90445d4087760f359c143a9c3a9d03ce5771e790110e72c491a`
- `blok3-po.json`: `0bdfcea3a2128d662a1411b2d9a4cdc15a04dfecfba29561c7ede5caee5eb52f`
- `r3-execution-dropdown.json`: `fc0923efd577e90cb030a03f2a4d2c1210220bfba56d4ad9f8f971b60eb02c3d`
- `r3-red-contracts.json`: `3b882866064686709b1ce84f287896ae522ecd0c2034486cf283324ad9cb16c0`
- `przed-nazwy.txt`: `1304b950c2f7803fa5e2c1dadb579742ebdf95cabacfbf36df03f0bf0d4b7b46`
- `po-nazwy.txt`: `57a6290535623cab1e96b066b3bd9a5e4cd87e7035cfd237533684c6aed07d3b`
- `przed-po-nazwy.diff`: `5c0aa47a7a7c9a58a6acdbfc8104320aa21fbd5f1cde0b4d3a20bf40ca92b056`

## Sprzątanie i dysk

- Przed pierwszym startem: 40 GiB wolne.
- Po pierwszym cyklu: 19 GiB wolne.
- Po dodatkowym czystym cyklu dla dropdown i `docker rm -fv cx-day353-pg`: 20 GiB wolne.
- Kontener `cx-day353-pg` usunięty wraz z wolumenem.
