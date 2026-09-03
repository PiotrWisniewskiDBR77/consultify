# CODEX DAY 286 — G15 samokontrola integratora

Stan: W TOKU. Marker `35afcb15fd`; baza porównawcza `f65c4ff6a0`; gałąź `codex/day286-g15-samokontrola-20260903`.

## Dowód wejścia

```text
MARKER OK
35afcb15fd7a432ab83df04208eb2114f1aa44e9
git status --short: pusty
```

Tip `github-backup/grafika/m03-20260902` uciekł do przodu; zgodnie z `DEC-2026-08-26-95` praca zaczęła się dokładnie z markera, bez rebase. Nowszy tip scala nadzorca.

## Korekty wobec instrukcji

1. `§0.1`, weryfikacja (5), oczekuje tych samych dziewięciu czerwieni po obu stronach. Pomiar z `--retry=0` dał na bazie `3 failed | 1 passed`, a na markerze `9 failed | 1 passed`. Sześć czerwieni `executionWorkResources` jest zatem NOWYCH; nie wolno ich nazwać zastanymi.
2. `§0.1`, weryfikacja (6), oczekuje pięciu testów bezpiecznika. Lokalny plik na markerze zawiera i uruchamia dwa; wynik `2 passed`. Bezpiecznik jest zielony, lecz liczba autora jest nieaktualna.
3. `§0.1` umieszcza testy przed uruchomieniem bazy, natomiast `Z20` nakazuje najpierw kontener i pełne migracje. Zastosowano bezpieczniejszą regułę `Z20`: lokalny `pgvector/pgvector:pg16` na `127.0.0.1:6290`, 885 migracji w pierwszym przebiegu i 0 w drugim.
4. `§0.1` kieruje do `tests/setup.ts:855-900`; definicja atrapy `global.fetch` zaczyna się później i zwraca `ok: true`, `status: 200`, `{data: []}`. Teza o atrapie jest potwierdzona, wskazany zakres linii jest nieprecyzyjny.
5. Instrukcja odwołuje się do nieobecnego `§0.3` i „tabeli licencji”. W wydanym pliku po `§0.2d` następuje `§0.5`; brakującej tabeli nie improwizowano. Pliki niewymienione imiennie są tylko do odczytu, a zmiana produktu będzie ograniczona do czerwonego testu zgodnie z `Z40`.

## Pomiary wejściowe

- Zasięg produktu między markerami: `118 files changed, 3227 insertions(+), 2583 deletions(-)`.
- Dwie migracje P0 istnieją: `20260903_ai_user_tiers.sql`, `20260903_help_categories.sql`.
- Porty `6290`, `5250`, `5251` były wolne; wolne miejsce przy starcie: 29 GiB.
- Serwerowa komenda kontrolna z cwd `server/` uruchomiła pliki i zakończyła się po 32,35 s; `No test files found` nie wystąpiło.

## Z30 — brak wysyłki

Przed przebiegami zapisującymi: środowisko zwróciło `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy; `server/src/Gateway.ts` nie montuje drenaży outboxu. Nie uruchomiono `server/src/index.ts` ani żadnego drenażu.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R1 — mapa i dwa markery

Mapa 16 modułów, katalogi testów, mianowniki i lista współdzielonych zmian znajdują się w `REJESTR_G15_SAMOKONTROLA_20260903.md`. Worktree bazowy `/private/tmp/cx-day286-baza` wskazuje `f65c4ff6a01c1eb3b3bcb2d1e84a1d299649d711`; worktree dyżuru wskazuje `35afcb15fd7a432ab83df04208eb2114f1aa44e9`.

## Pułapki dowodowe

Każdy dalszy pakiet otrzyma indywidualny wpis: atrapa `fetch`, mock bazy, cwd/config serwera, porównanie baza/marker oraz strażniki wyłączające się w `NODE_ENV=test`. Wynik liczbowy bez pełnych nazw z JSON nie będzie traktowany jako dowód G15.

## Tabela G15 per moduł

Do uzupełnienia po R2-R6. `MODULE_ACCEPTANCE.md` nie jest edytowany.

