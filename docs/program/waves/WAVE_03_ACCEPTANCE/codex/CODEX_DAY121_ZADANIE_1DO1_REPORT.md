# CODEX DAY 121 — KARTA ZADANIA 1:1 — RAPORT

Data: 2026-08-29  
Gałąź: `codex/day121-zadanie-1do1-20260829`  
Marker: `a1265154b73f57a43cbe468993e4317bb2e0f02b`  
Commit rdzenia: `fc9e0b7eb2`  
Stan: `PARTIAL — RDZEŃ ZBUDOWANY, FLAGA OFF, 8/8 ZRZUTÓW; MODEL/RUNTIME NIE ZWRACA CHECKLISTY KARCIE`

## 0. Tożsamość i wejście

`git log --oneline -25 github-backup/codex/m03-admin-20260824` zawierał m.in.:

```text
63e7c979df merge: dyzur 119 — kontrakt trzech stanow w 3 komponentach; wycofal 2 pozorne integracje w martwym kodzie
aa564ad4f0 docs(day121-124): pierwsza budowa PO akcepcie + trzy rownolegle
a1265154b7 merge: day120-fixture-insight
```

```text
MARKER OK
```

Sanity worktree:

```text
a1265154b73f57a43cbe468993e4317bb2e0f02b
```

`git status --short | head -3` nie wypisał żadnej pozycji. Dysk: `46 GiB` wolne. Porty `6004`, `4908`, `4909`: `0 z 3` zajętych przed startem.

Tip gałęzi bazowej był przed markerem o `4` commity. Praca zgodnie z instrukcją wystartowała dokładnie z markera; scalanie tipa pozostaje po stronie nadzorcy.

## 1. Z30 — brak wysyłki

Przed migracjami zapisującymi i ponownie przed runtime:

```text
BRAK ZMIENNYCH POCZTY
 key | left
-----+------
(0 rows)
```

Grep drenaży w `server/src/Gateway.ts`: `0` trafień.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.

## 2. Migracje i runtime

- Postgres: `pgvector/pgvector:pg16`, kontener `cx-day121-pg`, port `127.0.0.1:6004`.
- Pierwszy przebieg: `863` migracje w stanie poprawnym; log: `/private/tmp/cx-day121-zadanie-1do1-artefakty/migrate-1.log`.
- Drugi przebieg: `Applying migrations: 0`, `Postgres migrations complete`; log: `/private/tmp/cx-day121-zadanie-1do1-artefakty/migrate-2.log`.
- Kanoniczny runtime: serwer `4908`, klient `4909`, health/ready/frontend `200/200/200`, auth bypass `false`, DB `consultify_w3_execution_owner_day121`, runtime manifest `/private/tmp/consultify-wave3-runtime-manifest-day121.json`.

## 3. B.1 — pomiar stanu zastanego i modelu

Stan zastany spełniał `2 z 5` cech:

1. Całość po polsku: `NIE` — nagłówki i pola zawierały m.in. `Description & Scope`, `Actions`, `Properties`, `Blocked Reason`.
2. Mianowniki: `TAK` — checklista pokazywała np. `0/6`.
3. Nazwane stany puste: `NIE` — część powierzchni używała `—`, `No suggestions`, `No relations` bez wyjaśnienia przyczyny.
4. Uprawnienia wypisane wraz z przyczyną: `NIE` — akcje były widoczne, ale karta nie wyjaśniała segregacji obowiązków.
5. Czerwień tylko przy blokadzie: `TAK` w mierzonym stanie — czerwony panel dotyczył wyłącznie blokady.

### Korekta tezy o modelu

`Task` w `src/types/core.ts` nie ma pola `completionCriteria`. Ma płaską `checklist?: ChecklistItem[]`, tekstowe `acceptanceCriteria?: string` oraz `dependencies` bez metadanych etapu. `completionCriteria` istnieje w innym typie (`StageGate`), nie w `Task`. Nie ma bezpiecznej podstawy do wyprowadzenia `3` etapów po `2` warunki. V2 nazywa tę granicę wprost i nie wymyśla etapów.

`dependencies` wystarcza do wskazania kierunku i statusu zależności w komponencie widoku, ale odczyt osobistego Zadania w tym runtime nie zasilił stanu `dependencies`; dlatego nie uznaję blokady zależności za potwierdzoną end-to-end.

## 4. B.2 — rdzeń za flagą OFF

Dodano dokładnie jedną flagę `ENABLE_TASK_CARD_V2`. `ENABLE_TASK_CARD_V2_DEFAULT = false`; opcja lokalnego odbioru działa przez parametr `?ENABLE_TASK_CARD_V2=1`. Gdy flaga jest OFF, wykonanie omija nową gałąź i przechodzi do niezmienionego dotychczasowego renderu N-mode.

Nowa karta zawiera:

- pełnostronicowy polski nagłówek i neutralny główny przycisk;
- warunki zamknięcia z mianownikiem;
- jawne zdanie, że model przechowuje płaską listę bez etapów;
- blokadę jako jedyną czerwoną sekcję;
- nazwane stany puste i jawny brak terminu;
- panel `Rola i uprawnienia` z dozwolonymi i niedozwolonymi działaniami oraz przyczyną;
- dowody z mianownikiem i nazwany brak bez podstawiania zera za nieznaną wartość.

## 5. B.2a — 8 z 8 zrzutów

| Flaga | Motyw | Dane | Plik | SHA-256 |
| --- | --- | --- | --- | --- |
| OFF | jasny | pusty | `off-light-empty.png` | `308c59d3a4c9de6407f0dd971ac05caa2b184c6a5c0304062ec3bc8f4d7881d5` |
| OFF | jasny | bogaty | `off-light-rich.png` | `245f58a04815489a8f66ded7791c5b96f35be69b5e8f3a7aac8ed826af6a0b52` |
| OFF | ciemny | pusty | `off-dark-empty.png` | `af06727b4c9622e03fe33770f6fafb921298c20bcc9bfb4cf70115cdee433e4e` |
| OFF | ciemny | bogaty | `off-dark-rich.png` | `1af0e2cd957a2c1a5190dd68a463d6dfff7d3c52782613ca86d3feb45324e431` |
| ON | jasny | pusty | `on-light-empty.png` | `5bc4e8c27a57abc0651e4b930371de7ffbcae469c950b52fb5a98a1b0b9acd8d` |
| ON | jasny | bogaty | `on-light-rich.png` | `c4f9f3a8b62ac15f0b08b233465411caa371932908b2d7111ee7e8fcc9afee8b` |
| ON | ciemny | pusty | `on-dark-empty.png` | `fa32335fda50c17d2172bc37ac52487a656a45361e2c2b76d6738dd5feddc816` |
| ON | ciemny | bogaty | `on-dark-rich.png` | `91ce377c77917382eee3cb8c1cf613b621861c69a804a8a4092014a20b041224` |

Katalog: `/private/tmp/cx-day121-zadanie-1do1-artefakty`.

Różnice wobec prototypu: brak etapów, podzadań, historii terminu, nazw dowodów brakujących i szczegółowego panelu powiązań, ponieważ bieżący kontrakt `Task`/API nie dostarcza tych danych. Nie zastąpiono ich fixture'em w kodzie produktu.

## 6. B.3 — dowód mutacyjny w obie strony

Komenda w obu kierunkach:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run src/components/MyWork/__tests__/TaskCardV2.contract.test.ts --retry=0 --reporter=json --outputFile=<plik>
```

- Zielony przed mutacją: `2 z 2 PASS` (`day121-focused-green.json`).
- Mutacja: etykieta `Rola i uprawnienia` → `Uprawnienia`.
- Czerwony: `1 z 2 PASS`, przypadek `niesie pięć zaakceptowanych cech i mianowniki` = `FAILED` (`day121-mutation-red.json`).
- Przywrócenie przez `cp` z `/private/tmp/cx-day121-zadanie-1do1-scratch/TaskCardV2.before-mutation.tsx`.
- `cmp` wypisał `DIFF MUTACJI PUSTY`.
- Zielony po przywróceniu: `2 z 2 PASS` (`day121-mutation-green.json`), finalnie ponownie `2 z 2 PASS` (`day121-focused-final.json`).

Pułapki Z33: pakiet jest czysto jednostkowym kontraktem plików, nie montuje `ApiGateway`, nie dotyka DB, auth ani bramek (a)–(d); uruchomiony z `RUN_DB_TESTS=0 MOCK_DB=true`. Pułapka (e) nie dotyczy, bo oba pliki wejściowe wskazano pełnymi ścieżkami.

## 7. B.4 — regresja po nazwach

Nazwy przypadków przed mutacją i po przywróceniu są identyczne: `2 z 2`, delta nazw `0`. Pełnej regresji repo nie uznaję za zmierzoną. TypeScript z `NODE_OPTIONS=--max-old-space-size=8192` doszedł do dwóch zastanych błędów poza licencją:

- `src/components/billing/UsageMeters.tsx(174,12): Cannot find name 't'`;
- `src/views/partner/sections/EarningsSection.tsx(448,19): comparison ... 'certified'`.

Zmodyfikowane pliki nie wniosły błędu TypeScript. ESLint zmienionego `TaskDetailView` ma `0` errors i zastane warnings; nowe pliki mają `0` errors, `1` warning o dynamicznej szerokości paska postępu.

## 8. Korekty wobec instrukcji i defekty runtime

1. Instrukcja przypisuje `completionCriteria` do modelu Zadania; pomiar wykazał, że pole należy do `StageGate`, a `Task` ma płaską checklistę.
2. Próba utworzenia Zadania z realnego produktu nadała klientowi identyfikator, lecz kolejne `PUT` zwracały `404 Not found`; `Start` zwrócił `Legacy execution writes are retired`. Nie naprawiano serwera (`server/**` poza licencją).
3. Lokalny wiersz fixture w tabeli `tasks` zawierał checklistę `6 z 6` oraz ownera, ale realny odczyt `Api.getPersonalTask` zasilił kartę jako `0 z 0` i `Nie wskazano`. To dowód braku propagacji, nie powód do wpisania fikcyjnych danych w UI.
4. Instrukcja odwołuje się do `§0.4a`, którego wydany plik nie zawiera. Zasięg mierzono własnym pakietem kontraktowym; pełnego denominatora repo nie deklaruję.

## 9. TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano odbioru wizualnego właściciela dla implementacji; istnieje wyłącznie wcześniejsza akceptacja prototypu.
- Nie zweryfikowano etapów warunków, bo model Zadania ich nie przechowuje.
- Nie zweryfikowano pełnej propagacji checklisty, ownera, dowodów i zależności przez realny endpoint odczytu Zadania.
- Nie zweryfikowano pełnej regresji repo ani delty wszystkich nazw testów.
- Nie zweryfikowano zapisu nowej karty, ponieważ realny `PUT` dla ścieżki stworzonego w UI Zadania zwracał `404`.
- Nie zweryfikowano trybu mobilnego/tablet; instrukcja zamawiała `8` zrzutów według flagi, motywu i stanu danych, bez osobnego breakpointu.

## 10. Pliki i kryteria

```text
src/components/MyWork/TaskCardV2.tsx
src/components/MyWork/TaskDetailView.tsx
src/components/MyWork/__tests__/TaskCardV2.contract.test.ts
src/components/MyWork/taskCardV2Flag.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY121_ZADANIE_1DO1_REPORT.md
```

- K1: `PASS` — stan zastany zmierzony `2 z 5` przed zmianą.
- K2: `PARTIAL` — komponent niesie `5 z 5` cech, ale runtime nie propaguje danych checklisty/ownera.
- K3: `PASS` — czerwony i zielony dowód, `--retry=0`.
- K4: `PARTIAL` — delta `0` dla `2 z 2` nazw pakietu; pełny denominator niezmierzony.
- K5: `PASS` — `8 z 8` zrzutów produktu ze stylami obejrzanych i zahashowanych.
- K6: `PASS` — sekcja niepusta.
- K7: `PASS` — lista plików mieści się w licencji §D.
