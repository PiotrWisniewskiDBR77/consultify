---
doc_id: funkcje-znalezisko-tool-outputs
status: canonical
owner: piotr
truth_type: runtime
established: 2026-08-31
---

# Moduł 03 Narzędzia — blokada NIE ISTNIEJE. Komentarz w kodzie kłamie od trzech dni

## Co twierdził kod
`src/utils/toolsInsightsWiringFlag.ts`, komentarz przy funkcji rozstrzygającej flagę:

> „OFF again since the 2026-08-28 revert, DEC-158 — **`tool_outputs` does not exist
> on the staging database**"

Na tej podstawie rekonesans wpisał moduł 03 jako „1 dyżur, **niewykonalny bez
dostępu do bazy staging**", a nadzorca zaklasyfikował go jako **jedyną pozycję fali
Z1 wymagającą własnej ręki**.

## Co zmierzono (staging, sesja tylko-do-odczytu, 31.08 wieczorem)

| pomiar | wynik |
| --- | --- |
| `to_regclass('tool_outputs')` | **`tool_outputs`** — tabela **ISTNIEJE** |
| `946_tool_outputs_reports_lineage.sql` | **`success`** |
| `947_tool_outputs_idempotency_guard.sql` | **`success`** |
| `948_tool_promotion_idempotency.sql` | **`success`** |
| kiedy zastosowano 946 | **2026-08-28 09:35 UTC** |
| wierszy w tabeli | 0 (pusta, ale gotowa) |

Migracje weszły **28.08 o 09:35**. Komentarz mówiący, że tabeli nie ma, opisuje
stan sprzed tej godziny i **nie został zaktualizowany**. Cofnięcie flagi (DEC-158)
mogło być słuszne w chwili podejmowania, ale **jego uzasadnienie przestało być
prawdą tego samego dnia**.

## Skutek
Moduł 03 leżał trzy dni z etykietą „zablokowany dostępem do bazy". **Nie był
zablokowany.** Zablokował go komentarz.

## Co z tego zostaje do zrobienia
Nie migracja — ta jest zrobiona. Zostaje:
1. **sprostować komentarz** (to samo, co dziś zrobiono z „NOT MOUNTED YET" przy
   trasie finansowej i z nieaktualnym „shadow mode" przy `gate-roles` — **trzeci
   przypadek tego samego dnia**);
2. **retest** ścieżki `GET /api/tool-outputs` na stagingu z włączoną flagą lokalnie;
3. **decyzja o fladze** — `VITE_TOOLS_INSIGHTS_WIRING` zostaje domyślnie WYŁĄCZONA
   do akceptu właściciela na czystym zrzucie (`CLAUDE.md` §9: nigdy nie włączamy
   flag wizualnych hurtem; jeden ekran po drugim, po akcepcie).

Pozycja **przestaje wymagać ręki nadzorcy** i wraca do puli normalnych dyżurów.

## Wniosek do katalogu kłamstw
**Komentarz uzasadniający decyzję starzeje się razem z decyzją — i nikt tego nie
sprawdza.** Trzy przypadki jednego dnia, każdy blokował albo mylił realną pracę.
To najtańsza do wykrycia klasa: każde twierdzenie komentarza o **stanie bazy, trasy
albo flagi** da się porównać z rzeczywistością maszynowo.

## Wykonanie — Day225

Na markerze `0a35699021` wykonano wyłącznie lokalny retest, bez połączenia do stagingu,
demo ani produkcji. Świeży PostgreSQL w kontenerze `cx-day225-pg` zastosował `879`
migracji, drugi przebieg zastosował `0`; log zawiera 946/947/948, a `tool_outputs`
istnieje i początkowo ma `0` wierszy.

Test przez realny `ApiGateway` i podpisany JWT potwierdził pusty odczyt ownera
`200 { outputs: [] }`, następnie bezpośredni zapis lokalnego wiersza i jego HTTP/SQL
readback `200`, a bez tokenu `401` bez danych. Kanoniczny lokalny runtime
`W3-TOOLS-OWNER-v1`, uruchomiony na `127.0.0.1:5124/5125`, przy query
`?ff_toolsInsightsWiring=1` zwrócił `GET /api/tool-outputs` `200` i pokazał zakładkę
Insighty bez błędu pełnoekranowego.

Retest lokalny POTWIERDZA, że blokada opisana w DEC-158 nie istnieje na tej bazie po
migracjach — ścieżka działa. Flaga `VITE_TOOLS_INSIGHTS_WIRING` pozostaje domyślnie
WYŁĄCZONA. Włączenie wymaga osobnej decyzji właściciela na czystym zrzucie. Pełny raport:
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY225_NARZEDZIA_REPORT.md`.
