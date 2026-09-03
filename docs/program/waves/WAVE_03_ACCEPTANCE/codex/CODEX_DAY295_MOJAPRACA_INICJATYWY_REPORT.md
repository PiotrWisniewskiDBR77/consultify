# CODEX — dyżur 295 — Moja Praca i Inicjatywy

Stan raportu: `COMPLETE_WITH_LIMITS`. Baza: marker `58ef0771d7`; tip bazowy uciekł do `984d3658fd`, bez rebase.

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

## R2 — kontrolki czterech narzędzi Idei

Test `ideaTools.controlEnumeration.test.tsx` wykonał dwa przejścia po rzeczywistym DOM: stan bazowy oraz otwarte menu. Zielony wynik: 4/4 narzędzia. Stabilny mianownik unikalnych sygnatur `rola|nazwa`: Whiteboard 53, Mind map 65, Process flow 81, Table 27. Każdy dostępny wyzwalacz menu dowiódł efektu przez pojawienie się nowych kontrolek; komplet jest spięty hashem SHA-256, więc nowa lub zmieniona kontrolka bez aktualizacji kontraktu czerwieni test. `MARTWE`: brak w dowiedzionym zakresie interakcji menu. Artefakty: `idea-controls-live.json`, `idea-controls-unique.tsv`, `r2-a11y-green.txt` poza repo.

## R4 — komplet wizualny Idei

Powstały 32/32 kadry: 4 narzędzia × PL/EN × light/dark × 1440/1024, każdy po `Tab*5`. Brak błędów HTTP i konsoli w czterech pełnych przebiegach. Skan axe: 0 naruszeń na 32 kadrach po usunięciu pustego `h2` inspektora; osiem kadrów mapy myśli odtworzono po poprawce. Sumy kontrolne są w `/private/tmp/cx-day295-mojapraca-inicjatywy-artefakty/idee-32-sha256.txt`.

## R5 — Inicjatywy

Testy preview/smoke/kanonu: 138/138 PASS. Drobna naprawa zastąpiła własną, zdublowaną stopkę kanonicznym `PreviewActionBar`; widoczne są dwa kadry PO light/dark z otwartym podglądem realnego rekordu. Skan axe: 0 naruszeń. Harness zgłasza po 8 zastanych błędów konsoli 404 dotyczących brakujących mocków organizacji/użytkowników, dlatego pełny odbiór runtime Inicjatyw pozostaje `PARTIAL`. Kadru PRZED na tym samym markerze nie wykonano przed zmianą — nie rekonstruuję go po fakcie. Większe luki (pełne bloki domenowe kebaba i AI) są wpisane do fali 2.

## Z30 — deklaracja testów

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Zasięg testów

Przed zmianami: 149 pełnych nazw. Po zmianach: 160 pełnych nazw, 159 PASS i 1 świadomie pominięty test strażniczy dla braku URL harnessu; przy ustawionym URL właściwe 4 testy R2 przeszły. Diff zawiera wyłącznie 11 nowych nazw (R2: 5, inspektor: 6), bez zniknięcia nazw bazowych. Artefakty: `przed-nazwy.txt`, `po-nazwy.txt`, `nazwy.diff`, `po.json` poza repo.

## Granice dowodu

- montaż konfliktowej trasy przez produkcyjny `ApiGateway.initializeRoutes`.
- pełne zachowanie każdej nie-menu kontrolki Idei poza zinwentaryzowaniem jej sygnatury DOM;
- porównanie Inicjatyw PRZED/PO na tym samym markerze; istnieje wyłącznie PO;
- produkcyjny runtime Inicjatyw bez błędów 404 mocków harnessu.
