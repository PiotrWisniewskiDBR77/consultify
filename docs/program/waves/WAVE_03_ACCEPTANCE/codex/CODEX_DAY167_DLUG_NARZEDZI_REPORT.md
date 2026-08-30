# CODEX DAY 167 — dług narzędzi pomiarowych

Data: 2026-08-30  
Marker: `22124537f7`  
Gałąź: `codex/day167-dlug-narzedzi-20260830`  
Werdykt: **PARTIAL**

## §0.1 — baza i sanity (wynik dosłowny)

```text
bda3e98958 pomiar mechaniki: ROI dziala, wskaznik ma blokade na starcie, cel ma dziure na check-inie
332fa332bd lista inicjatyw: wyrenderowana pod wlasna nazwa — istniala schowana pod ekranem od i18n
d3c30bfb06 docs(codex): dyzury 166 i 167 wydane — domkniecie karty decyzji, splata dlugu narzedzi pomiarowych
76996ee069 odbior: wszystkie 196 ekranow ma opis GDZIE JEST i PO CO
05c8df153d docs(codex): dyzur 165 wydany — wznowienie agenta po akcepcie kroku, koniec klamstwa 'zakolejkowane'
1aa942cb32 ROI: trzy ekrany scalone w JEDNA karte N — prototyp do decyzji
22124537f7 merge: dyzur 161 (lancuch migracji od pustej bazy przechodzi 868/868 — A; bramka niewpieta — C) — odbior adwersaryjny
ac5ba6dc3d odbior 161: lancuch od zera przechodzi (868/868, A), inwentarz B z nieujawniona luka parsera, bramka C bo niewpieta
a84f0deae3 merge: dyzur 162 (napis o cofaniu przestal klamac — A; pochodzenie B) — odbior adwersaryjny
5e022a3e0a odbior 162: klamstwo o cofaniu usuniete (A, mutacja odtworzona), pochodzenie B — plakietka na dzialajacej sciezce nadal klamie
2705ecc435 merge: dyzur 160 (brama zapisu zadan potwierdzona realnym HTTP — A, dowod mutacyjny niezalezny) — odbior adwersaryjny
809414d395 odbior 160: A na rdzeniu z niezaleznym dowodem mutacyjnym; 22 pliki pisza do tabeli tasks; cztery ciche powierzchnie 409
6b48e34d9c kanon: smuga Teresy zostaje czerwona (wyjatek zatwierdzony) + Ocena i Audyt to dwa moduly
174080c277 koordynacja: jedna wspolna paczka odbioru — ekran wchodzi, gdy gotowe sa obie polowy
56d289f0c4 koordynacja: co zostaje torowi funkcji po podlaczeniu karty decyzji
3c62aeab3d karta decyzji: komentarze, alternatywy i ryzyka ida teraz NA SERWER
bced36a6ff docs(day160): record owned resource cleanup
d0b9784cd9 docs(day160): complete task writer evidence and decision brief
21221ca50f docs(day162): record provenance closure evidence
d48031ecfa test(day160): measure task write gate on real postgres
894739cfc6 fix(day162): make task provenance and rollback audit honest
52b6007faf docs(day161): clean report formatting
0fe521cd02 docs(day161): record resumed fresh-chain revalidation
4c8f2750a9 rejestr: cztery warianty prototypu prawego pasa do odbioru
286ff49271 stany bledu + prototyp jednej formuly prawego pasa
MARKER OK
22124537f7c4e5ac523dc97ada2291f955721e3c
```

`status --short | head -3` nie wypisał żadnej linii. Dysk: 36 GiB wolne. Porty `6058`, `5002`, `5003` były wolne. Tip uciekł do przodu; pełny log i lista 70 ścieżek są w `base-tip-log.txt` i `base-tip-files.txt` w katalogu artefaktów. Start pozostał dokładnie na markerze; bez rebase.

## R1 — CLI wybiera bazę

Zmiana: `server/vitest.config.ts` używa `process.env.DB_TYPE || 'sqlite'` wyłącznie w licencjonowanej linii.

- przed: jawne `DB_TYPE=postgres` dało czerwony pełny przypadek `Day 132 ... uses the effective PostgreSQL test environment`, `expected 'sqlite' to be 'postgres'`;
- po: identyczny pakiet na lokalnym PG `127.0.0.1:6058/cx167` przeszedł 2/2, w tym ten sam `fullName`;
- bez `DB_TYPE`: przed i po identyczne agregaty: 13 685 total, 10 693 passed, 512 failed, 2 471 pending. Korpus jest zastanie czerwony. Porównanie nazw ujawniło losowe UUID w siedmiu nazwach oraz dwa przeciwne flaki statusu (`finance-owner-grants` pass→fail, `submit-review` fail→pass), dlatego same agregaty nie są przedstawiane jako semantyczna równość.

Pułapki Z33: (c) została zmierzona bezpośrednio czerwonym przypadkiem przed i zielonym po; pakiet real-DB miał pełne env w jednej linii, `--retry=0`, JSON i własny `DATABASE_URL`. (a), (b), (d) nie były przedmiotem asercji, ale zostały jawnie ustawione odpowiednio `ENABLE_V8_GLOBAL=true`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, `ENABLE_TEST_AUTH_BYPASS=false`.

Commit/push: `7d0f853a83`.

## R2 — prawda o rollbacku i inwentarz

`tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts` asertuje teraz `rollback_unavailable` i `false`; pakiet przeszedł 5/5 z pełnymi nazwami w JSON. To pakiet jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`); pułapki (a)–(d) nie leżą na jego ścieżce, a (e) dotyczy właśnie usuniętej sprzeczności asercji z zachowaniem.

Commit/push: `2e89fc7bce`.

### STOP — R2 / `wave3-governance-contract.test.ts:116`

Rodzaj: MERYTORYCZNY  
Powód: licencja pozwala zmienić wyłącznie linię 116, lecz `rollbackStateForResult` jest prywatna, callback testu jest synchroniczny, a jedyną wartością dostępną w tej linii jest tekst źródła; w tych granicach nie da się wykonać zachowania. Regex lub `not.toContain` nadal mierzyłby tekst i osłabiał test.  
Licencja, którą sprawdziłem: zapis `tests/unit/ai/wave3-governance-contract.test.ts` wyłącznie linia 116; pozostałe linie i `server/src/**` są nietykalne.  
Dowód: `server/src/services/aiActionExecutor.ts:145` deklaruje funkcję bez `export`; test `:113` ma synchroniczny callback, `:114` ładuje tekst, `:116` wykonuje tekstowe `toContain`.  
Co dostarczyłem ZAMIAST zmiany: zielony test behawioralny w pierwszym licencjonowanym pliku i brief: rozszerzyć licencję na osobny test/import lub eksportować czystą funkcję w osobnej decyzji.  
Co zrobiłbym po decyzji: dodałbym bezpośredni kontrakt funkcji i mutację `rollback_available`, oczekując czerwonego testu, następnie przywrócił kod przez kopię i potwierdził zielony przebieg.  
Rekomendacja: rozszerzyć licencję testową; nie eksportować prywatnej funkcji tylko dla testu bez decyzji właściciela.  
Stan: linia 116 niezmieniona. Pozostałe pozycje kontynuowane: TAK.

Inwentarz własny: kryterium to plik testowy zawierający `readFileSync`, literalną ścieżkę `src/` lub `server/src/` oraz `toContain`. Wynik klasyfikacji strukturalnej: **107 plików / 1 557 linii asercji**. To nie twierdzi, że każda z 1 557 asercji dotyczy tej samej zmiennej; dlatego B4 pozostaje `PARTIAL`. Pełna lista `ścieżka:linia` znajduje się poza repo w `r2-source-tocontain-inventory.txt`; lista 107 plików w `r2-source-tocontain-files.txt`. Żaden z nich poza licencjonowanym pierwszym plikiem R2 nie został zmieniony.

## R3 — automatyczna bramka migracji

Pomiar na `cx-day167-pg:6058`: bramka `23,27 s`; istniejący hook `3,29 s`. Hook jest świadomie lekki, więc wybrano CI. Dodano jedną linię w `package.json` i osobny workflow uruchamiany przy zmianach migracji/skryptu na push/PR do gałęzi programu. Workflow ma jawny krok `docker version`, a następnie skrypt npm.

Lokalny przebieg dokładnie przez nowy skrypt npm zakończył się `DAY161_FRESH_MIGRATION_GATE=PASS`. Oryginalny `scripts/dev/day161-fresh-migration-check.sh` nie został zmieniony; SHA-256 `5cbb19c9396ecf7aefc20cbd6cc0b93b3b96dfc2981a587770f7810c8dd15ebd`.

Oficjalny obraz `ubuntu-latest` mapuje dziś na Ubuntu 24.04, którego [manifest runnera](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md) zawiera Docker Server 28.0.4. Z39 zabrania realnego uruchomienia workflow, dlatego nie ma logu joba GitHub Actions i B5 pozostaje **PARTIAL** mimo lokalnego PASS i statycznego wpięcia.

Commit/push: `c006b38d52`.

## R4 — wieloklauzulowy parser

Skrypt `scripts/dev/day167-column-inventory.mjs` odtworzono od zera; nie kopiowano scratcha dyżuru 161. Wynik na 1 073 plikach SQL:

| wariant                  | `ADD COLUMN` | rozpoznani producenci | `PRODUCER_NOT_PARSED` | kandydaci inwersji |
| ------------------------ | -----------: | --------------------: | --------------------: | -----------------: |
| stary: pierwsza klauzula |        3 456 |                 3 032 |                   424 |                 24 |
| nowy: wszystkie klauzule |        3 456 |                 3 393 |                    63 |                 27 |

`trusted_devices.credential_hash` ma producenta w `20261039_settings_mfa_challenges.sql:18`. Lista kandydatów zmieniła się 24→27 w jawnej, ograniczonej metodyce konsumentów (`ALTER ... ALTER COLUMN`, `UPDATE ... SET`). To nie są trzy potwierdzone defekty produktu i nie porównuję tych liczb z nieodtwarzalnym historycznym 5→5.

Commit/push: `b8e5aa90ca`.

## Z30 — brak wysyłki

Przed zapisami środowisko zwróciło `BRAK ZMIENNYCH POCZTY`; po migracji zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy; `Gateway.ts` nie zawiera startu drenaży. **Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

## Korekty wobec instrukcji

1. Tip bazowy wyprzedza marker o 13 commitów; zgodnie z DEC-2026-08-26-95 wystartowano z markera.
2. Domyślny korpus server Vitest nie jest zielony; 512 zastanych failures uniemożliwia literalny dowód „ta sama lista PASS”, a dwa flaki zamieniły statusy mimo identycznych agregatów.
3. B3 jest niewykonalne w licencji jednej linii bez dalszego mierzenia tekstu lub zmiany poza licencją.
4. Z39 („dowód statycznie”) wyklucza wymagany przez B5 realny log joba CI. Wybrano bezpieczniejszą interpretację: nie uruchomiono workflow.
5. Własny parser R4 daje 24→27 kandydatów w opisanej metodzie, nie historyczne 5→5.

## Artefakty i cleanup

Katalog: `/private/tmp/cx-day167-dlug-narzedzi-artefakty`.

- `r1-before-cli-postgres.json` — `5f22713ec4886a85cb66dbdf11982e7b272ae33c39acad58d2779dfa67facd9c`
- `r1-after-cli-postgres.json` — `7cb3a66096ba0751210fd7787233c6e39cc23b6a7d4046606aaa2ab22e0c25fe`
- `r1-before-default.json` — `50344a0611814922f72d82bb580405291f7587ba29ace3fa833aebd27b95fcfb`
- `r1-after-default.json` — `c031bc5e51d945119bf2bdebac9788b72befbe05395bffca794bdf85e5ac239a`
- `r2-runtime-after.json` — `0685ebcc49a464e85183ae92f6e20f5bafaa05bfdd888379aa88b36a49f291b4`
- `r2-source-tocontain-inventory.txt` — `313836e1f92730598a93df796cb777b179981a2f5415ce77834c44171ca35a34`
- `r3-gate-stdout.log` — `53484d0e2b2605832f1663ec883df84d733f54697a4b3f83eda80afe27afa419`
- `r4-column-inventory.json` — `6fcfc80ec204113779534619abb9b988a9b0a7027b92897e965df43d17250a10`

Kontener `cx-day167-pg` usunięto przez `docker rm -fv`; po cleanupie nie istnieje. Nie było połączeń do Railway, demo, stagingu ani produkcji.

## Zakres zmiany

```text
.github/workflows/day161-fresh-migration-gate.yml
package.json
scripts/dev/day167-column-inventory.mjs
server/vitest.config.ts
tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY167_DLUG_NARZEDZI_REPORT.md
```

Zero zmian w `server/src/**`, `src/**`, `server/migrations/**`, globalnym `vitest.config.ts`, helperach testowych i treści skryptu day161.
