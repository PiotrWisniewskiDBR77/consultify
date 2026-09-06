# P11 — raport Plan i Obciążenie (DEC-421), runda 2

## Werdykt

**GOTOWE DO ODBIORU — 7/7 mutacji RED, bez deklarowania odbioru właścicielskiego.** Obowiązkowy merge `codex/m03-admin-20260824` wykonano przed zmianami. Rejestr ma 13 kart i pokrywa inwentarz 22 pozycji. Na realnym PG powstał opublikowany plan 5 inicjatyw / 12 tygodni i opublikowana analiza z przeciążeniem roli Controls Engineer.

## Przed → po

| miara | runda 1 | runda 2 | wynik |
|---|---:|---:|---|
| wpisy `REJESTR_KART_N` | 10 | 13 | PASS |
| pozycje inwentarza / poza rejestrem | 22 / 12 | 22 / 9 z jawnym powodem | PASS |
| realny plan | 0 | 2 rekordy, w tym 1 opublikowany | PASS |
| plan wymagany przez DEC-421 | brak | 5 inicjatyw / 12 tygodni | PASS |
| realna analiza obciążenia | brak | 12 okresów z luką / 1 rola | PASS |
| trwałość `name` i agregat legacy bez `name` | NOT PROVEN | RealPG GREEN | PASS |
| publikacja konfliktowa bez jawnego potwierdzenia | możliwa | serwer odrzuca; ślad zapisuje kto/kiedy/N/treść | PASS |
| mutacje zabezpieczeń | 0/7 | 7/7 RED, następnie GREEN | PASS |
| runtime karty/generatora/analizy | dev-render z 7 błędami | realna trasa, 1440×900 light, 0 błędów konsoli | PASS |

## Rekordy i ślad produktu

- Główny plan klikany: `plan-f807b6fd-357e-40ba-860c-cc7de75afedc`, `PUBLISHED`, wersja 3, 5 okien inicjatyw, 12 tygodni.
- Plan przygotowujący scenariusz: `p11-dec421-plan-20260906`, `DRAFT`, 5 okien, 12 tygodni.
- Analiza: `p11-dec421-capacity-20260906`, `PUBLISHED`, wersja 2, 12 okresów, 12 luk, rola Controls Engineer.
- Scenariusz portfela: `p11-dec421-portfolio-20260906`; rekordy utworzono przez istniejące serwisy komend produktu i UOW. Nie wykonywano ręcznej korekty `ie_aggregate_state` dla danych DBR77.
- Klikany przepływ: `Nowy plan` → karta → generator pięciu kroków → generowanie propozycji → zatwierdzenie → powrót do listy. Propozycja została zapisana ze statusem `ACCEPTED`.

## Dowody runtime i DOM

Zrzuty `runda2-00`–`runda2-09` wykonano na własnym Vite `3191` z `VITE_DOTENV_DISABLED=1` i `VITE_API_TARGET=http://127.0.0.1:4100`. Każdy PNG ma 1440×900, motyw light, a odpowiadający JSON ma `bledyKonsoli: []` i `odpowiedziHttp: []`.

- Lista planów: pierwsza kolumna `NAZWA`; dwa wiersze są planami, oba mają liczbę inicjatyw `5`.
- Skan tekstu DOM listy: 0 wystąpień `aco-`, `ie-`, `scenario-<cyfry>` i UUID.
- Karta planu pokazuje: `Controls Engineer: popyt 2 FTE, podaż 1 FTE — przeciążenie 100%.`
- Karta analizy pokazuje: `Okresy z luką: 12 · Role: 1`.
- Pliki: `evidence/p11-plan-obciazenie/runda2-*.png` oraz sąsiednie `*.png.json`.

## Bramka publikacji i RealPG

Serwer wylicza konflikty przy `PUBLISH`. Przy `N > 0` akceptuje wyłącznie dokładne potwierdzenie `Publikuję mimo N konfliktów` z zgodnym `conflictCount`; w przeciwnym razie odrzuca komendę. Po akceptacji zapisuje w scenariuszu i audycie `confirmedBy`, `confirmedAt`, `conflictCount` oraz `statement`. `window.confirm()` zastąpiono jawnym dialogiem aplikacji i payloadem serwerowym.

Na `127.0.0.1:54400/consultify_noc`:

- `planScenario.name.realdb.test.ts`: GREEN — zapis/odczyt `name` i zgodność agregatu legacy bez `name`;
- `planPublish.konflikt.realdb.test.ts`: GREEN — odrzucenie bez potwierdzenia oraz zapis śladu po dokładnym potwierdzeniu;
- fixture używają osobnych `organization_id`; po testach pozostało 0 organizacji fixture P11.

## Mutacje i test końcowy

Siedem osobnych wyników RED i opis zmian znajduje się w `evidence/p11-plan-obciazenie/mutacje/README.md`. Po przywróceniu kodu:

- UI/rejestr: 5 plików, 8/8 testów GREEN, w tym rejestr 3/3;
- RealPG: 2 pliki, 2/2 testy GREEN;
- razem końcowo: 10/10 testów GREEN, 0 failed, 0 skipped.

## Znaleziska poza zakresem

- Pusta tabela `StandardTable` pokazuje angielskie `No items found`. Zgłoszone jako zastane znalezisko StandardTable; nie jest zmianą P11.
- API uruchomione na porcie 4100 pochodziło ze starszej tożsamości kodu i podczas pierwszego kliknięcia nie przeniosło `name`. Ten sam rekord został uzupełniony przez aktualny serwis produktu z worktree; trwałość aktualnego kontraktu jest osobno dowiedziona testem RealPG. Nie przedstawiam starszego procesu 4100 jako dowodu aktualnej implementacji serwera.

## Commity rundy 2

- `750c98a3c3` — trwała bramka publikacji i `name` RealPG;
- commit dowodów runtime, scenariusza i raportu — patrz historia gałęzi po zamknięciu rundy.
