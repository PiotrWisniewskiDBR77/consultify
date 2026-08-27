# Audyty dzień 41 — łańcuch wytworzenia raportu i eksport — raport dyżuru 2026-08-28

## Marker, baza i bezpieczeństwo

Marker `23652ec80a`: `MARKER OK`. Worktree `/private/tmp/cx-audits41`, gałąź `codex/audits-day41-20260828`. Zgodnie z komendą właściciela gałąź powstała z `codex/day41-instrukcja-20260828`; trzy wcześniejsze commity ponad markerem zmieniały wyłącznie instrukcję.

- Z5/DEC-86: chroniony checkout nie był czytany ani modyfikowany; jedyny kontakt to dozwolony symlink `node_modules` tylko do odczytu.
- Z27: `git stash list` pusty; nie użyto stash.
- Z28: zero połączeń do demo, staging, produkcji i Railway.
- Wspólny renderer: `git diff --name-only 23652ec80a...HEAD | grep documentStudio` pusty; zmieniono w nim `0` linii.

## Dowód celu połączenia i REAL_PG

Port 5693 był zajęty przez `cx-day40-pg`; użyto pierwszego wolnego 5694. Efemeryczny `pgvector/pgvector:pg16`, baza `cx_day41`. Pełne migracje: `855`, wynik `Postgres migrations complete`.

Readback przez `pg.Client` (lokalnego CLI `psql` brak): `current_database=cx_day41; inet_server_port=5432; reports=0; outputs=0`.

`REAL_PG`: `verticalSlice.http.test.ts` — 2 PASS / 0 FAIL / 0 SKIPPED, 76.85 s. Każda komenda DB miała w tej samej linii jawne `DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5694/cx_day41 RUN_DB_TESTS=1 MOCK_DB=false ENABLE_V8_GLOBAL=true`.

## Bramka wejściowa

| Punkt | Otrzymane                                                     | Status |
| ----- | ------------------------------------------------------------- | ------ |
| 8a    | zero trafień `outputs/finalize\|finalizeOutput` w `src/`      | PASS   |
| 8b    | zero trafień `generateReport` w `auditsMethodApi.ts`          | PASS   |
| 8c    | dokładnie 3 trafienia; jedyny wołający `outputs.routes.ts:72` | PASS   |
| 8d    | 2/2 PASS, nie skipped                                         | PASS   |
| 8e    | `Eksport PDF` w linii 1283 (plus komentarz w 73)              | PASS   |
| 8f    | eksport renderera w linii 1952                                | PASS   |

Pozostałe warunki odpowiadały instrukcji: backend finalize/report i `Gateway` istnieją, klient nie miał komend, stan pusty twierdził „automatycznie”, migracji `202613*` brak, najwyższe ID to `AUD-PF-003` i `AUD-OWN-004`. Klient konsumował listę Outputów, listę/odczyt/approve/publish/presentation raportów oraz kryteria; nie konsumował `outputs/finalize`, `POST /reports` ani `link-material`.

## Pozycje

| Pozycja | Commit       | Status               | Dowód                                                                                   |
| ------- | ------------ | -------------------- | --------------------------------------------------------------------------------------- |
| D.1     | —            | NIE_WYKONANO         | brak osobnego strażnika real-PG                                                         |
| D.2     | `76715d40f7` | ZROBIONE_TECHNICZNIE | 14/14 kontrakt API; dwie komendy i ścisła koperta                                       |
| D.3     | `dea5aa8774` | ZROBIONE_TECHNICZNIE | 5/5; query > localStorage > env > default OFF; fail-closed                              |
| D.4     | —            | NIE_WYKONANO         | brak kontrolki i zrzutów                                                                |
| D.5     | —            | NIE_WYKONANO         | brak kontrolki i zrzutów                                                                |
| D.6     | `c4202e0437` | PARTIAL              | kłamstwo usunięte, PL/EN, wariant OFF/ON; 17/17 testów; brak zrzutów i pełnego testu ON |
| D.7     | `cc04f6efbc` | ZROBIONE_TECHNICZNIE | 10/10, w tym determinizm, placeholder, 13 sekcji i realny bufor ZIP >1 kB               |
| D.8     | `c287d797d7` | PARTIAL              | addytywna trasa i kompilacja; brak 6 testów real-PG/curl/oględzin pliku                 |
| D.9     | —            | NIE_WYKONANO         | PDF pozostaje uczciwie „Planowane”; brak kontrolki DOCX                                 |
| D.10    | —            | NIE_WYKONANO         | brak pełnego testu łańcucha                                                             |
| D.11    | —            | NIE_WYKONANO         | brak wiarygodnego pomiaru 42/150/300                                                    |
| R.1     | bieżący      | WYKONANO             | ten raport                                                                              |

## Odpowiedzi odbiorcze i mapa łańcucha

Nie da się jeszcze wytworzyć raportu z interfejsu: D.4 i D.5 nie zostały dowiezione. API klienta potrafi wywołać oba istniejące zapisy, ale przy domyślnej fladze OFF nie ma widocznej ścieżki.

Eksport oparto na istniejącym silniku. Adapter ma 211 linii; w `server/src/services/documentStudio/**` zmieniono 0 linii. Trasa korzysta z zaplombowanego `report.payload`, nie z `/presentation`.

Sprawa skali nie jest zamknięta: `POMIAR_NIEROZSTRZYGAJĄCY`, ponieważ D.11 nie wykonano i brak własnych liczb dla 42/150/300.

## Mapowanie 13 sekcji na bloki

`text → heading+paragraph`, `list → heading+bullet_list`, `table → heading+table`, `keyValue → heading+table`, `group → heading poziomu 2 + heading poziomu 3 + lista`. Kolejność sekcji pochodzi z payloadu. Puste treści dostają `[Brak danych: <nazwa sekcji>]`. Hash i wersja są w stopce. Fallback języka to `pl`, poufności to `restricted`.

## Testy i baseline §0.4a

- `services/audits`: 149 PASS / 0 FAIL / 21 SKIPPED.
- `routes/audits`: 16 PASS / 0 FAIL / 25 SKIPPED; bramka real-PG osobno 2/2 bez skip.
- `documentStudio`: 964 PASS / 9 FAIL oraz 1 suite ENOENT — czerwienie ZASTANE.
- golden DOCX: 13 PASS / 1 FAIL — zastany brak natywnego pola TOC.
- front Audytów: 107 PASS / 0 FAIL / 0 SKIPPED; flagi zastane 10/10 i 8/8.
- middleware członkostwa: 18 PASS / 0 FAIL.
- filtr `routes/__tests__ -t method-core`: 2 suite FAIL przy imporcie i 1185 SKIPPED; `NIE_ZMIERZONE`, nie PASS.

Końcowe testy punktowe: front 36/36 PASS; serwer adapter + real-PG vertical slice 12/12 PASS, 0 SKIPPED. Zasięg końcowy `CZĘŚCIOWY`: nie powtórzono całego §0.4a po zmianach, a D.8 nie ma własnego testu HTTP eksportu. Nie zgłaszam pełnego PASS.

## Polish-pass, zrzuty i migracje

`check-list-canon.sh` przeszedł bez nowych naruszeń. Brak kompletów OFF/ON × light/dark, dlatego pozycje frontowe nie mają statusu `ZROBIONE_WG_DoD`. Zero nowych migracji; nie zajęto zakresu `20261300`–`20261309`.

## Korekty wobec instrukcji

- `git fetch --all --prune` zwrócił błąd niedostępnego worktree zdalnego `icloud-source`; `origin` i `github-backup` pobrano.
- Właściwy migrator jest w `server/scripts/migrate.postgres.ts`, nie w podanej ścieżce `server/src/database/`.
- Lokalnego `psql` brak; readback wykonano biblioteką `pg` przez jawny URL.
- Testy serwera wymagają cwd `server`; uruchomienie z rootem i samym `--config` zwracało `No test files found`.
- D.2 wykonano przed D.1; osobny czerwony strażnik D.1 nie powstał.
- Prettier na dużych zastanych plikach D.6 spowodował nadmierny reformat; pozycja nie jest przedstawiana jako pełny DoD.

## STOP-y, znaleziska i twierdzenia NIEZWERYFIKOWANE

Nie wystąpił legalny STOP D.7: pięć rodzajów treści dało się wyrazić zastanymi blokami. Poza zakresem pozostają PDF, supersede UI, link-material/upload, kreator i wysyłka.

Nie zweryfikowano wizualnie ekranów ani otwarcia DOCX w edytorze, pełnej trasy eksportu przez HTTP na realnym PG, skali 42/150/300 ani pełnego końcowego zakresu §0.4a.

## Sprzątanie

Efemeryczny kontener i jego anonimowy wolumen usunięto komendą `docker rm -fv cx-day41-pg`.
