# CODEX — dyżur 295 — Moja Praca i Inicjatywy

Stan raportu: `IN_PROGRESS`. Baza: marker `58ef0771d7`; tip bazowy uciekł do `984d3658fd`, bez rebase.

## Wejście — wynik dosłowny

```text
58ef0771d746124c42361d0a37c653790b7c4cfa
```

`git status --short | head -3` nie wypisał żadnej linii. Marker:

```text
MARKER OK
```

Porty 5268, 5269 i 6299 były wolne; liczba kontenerów `cx-day295`: `0`. Dysk przed worktree: 20 GiB wolne; po checkout: 5,3 GiB, czyli powyżej wiążącego progu 5 GiB.

## R1 — pomiar

Wyniki i tabela punktowa są w `REJESTR_MOJAPRACA_INICJATYWY_DOWODY_20260903.md`. Teza instrukcji o braku całej ścieżki konfliktu była częściowo nieaktualna: istnieją 409, trwały banner i dwa wybory; brakowało porównania. Teza o osobnym pliku narzędzia mapy myśli również jest fałszywa: mapa jest hostowana przez `IdeaMapWorkspace.tsx`.

## R3 — konflikt 409

RealPG: `/private/tmp/cx-day295-mojapraca-inicjatywy-artefakty/conflict-realpg.json` — 3/3 PASS, `--retry=0`, realny Postgres 6299, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`. Pierwszy przebieg z 30-znakowym sekretem z instrukcji został odrzucony przez harness (wymaga >=32); bezpiecznie powtórzono z lokalnym, dłuższym sekretem.

Pułapki: (a) wyłączona przez `ENABLE_V8_GLOBAL=true`; (b) przez tryb `enforce`; (c) przez `MOCK_DB=false DB_TYPE=postgres` i realny read/write; (d) przez `ENABLE_TEST_AUTH_BYPASS=false`; (e2) przez `RUN_DB_TESTS=1` i port 6299. Test używa własnego `express()`, więc zgodnie z Z22 dowodzi routera, JWT i Postgresa, lecz **nie dowodzi montażu przez `ApiGateway.initializeRoutes`** — to pozostaje `NOT_PROVEN`.

UI: dodano PL/EN wybory `Zachowaj moje / Weź cudze / Porównaj`; porównanie pokazuje lokalny tekst i świeżą kopię zwróconą przez 409. Test zachowania przechodzi; ostrzeżenia `act(...)` są zastane.

## Z30 — deklaracja testów

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Zasięg testów

Przed zmianami: 149 pełnych nazw w `/private/tmp/cx-day295-mojapraca-inicjatywy-artefakty/przed-nazwy.txt`. Porównanie `przed`/`po` zostanie uzupełnione przy R6; sama liczba nie jest werdyktem.

## Twierdzenia niezweryfikowane

- mianowniki DOM i efekty każdej kontrolki czterech narzędzi Idei;
- komplet 32 kadrów Idei + klawiatura + a11y;
- zrzuty Inicjatyw PRZED/PO na realnym rekordzie;
- montaż konfliktowej trasy przez produkcyjny `ApiGateway.initializeRoutes`.

