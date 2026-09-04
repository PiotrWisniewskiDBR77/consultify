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

Do uzupełnienia po pomiarze obiekt po obiekcie.

## R3 — commity `checkpoint`

Do uzupełnienia.

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
