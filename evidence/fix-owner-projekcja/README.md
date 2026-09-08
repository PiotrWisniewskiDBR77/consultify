# D4b — naprawa literału „Przypisany właściciel" w rejestrze Inicjatyw

Stanowisko: `mvp/fix-owner-projekcja`, SHA startowe `b4baaca48f`.

## Przyczyna

`src/components/Initiatives/initiativeRegisterProjection.ts:336` (przed naprawą):
`toCanonicalInitiativeRegisterItem` znała tylko dwie ścieżki rozwiązania
właściciela — dopasowanie do zalogowanego aktora i heurystykę „nie wygląda
jak UUID → sformatuj jako imię". Dla realnego UUID-a spoza obu ścieżek (czyli
KAŻDEGO wiersza z rejestru runtime-v1, który niesie tylko `initiativeOwnerId`)
zwracała surowy polski literał `'Przypisany właściciel'`. Zmierzone na danych
Northwind: 8 z 13 wierszy (wszystkie `IN_EXECUTION` i `APPROVED` backlog).

## Naprawa

`toCanonicalInitiativeRegisterItem` przyjmuje opcjonalny trzeci parametr
`resolveMemberName` — resolver `userId -> nazwisko`, dokładnie ta sama mapa
członków organizacji, której już używają Execution/Results
(`useOrganizationMemberNames`, `src/hooks/useOrganizationMemberNames.ts`).
`InitiativesHub.tsx` woła ten hook i przekazuje resolver do adaptera.
Gdy katalog nie zna identyfikatora, `ownerBusiness` zostaje `undefined`
(nigdy literał, nigdy surowy UUID) — kolumna renderuje uczciwe „—"
(`CanonicalInitiativeRegister.tsx`).

## Dowód na żywych danych Northwind

Baza: `consultify_kopia_d9` (PG18 :54418, TEMPLATE `consultify_staging_kopia`).
Seed: `01-rdzen.ts --apply` + `03-inicjatywy.ts --apply --api` (łańcuch
register→plan→analiza→schedule→handoff→execution_case przez kanonicznych
pisarzy), `--verify` → **31/31 asercji PASS** (13 inicjatyw, 7 statusów,
`IN_EXECUTION=4`, dokładnie fikstura D4b).

**Odchylenie od zlecenia (uzasadnione, opisane niżej):** API uruchomione na
porcie **4193**, nie 4190 — Node/undici (fetch spec, `node v24.12.0`) ma 4190
(ManageSieve) na liście zablokowanych portów („bad port"); seed w
`03-inicjatywy.ts` loguje się przez wbudowany `fetch`, więc na 4190 dostawał
`TypeError: fetch failed { cause: Error: bad port }` — to defekt środowiska
(Node), nie kodu produktu. Port 4191 okazał się zajęty przez INNĄ,
równoległą sesję (`wt-d7`) — nie mój proces. Vite na **3210** (zgodnie ze
zleceniem). Serwer/Vite ubite po zrzutach, kopia bazy i plik haseł usunięte
(patrz STOP-y w meldunku).

### Zrzuty (1440×900, jasny motyw, prawdziwe logowanie OWNER Northwind)

| Plik | Stan | Język | Werdykt |
|---|---|---|---|
| `przed-initiatives-owner-en-light-1440.png` | przed naprawą | EN | literał „Przypisany właśc..." w 8/11 widocznych wierszy (polski tekst w angielskim UI) |
| `przed-initiatives-owner-pl-light-1440.png` | przed naprawą | PL | ten sam literał w 8/11 wierszy |
| `po-initiatives-owner-en-light-1440.png` | po naprawie | EN | realne nazwiska (Priya Sharma, Emily Carter, Laura Novak, Daniel Osei, Michael Grant ×2, Sarah Mitchell, Robert Chen) we WSZYSTKICH wierszach |
| `po-initiatives-owner-pl-light-1440.png` | po naprawie | PL | to samo, kolumna „WŁAŚCICIEL" |

„Przed" i „po" wyprodukowane tym samym Playwright-owym skryptem
(`dev-render/shot-owner-d4b.mjs`, usunięty po użyciu — jednorazowy harness),
logowanie realnym kontem `james.whitfield@northwind.example`
(`/private/tmp/dane-pokazowe-en/northwind-konta-d9.txt`), przełączanie
motywu przez menu profilu, języka przez `PUT /api/users/:id {language}`
(SSOT języka to `account > localStorage > navigator` —
`server/src/controllers/UserController.ts:47`).

## Testy

`src/components/Initiatives/__tests__/initiativeRegisterProjection.ownerName.test.ts`
— 6 testów: rezolucja przez mapę, nigdy-literał z pustym resolverem, nigdy-literał
bez resolvera wcale (bezpiecznik regresji), priorytet aktora zalogowanego,
zachowanie heurystyki dla starych slugów non-UUID, `undefined` gdy brak
właściciela. Mutacja RED potwierdzona: `git stash` na dwóch zmienionych
plikach → 3/6 testów czerwone dokładnie na literale; `git stash pop` → z
powrotem 6/6 GREEN.

## tsc

`NODE_OPTIONS=--max-old-space-size=8192 tsc -p tsconfig.json --noEmit` → 192
błędów (baseline zastany, ani jeden nowy w dwóch zmienionych plikach ani w
nowym teście — jedyny błąd w `InitiativesHub.tsx` na liście to
przedistniejący `TS2345` w linii 612, niezwiązany ze zmianą).
