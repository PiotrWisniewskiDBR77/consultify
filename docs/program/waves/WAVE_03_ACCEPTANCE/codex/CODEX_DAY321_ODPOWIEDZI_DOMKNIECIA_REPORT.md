# DYŻUR 321 — odpowiedzi domknięcia

Stan: **PARTIAL — rdzeń R2 i R4 dowiedziony; R1 wykonany jednostkowo na 4 kodach, ale bez pełnego HTTP; R3 i R5 zmierzone, niewykonane.**

Marker: `bc18bc7acac2ec825ebb3db2f1309738ab034d58`. Gałąź: `codex/day321-odpowiedzi-domkniecia-20260904`.

## Wejście i rozjazd linii

```text
MARKER OK
bc18bc7acac2ec825ebb3db2f1309738ab034d58
status --short: (pusto)
```

Tip wyprzedzał marker o dwa commity wyłącznie z instrukcjami: `0a7e3ddb33`, `dfbd98a25a`. Pracę rozpoczęto dokładnie z markera.

Pomiar wejściowy: mapper 113 linii; `undefined` 115; `req` 188; razem 442 wywołania w 72 plikach; 251 unikalnych klas `*Error extends Error`; `.details\\b` 0 (wynik fałszywy), `.details` 125; `organizations.id TEXT PRIMARY KEY`. Zasoby przed startem były wolne, dysk miał 73 GiB. Kontener: `cx-day321-pg`, port 6337; harness 5477 nie był uruchamiany.

## R1 — decyzja i wykonanie

| Decyzja | Uzasadnienie | Zakres |
| --- | --- | --- |
| C: słownik dla rozpoznanych kodów, surowy tekst jako jawny fallback | Front `src/utils/apiError.ts:93` wyświetla bezpośrednio `message`/`error`; serwer musi więc zwrócić język użytkownika. Fallback zachowuje niezinwentaryzowane kontrakty zamiast masowej zmiany 251 klas. | `PROGRAM_NOT_ACTIVE`, `FINANCE_SETTINGS_INVALID`, `NOT_FOUND`, `COMMAND_CAPABILITY_DENIED` |

| Kod | HTTP | PRZED `pl` | PO `pl` | PO bez nagłówka |
| --- | ---: | --- | --- | --- |
| `PROGRAM_NOT_ACTIVE` | 409 | surowy angielski | `Program OKR nie jest aktywny, dlatego nie mozna otworzyc nowego cyklu.` | `The OKR program is not active, so a new cycle cannot be opened.` |
| `FINANCE_SETTINGS_INVALID` | 400 | surowy angielski | `Ustawienia finansowe sa nieprawidlowe.` | `The finance settings are invalid.` |
| `NOT_FOUND` | 404 | surowy angielski | `Nie znaleziono szablonu.` | `Template not found.` |
| `COMMAND_CAPABILITY_DENIED` | 403 | surowy angielski | `Nie masz uprawnien do wykonania tej operacji.` | `You are not authorized to perform this action.` |

Dowód: mapper 9/9 GREEN (`r1-restored-green.json`). Mutacja polskiego `PROGRAM_NOT_ACTIVE` na angielski: 8/9, dokładnie jeden RED (`r1-mutation-red.json`). `errorCode` i status pozostają bez zmian. **STOP MERYTORYCZNY R1:** nie wykonano wymaganych realnych żądań ApiGateway/JWT/PG dla tych czterech klas; wykonanie jest zatem dowiedzione jednostkowo, nie runtime.

## R2 — guard niezależny od nazwy

Stare ratchety pozostały bez zmian: `REMAINING=0`, `ALTERNATE=44`. Nowy mianownik, wyznaczony z nazw zmiennych rzeczywistych klauzul `catch`, wynosi `VARIABLE_AGNOSTIC=47`. Guard liczy tylko odpowiedzi HTTP; okno loggera zostało zachowane.

| Mutacja | RED | Po cofnięciu |
| --- | --- | --- |
| `dbFailure` w `db-metrics.routes.ts` | 3/4 | 4/4 |
| `storageFault` w `final-batch.routes.ts` | 3/4 | 4/4 |
| `unexpectedFault` w `public-contact.routes.ts` | 3/4 | 4/4 |

Artefakty: `r2-dbFailure-red.json`, `r2-storageFault-red.json`, `r2-unexpectedFault-red.json`, `r2-final-green.json`.

## R3 — req w helperach

Komenda `rg -l -0 ... | xargs -0 node scripts/dev/codemod-error-mapper-req.mjs --check` dała: `eligible=0`, `noReq=112`, 34 pliki. Tekstowy mianownik `, undefined,` nadal wynosi 115. Pierwsza próba w zsh przekazała całą listę jako jeden argument i dała `ENAMETOOLONG`; skorygowano ją wejściem NUL.

**STOP MERYTORYCZNY R3:** nie wykonano klasyfikacji (a)/(b)/(c), grup commitów, testów języka ani mutacji cofającej `req`. Żadnego z 112 miejsc nie zmieniono. Licencja sprawdzona: trasy i istniejący codemod mają pełną licencję wyłącznie dla R3. Zamiast zmiany dostarczono zweryfikowany mianownik i pełną listę w wyjściu codemodu. Rekomendacja: osobny przebieg grupami 10 plików; nie deklarować domknięcia lokalizacji bez tego dowodu.

## R4 — tekstowe identyfikatory organizacji

Globalny wymóg UUID usunięto przed sprawdzeniem członkostwa. Parametryzowane zapytanie członkostwa nadal wyznacza dostęp. Dla magazynu `tp_service_accounts.organization_id uuid` tekstowy tenant nie wykonuje niezgodnego zapytania i dostaje uczciwą pustą listę.

SQL na bazie dyżuru: `non_uuid_organizations = 4`.

| Aktor | ID organizacji | HTTP | Ciało istotne |
| --- | --- | ---: | --- |
| właściciel | UUID | 200 | `{success:true,data:[]}` |
| właściciel | tekst | 200 | `{success:true,data:[]}` |
| obcy | UUID | 403 | `code=ADMIN_BOUNDARY_VIOLATION` |
| obcy | tekst | 403 | `code=ADMIN_BOUNDARY_VIOLATION` |

Realny ApiGateway + podpisany JWT + PostgreSQL: 4/4 (`r4-gateway-pg-green.json`, SHA-256 `61bfb7ee...`). Mutacja przywracająca globalny UUID: 3/4, czerwony wyłącznie `owner/text` (`r4-mutation-uuid-red.json`); po cofnięciu poprzedni pełny przebieg 4/4. Test jednostkowy trasy: 5/5.

## R5 — dług policzony

| Rodzina | PRZED | PO | Stan |
| --- | ---: | ---: | --- |
| stary `ALTERNATE` | 44 | 44 | bez wzrostu, bez napraw |
| nowy catch-variable-agnostic | brak ochrony | 47 | nowy ratchet, odsłonięty dług |
| unikalne `*Error extends Error` | 251 | 251 | bez masowej migracji |

**STOP MERYTORYCZNY R5:** nie sporządzono wymaganej pełnej tabeli 44 wycieków ani analizy osiągalności wszystkich 251 klas. Nie obniżono ratchetu bez naprawy. Dostarczono nowy mianownik 47 i ochronę przed wzrostem. Do pełnego domknięcia potrzebny jest osobny, parserowy inwentarz przepływu trasa → mapper → klasa.

## Zasięg testów po nazwach

Przed: guard miał 3 pełne nazwy; mapper 5. Po: 18/18 dla guardu, mappera i jednostkowej trasy. Dodane nazwy: cztery `appErrorMapper localizes ...`, `raw route error response guard does not depend on the exception variable name`; osobno realdb dodał cztery nazwy `Day 321 service accounts identifiers through ApiGateway ...`. Nie zniknęła żadna istniejąca nazwa. `po-nazwy.json` SHA-256 `659bd7a3...`.

## Pułapki dowodowe

Jednostkowe pakiety biegły z `RUN_DB_TESTS=0 MOCK_DB=true`; nie dowodzą DB ani Gateway. R4 biegł z `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, jawnym `DATABASE_URL` portu 6337, `JWT_SECRET` i `--retry=0`; pierwszy test asertował `DB_TYPE=postgres`, a strażnik RealPG był wołany bez argumentów.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Co się zmieniło dla klienta

Cztery rozpoznane komunikaty biznesowe mogą teraz wracać po polsku, gdy klient prosi o język polski, i po angielsku bez takiego nagłówka. Kod błędu i status HTTP nie zmieniły się. Administrator organizacji o tekstowym identyfikatorze może ponownie otworzyć listę kont serwisowych zamiast dostać 400 albo 500. Użytkownik z obcej organizacji nadal nie zobaczy tych danych.

## Korekty wobec instrukcji

- Własne pomiary potwierdziły 115/188/251 i 112 helperów; `.details` wynosi 125.
- Port 6337 po uruchomieniu kontenera jest widoczny w `lsof` jako proces `ssh`; przed startem był wolny i jest wyłącznym forwardingiem kontenera dyżuru.
- `--config server/vitest.config.ts` nie odkrył mappera (0 testów); właściwy był rootowy config.
- Pełny import Gateway przekraczał 60 s; bez zmiany infrastruktury testowej lokalny timeout `beforeAll` ustawiono na 120 s.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano R1 na realnych trasach dla czterech klas; brak dosłownych odpowiedzi runtime PL/EN.
- Nie sklasyfikowano ani nie naprawiono 112 helperów R3.
- Nie ustalono runtime-osiągalności całej rodziny 251 klas.
- Nie zinwentaryzowano ręcznie wszystkich 44/47 pozycji długu według rodzaju danych możliwych do ujawnienia.
- Nie uruchomiono produkcji, demo, stagingu, Railway ani CI; ich stan pozostaje `NOT_PROVEN`.

## Commity

- `7cc4c6c63a` — R1
- `c98b80a6a5` — R2
- `daa57407af` — R4

