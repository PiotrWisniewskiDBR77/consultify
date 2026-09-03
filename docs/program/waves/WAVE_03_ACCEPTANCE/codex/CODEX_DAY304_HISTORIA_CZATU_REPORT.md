# CODEX DAY 304 — historia Czatu prywatna / organizacyjna

## Wejście

- HEAD: `416432abafe31a390a909cf7e460a4bad7bef191`; `MARKER OK`; worktree czysty.
- porty 5286/5287/6308 wolne, 41 GiB wolne, kontener wyłącznie `cx-day304-pg`.
- pełne migracje na pustej bazie: `Postgres migrations complete`; drugi przebieg `Applying migrations: 0`.
- Z30: brak zmiennych poczty, 0 wierszy `smtp%`, 0 drenów w `Gateway.ts`; `server/src/index.ts` nie uruchomiono.

„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.”

## R1 — pomiar

Tabela tras, porównanie schematu i funkcje panelu: `docs/program/prototypy/HISTORIA_CZATU_ZAKRESY_20260903.md`.

Korekty: panel ma dokładnie 1365 linii, ale zna zakresy; definicji `CREATE TABLE IF NOT EXISTS conversations` są trzy, nie dwie; wzorzec `cross-org-idor.test.ts` ma 1939 linii i w katalogu jest 11 nazw zawierających `idor`.

## R2–R6 — stan po R1

Do rozliczenia po osobnym commicie R1. Zastany kod ma istotną część funkcji, ale reguła widoczności nie jest jednym miejscem. Nie pokazano kosmetycznego podziału jako nowego wyniku.

## Test bazowy

`conversations.search.realdb.test.ts`: 12/12, pełne nazwy w `/private/tmp/cx-day304-historia-czatu-artefakty/przed.json`, `--retry=0`, realny PG 6308 i podpisany JWT. Ograniczenie Z22: test montuje `conversationsRoutes` w gołym Express, nie przez `ApiGateway.initializeRoutes`, więc **nie jest dowodem produkcyjnego montażu**; potwierdza zachowanie routera na PG, w tym parę członek widzi / obca org nie widzi.

Pułapki Z33: komplet env wymusił PG, auth bypass=false; suite sama ustawia E2E_MODE dla części ścieżek, a negatyw członkostwa używa podpisanego JWT. Nie używam jej jako dowodu Gateway ani jako pełnego R4.
