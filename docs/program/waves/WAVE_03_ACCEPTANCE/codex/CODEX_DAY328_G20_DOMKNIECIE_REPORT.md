# CODEX — dyżur 328 — domknięcie bramki G20

Data pomiaru: 2026-09-04. Marker: `1c3d3da844ae03c87985a8f5dc74846a073c0220`.

## Start

`merge-base --is-ancestor` zwrócił `MARKER OK`; `rev-parse HEAD` zwrócił pełny marker powyżej, a `status --short` był pusty. Tip `github-backup/grafika/m03-20260902` uciekł do przodu; zgodnie z instrukcją praca rozpoczęła się dokładnie z markera. Baza i runtime nie były potrzebne: licznik jest pakietem czysto jednostkowym, więc porty 6354/5494 pozostały wolne i kontener nie powstał.

## R1 — dowód `fetch-depth`

Pomiar offline przez `file://`, z tej gałęzi i bez sieci:

| Klon | Historia | Kod | BLOKUJE |
|---|---:|---:|---|
| `--depth 50` | 564 commitów | 1 | 49 = 17 `NIEROZSTRZYGNIETE` + 32 `SHA_NIEISTNIEJACY` |
| pełny | 15923 commity | 1 | 17 = 17 `NIEROZSTRZYGNIETE` |

Mechanizm: `gitShaState()` używa `git cat-file -e <sha>^{commit}` i `git merge-base --is-ancestor`. Cytowane SHA są odległe od HEAD o 3951, 4462, 4594, 4178 i 4186 commitów, więc klon płytki ich nie zawiera. `test-suite.yml` reaguje na `push`/`pull_request` tylko dla `[main, develop, Londyn, demo]`; linia `grafika/m03-*` i gałąź dyżuru nie wyzwalają workflow. Realny przebieg CI przed scaleniem nie istnieje, a `Z39` zabrania jego ręcznego wywołania. Dowodem naprawy `fetch-depth: 0` jest zatem równoważna para klonów offline.

Artefakty: `plytki-output.txt` (`a4c27e26215e8135374ecbfa5fc70a24b6b6e43198f55d54620674e36612b81d`) i `pelny-output.txt` (`b94cda78b1508978e5a7f80591f3cdc03eeb4bc537f239d21afd1fa3f994c040`). Przed klonami było 57 GiB wolne; po ich trwałym usunięciu 56 GiB. Oba katalogi klonów nie istnieją.

Dodany test: `R1: SHA_NIEISTNIEJACY z DAY320_RESOLUTIONS blokuje z dokładnym powodem`. Mutacja usuwająca obsługę tego stanu dała kod 1 i różnicę `actual NAPRAWIONE / expected BLOKUJE`; po cofnięciu przez `cp` pełny pakiet dał kod 0, 10/10 PASS. `git diff` pliku produkcyjnego po cofnięciu był pusty.

## §0.2e — pułapki pomiaru

Pułapki (a)–(d) nie dotyczą pakietu: `grep -lE "ApiGateway|verifyToken|v8FeatureGate|resultsInternalBetaVisibility" scripts/dev/p0p1-licznik-e1.mjs scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` nie zwrócił trafień. Dotyczy pułapka (e): głębokość historii; wyłączono ją pełnym klonem, a para 49/17 dowodzi wpływu środowiska.

## R2 — rozstrzygnięcie 17 pozycji

Komenda dla każdego wiersza: `rg -n -F <ID> <pięć wejść pathsFor>; git log --all --oneline --grep=<ID> -10`. Pełny wynik: `/private/tmp/cx-day328-g20-domkniecie-artefakty/r2-evidence.txt`. Lista własna była identyczna z listą 17 z instrukcji.

| ID | Wynik pomiaru / obiekt rozstrzygnięcia | Werdykt |
|---|---|---|
| `ASM-OWN-001` | `DEC-2026-09-03-367` mówi „TAK, teraz”, więc nie zamyka realizacji; brak funkcyjnego SHA biblioteki metodyk | BLOKUJE |
| `ASM-OWN-002` | ta sama DEC nakazuje zmianę kolumn; brak SHA wykonania | BLOKUJE |
| `ASM-OWN-003` | `DEC-2026-09-03-364`, ledger: „PO BRAMKACH (fala 2)” i imienna lista obejmuje 003 | ZAMKNIETE_DEC |
| `EXE-OWN-001` | `DEC-2026-08-24-03`: „Zamyka przyczynę EXE-OWN-001” | ZAMKNIETE_DEC |
| `EXE-OWN-003` | źródło wymaga lokalnego seeda, a historia nie zwróciła SHA | BLOKUJE |
| `EXE-OWN-005` | źródło nazywa zmianę „pending checkpoint”; brak commita Menu 3 | BLOKUJE |
| `FIN-OWN-001` | źródło podaje ancestry bez jednoznacznego SHA; `d8561ed5c2` jest identyfikatorem runtime, nie dowodem naprawy | BLOKUJE |
| `INI-OWN-001` | źródło dowodzi tylko 1 niekompletnej inicjatywy zamiast 11; brak kompletnej fikstury i przeglądu | BLOKUJE |
| `INT-INIT-AI-OBS-001` | brak osiągalnego wołacza i dowodu z realnym providerem; statyczny git nie rozstrzyga | BLOKUJE |
| `MYW-CAL-REC-002` | decyzje ustalają kierunek, ale dokument jawnie mówi „wdrożenie NADAL OTWARTE”; brak SHA schematu | BLOKUJE |
| `MYW-CAL-REC-003` | `DEC-222` pozostawia wdrożenie nie rozpoczęte; brak SHA UI artefaktu | BLOKUJE |
| `MYW-CV-REC-002` | kod jest opisany jako zastany; historia po ID nie dała SHA naprawy | BLOKUJE |
| `RES-OWN-003` | brak licencjonowanego writera i cold readbacku 4/3/3 na PostgreSQL | BLOKUJE |
| `RES-OWN-004` | zachowanie opisane jako pre-existing; brak SHA zmiany lub decyzji zamykającej | BLOKUJE |
| `TLS-CHAIN-OWN-001` | `DEC-2026-08-28-238` imiennie zakazuje budowy „4 klas wyniku TLS-CHAIN” | ZAMKNIETE_DEC |
| `TLS-MENU-OWN-001` | ta sama DEC imiennie obejmuje „menu TLS-MENU” | ZAMKNIETE_DEC |
| `TLS-REC-OWN-001` | ta sama DEC imiennie obejmuje „etap Rekomendacji TLS-REC” | ZAMKNIETE_DEC |

Po zmianie: kod 1, `BLOKUJE: 12`, wszystkie z powodem `NIEROZSTRZYGNIETE`. Spadek 17→12 wynika wyłącznie z pięciu obiektów DEC istniejących w ledgerze; pozostałe dwanaście zostało imiennie otwartych z brakującym dowodem. Zmieniona została istniejąca asercja R6: fixture dostała realną `DEC-2026-08-24-03`, a oczekiwany kontrakt EXE-OWN-001 zmienił się z nierozstrzygniętego na `ZAMKNIETE_DEC`.

## R3 — commity `checkpoint`

| Pozycja | Stary dowód | `git show --stat` | Rozstrzygnięcie |
|---|---|---|---|
| `MYW-CV-REC-001` | `af75a84e37`, `checkpoint: preserve wave 3 owner review work` | 156 plików, 12076+/2009−; szeroka migawka wielu modułów | `NIEROZSTRZYGNIETE`: brak izolowanego SHA zmiany Vault table/preview |
| `MYW-DEC-REC-001` | `4a36e8a745`, `checkpoint wave 3 recovery candidate` | 82 pliki, 3733+/499−; szeroka migawka | `NIEROZSTRZYGNIETE`: brak izolowanego SHA Decisions list |
| `MYWORK-DEC-OWN-001` | ten sam `4a36e8a745` | ten sam wieloobiektowy diff | `NIEROZSTRZYGNIETE`: odwołanie do tej samej nieizolowanej zmiany |

Decyzja semantyczna: commit o temacie zawierającym słowo `checkpoint` nie jest dowodem naprawy. `gitShaState()` po sprawdzeniu istnienia i ancestry odczytuje temat przez `git log -1 --format=%s` i zwraca osobny `SHA_CHECKPOINT`; klasyfikator raportuje go jako `BLOKUJE`. Trzy zastane wpisy przeklasyfikowano jawnie, więc nie stoją już na checkpointach. `BLOKUJE` wzrosło 12→15 — to celowe przywrócenie uczciwych blokad, nie przeniesienie do łagodniejszego kubełka.

Test `R3: commit checkpoint jest widoczny i blokuje zamiast udawać naprawę` podstawia `af75a84e37` do mapy rozstrzygnięć. Z rozróżnieniem: pełny pakiet kod 0, 11/11 PASS. Mutacja usuwająca rozróżnienie: kod 1, dokładnie ten test czerwony, `actual NAPRAWIONE / expected BLOKUJE`. Po cofnięciu przez `cp`: kod 0, 11/11 PASS; w pliku produkcyjnym została wyłącznie zamierzona zmiana R3.

## R4 — dziedziczenie DEC

Do uzupełnienia.

## R5 — sprostowanie raportu 301

Do uzupełnienia.

## Korekty wobec instrukcji

- Odległości SHA wynoszą 3951–4594, a nie 3952–4595.
- Pierwsze uruchomienie generatora zmieniło dwie linie metadanych rejestru; `git diff --stat` nie był pusty, wbrew oczekiwaniu instrukcji. Plik przywrócono przed zmianami.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano realnego workflow GitHub Actions: zabrania tego `Z39`, a filtry gałęzi nie obejmują gałęzi dyżuru.
- Nie zweryfikowano jeszcze rozstrzygnięć 17 pozycji ani treści trzech commitów `checkpoint`.
