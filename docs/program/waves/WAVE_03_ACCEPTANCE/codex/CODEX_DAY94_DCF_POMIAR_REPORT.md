# CODEX DAY 94 — DCF — RAPORT POMIAROWY

Data: 2026-08-29  
Marker: `d80dd85cc7784095eed6f711b42366e5d9b7f74e`  
Gałąź: `codex/day94-dcf-pomiar-20260829`  
Werdykt merytoryczny: **LICZBA POPRAWNA DLA ZAPISANYCH DANYCH; FCFF NIE JEST DODATNI.**  
Werdykt K1: **NIEZWERYFIKOWANE — realny ApiGateway zwrócił HTTP 500 w 3 z 3 prób, bez body.**

## 1. Związanie środowiska

Wynik §0.1(2), dosłownie (końcowy fragment):

```text
efd54054af docs(day90,92,93,94): cztery instrukcje zlozone skryptem ze szkieletu
05ed8ff336 docs(day91): instrukcja odbioru wizualnego Inicjatyw (zlozona skryptem ze szkieletu)
d80dd85cc7 docs(ledger): DEC-319..322 — gitignore polknal instrukcje 89, STOP 88 z bledu pomiaru, mylacy komunikat AI, odbior 89
MARKER OK
```

Wynik §0.1(7), dosłownie:

```text
d80dd85cc7784095eed6f711b42366e5d9b7f74e
```

`git status --short | head -3` nie wypisał linii. Dysk: `68 GiB` wolne przy progu `5 GiB`. Porty `5974`, `4848`, `4849`: `0 z 3` zajętych. Tip wyprzedza marker o `2` commity; różnica obejmuje `5` instrukcji, w tym instrukcję dnia 94. Worktree utworzono dokładnie z markera.

## 2. Baza, migracje, fixture i Z30

- kontener: `cx-day94-pg`, `127.0.0.1:5974`, `pgvector/pgvector:pg16`;
- baza: `consultify_w3_finance_owner_day94`;
- migracje: pierwszy przebieg PASS, readback `863 z 863`; drugi przebieg PASS, `Applying migrations: 0`;
- `server/migrations/^202617`: `0` plików;
- PDF: prawdziwy plik o SHA-256 `e993f390ccf5d67143b1076ef7b6d9eed23f234f1c29dc23892eeb57418e3c0e`;
- fixture: `2 z 2` testów PASS, `6 z 6` sprawozdań, manifest zachowanej bazy.

Dowody Z30 przed seedem:

```text
BRAK ZMIENNYCH POCZTY

 key | left
-----+------
(0 rows)
```

Grep trzech drenów w `server/src/Gateway.ts`: `0` trafień. **Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

## 3. B.2 — realny HTTP przez ApiGateway

Pakiet montował `ApiGateway.getInstance().initializeRoutes(app)`, podpisał JWT OWNER sekretem lokalnym i użył realnego PG. Pułapki Z33: `ENABLE_V8_GLOBAL=true`; `ENABLE_TEST_AUTH_BYPASS=false`; `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; strażnik real-PG uruchomiony bez argumentów; `DB_TYPE` jawnie ustawiony na `postgres` w `beforeAll`, ponieważ root config nadpisał wartość z powłoki.

Trzy podejścia:

1. `server/vitest.config.ts`: `0` suit / `0` testów — brak pomiaru.
2. root config: `1 z 1` testów uruchomiony, HTTP `500`, body `{}`.
3. root config + verbose: HTTP `500`, body `{}`; `1 z 1` FAIL na oczekiwaniu `200`.

Żądanie nie zwróciło `enterpriseValue`, `pvExplicit` ani `pvTerminal`. Po trzech podejściach zgodnie z §C: **NIEZWERYFIKOWANE dla K1**. Nie relabeluję zapisanego SQL jako sukcesu HTTP.

## 4. B.3 — rozkład zapisanej liczby

Niezależny readback SQL odtworzył zapis metody `DCF_FCFF`:

| Składnik | PLN |
| --- | ---: |
| EBIT 2026, suma `12 z 12` miesięcy | `24 424 022,0357025554` |
| EBIT po podatku 19% | `19 783 457,84891907` |
| amortyzacja, suma `12 z 12` | `7 075 977,9642974442` |
| CAPEX, suma `12 z 12` | `9 450 000` |
| otwierający kapitał obrotowy | `28 000 000` |
| zamykający kapitał obrotowy | `45 822 149,47210348` |
| zmiana kapitału obrotowego | `17 822 149,47210348` |
| **FCFF 2026 — `1 z 1` lat** | **`-412 713,658886965926`** |
| terminal value | `-6 583 276,926152029` |
| PV explicit | `-378 894,136595644` |
| PV terminal | `-6 043 815,059650238` |
| **EV** | **`-6 422 709,196245882`** |

Odpowiedzi `4 z 4`:

1. **FCFF nie jest dodatni.** Jedyny rok ma `-412 713,659 PLN`. Przyczyną znaku jest `EBIT × (1-tax) + D&A - ΔWC - CAPEX` w `server/src/services/finance/canonical/valuationFcffService.ts:267,329-341`. Wzrost WC plus CAPEX (`27 272 149,472`) przewyższa NOPAT plus D&A (`26 859 435,813`).
2. Forecast/FCFF składa `computeFcffSeries()` w `valuationFcffService.ts:251-350`; źródłem są `finance_baseline_outputs` wskazane przez `MODEL_TO_VALUATION`, ładowane w `valuationFcffService.ts:252-275`.
3. **Terminal jest ujemny**, bo Gordon używa ujemnego terminal-year FCFF: `TV = FCFF × (1+g)/(WACC-g)` w `valuationTerminalService.ts:48-59`; `g=2,5% < WACC=8,92585%`, więc mianownik jest dodatni, a znak pochodzi wyłącznie z FCFF.
4. Jednostki są spójne: wszystkie `48 z 48` komórek źródłowych mają `UNITS` i mnożnik `1`; normalizacja jest w `valuationFcffService.ts:230-244`. WACC i g są dzielone przez `100` dokładnie raz w `valuationTerminalService.ts:56-58` oraz `valuationDiscountService.ts:53-63`. Brak podwójnej konwersji procentów.

Wartości zapisane w tabelach (`EV=-6422709.196245814`, terminal `-6583276.926151959`) różnią się od niezależnego przeliczenia wyłącznie na końcowych cyfrach zmiennoprzecinkowych.

## 5. Werdykt i kontrakt

Jednoznaczny werdykt K5: **LICZBA POPRAWNA** dla zapisanych danych. Założenie „ujemne EV przy dodatnich przepływach” jest obalone: `0 z 1` rocznych FCFF jest dodatnich. Nie ma defektu wzoru ani jednostek, dlatego zgodnie z §B.4 nie dodano czerwonego kontraktu i nie zmieniono kodu produkcyjnego.

## 6. B.5 — EV → Equity

Dla mierzonego business version readback daje `0 z 1` wierszy `finance_valuation_ev_equity_bridge` i `0` komponentów. `equityValue` jest więc `null`. Konsument istnieje: `src/components/Benefits/ValuationWorkspace.tsx:240-245,1051-1057` czyta canonical bridge i renderuje Equity. **Brak zapisanego bridge dla tego fixture; konsument istnieje, lecz nie ma wartości do podniesienia.** Legacy `valuationService` zapisuje cały obiekt `results`, w tym `dcf.equityValue`, do `valuations.results` w `valuationService.ts:1073-1095`, ale fixture dnia 94 nie ma wiersza legacy `valuations` (`0` wierszy).

## 7. Korekty wobec instrukcji

1. §0.2c twierdzi, że komplet env w tej samej linii nadpisze `DB_TYPE`. Pomiar wykazał `sqlite`; root `vitest.config.ts` nadpisuje powłokę. Bezpieczna korekta: ustawienie `process.env.DB_TYPE='postgres'` przed strażnikiem, po czym DB identity potwierdziło `127.0.0.1:5974/consultify_w3_finance_owner_day94`.
2. §B.1 wskazuje dwa seedery bez rozstrzygnięcia. Wrapper `seed-wave3-finance-owner-review.ts` wymaga utworzenia nowej bazy i koliduje z bazą utworzoną wg §0.2c(A). Użyto `run-wave3-finance-owner-review.ts` na już zmigrowanej bazie.
3. Z15 wymaga „zero modelu językowego”. Fixture wszedł w kod `statement.mapping.llm_*`, lecz zakończył każdą próbę `no_provider_available`; nie ma dowodu zewnętrznego wywołania. Ten przebieg nie jest zaliczony jako czysty dowód Z15.
4. Pierwsze polecenie odczytu instrukcji wykonano przez `git show` z cwd checkoutu właściciela, zanim treść Z5 była znana. Był to odczyt, bez zapisu, ale naruszył literalne Z5. Wszystkie dalsze operacje wykonano wyłącznie z vaulta i `/private/tmp/cx-day94-dcf`.
5. Instrukcja odwołuje się do nieistniejącego §0.4a. Pomiar zakresu wykonano bez przepisywania cudzej liczby: zmienione pliki produkcyjne `0 z 0`, więc testy mapowane do zmienionego kodu `0 z 0`; uruchomione pliki dowodowe: fixture `1 z 1` plik PASS, Gateway `1 z 1` plik FAIL.
6. Teza zlecenia o dodatnich przepływach jest obalona pomiarem: FCFF `-412 713,659`, nie dodatni.

## 8. Kryteria

| Kryterium | Stan |
| --- | --- |
| K1 realny ApiGateway | **NIEZWERYFIKOWANE**, HTTP `500`, `3 z 3` podejść bez `200` |
| K2 PV explicit / terminal | **PASS pomiar SQL**, obie składowe ujemne |
| K3 FCFF rok po roku | **PASS `1 z 1`**, 2026 `-412 713,659` |
| K4 cztery odpowiedzi z plik:linia | **PASS `4 z 4`** |
| K5 werdykt | **LICZBA POPRAWNA** |
| K6 czerwony kontrakt | **NIE DOTYCZY**, brak defektu liczby |
| K7 rozłączność | **PASS**, raport + jeden wiersz modułu, `0` zmian produkcyjnych, `0` testów w HEAD |

## 9. Artefakty poza repo

| Plik | SHA-256 |
| --- | --- |
| `/private/tmp/cx-day94-dcf-artefakty/migrate-first.log` | `cb121929f50bad4d59948d613026e49bcf7e06f8b491f97c64eeeb23c9150d99` |
| `/private/tmp/cx-day94-dcf-artefakty/migrate-second.log` | `5b9de00a3adfed29567b4425b2c1884382e9704d617bdf645586cc6afef71358` |
| `/private/tmp/cx-day94-dcf-artefakty/finance-seed.log` | `dcd7849e991537107318cb39a65407b2c3beb5ac761e8ba79d7919776c3478bd` |
| `/private/tmp/cx-day94-dcf-artefakty/finance-day94-manifest.json` | `098582317d8c851e65177c55b564a9d1e80ed22451b600442b492f4f43bdc2f1` |
| `/private/tmp/cx-day94-dcf-artefakty/day94-gateway-measurement-attempt-3.log` | `1dbad082cdfa7878fe925e4a45a3df7e72ab72f312540ea291ec6e498ddaa013` |

## 10. Sprzątanie

Po zebraniu końcowych dowodów kontener jest usuwany przez `docker rm -fv cx-day94-pg`; żadne dane zdalne nie były odczytywane ani zmieniane.
