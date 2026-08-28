# DYŻUR 66 — TEST DEBT P1: RAPORT I KARTA DOWODOWA

Status: **PARTIAL**. Data: 2026-08-28.

## 1. Rodowód i rozstrzygnięcie instrukcji

- Marker: `6868d57ebcb346e7d4bf142eb89229bc6bcd3e98`.
- Baza `github-backup/codex/m03-admin-20260824`: dokładnie marker; `merge-base --is-ancestor` exit 0.
- Gałąź: `codex/day66-test-debt-p1-20260828`.
- Worktree: `/private/tmp/consultify-day66-test-debt-p1`.
- Instrukcja była pobrana z tipa `654ae1daf966e0fbc597faf103dd563b038d9eaa`, przeczytana w całości i zawierała związany marker oraz stan WYDANY.
- Instrukcja była wewnętrznie sprzeczna: cel, raport, polecenie DB i jawne polecenie nadzorcy wskazywały P1, ale §1, §2 i §6 zawierały nazwy `p6`. Zgodnie z §12 zastosowano spójny, węższy zakres P1. Nie utworzono gałęzi ani worktree P6.
- Wolne miejsce przed startem: 68 GiB. Tip bazy nie uciekł przed marker ani za marker.

Commity i push na jedyny dozwolony remote `github-backup`:

1. `b3886a458f` — `P1-DECCASE`, push po pierwszym commicie;
2. `31b87eb7bf` — `P1-T2`, push;
3. `ae2d0c1044` — czerwony kontrakt `P1-T2-PIN`, push;
4. `c45fc3e4c4` — czerwony kontrakt `P1-RED-FINAL-PIN`, push.

## 2. Ponowny mianownik P1

Parser:

```bash
git show 6868d57e:docs/program/waves/WAVE_03_ACCEPTANCE/TEST_DEBT_DAY59_MAPA.md \
  | awk '/^### P1 — dokładna lista plików/{on=1;next}/^### P2 — dokładna lista plików/{on=0}on' \
  | sed -n 's/^- `\(.*\)`$/\1/p'
```

Wynik: **59** ścieżek, **59** unikalnych, **59** istniejących, 0 brakujących. `git status --short` przed pracą był pusty.

## 3. Lokalny PostgreSQL i migracje

- Własny kontener: `cx-day66-pg`, `pgvector/pgvector:pg16`, `127.0.0.1:5938`, baza `cx_day66_testdebt`.
- Pierwszy pełny przebieg istniejącego runnera: 862 migracje, exit 0; SHA-256 logu `e1397a7dd80a3ce34c2c80f80e663e1e74b27718fb16e6173e3ddf5d4e08bf98`.
- Drugi przebieg: 0 migracji do zastosowania, exit 0; SHA-256 `6469a5c7aac57e4f8e4917569d6bb2dda3ce2b798c44441ac4874f088464657e`.
- Nie utworzono migracji z rezerwacji `20261660-20261669`.
- Nie użyto Railway, demo, stagingu, produkcji ani GitHub Actions.

## 4. Pomiar bazowy P1

Komenda zawierała wszystkie wymagane zmienne, literalny `JWT_SECRET=test-debt-day66-local-only` oraz `--retry=0`; uruchomiono dokładnie 59 plików P1. Wynik: 441 testów, 84 PASS, 60 FAIL, 297 pending; 166 suite, 97 czerwonych. SHA-256 JSON: `72b3f3bcb47421bb750fd7c96471d7af3977b4be8197dbd1684062052f37aadf`.

Ten wynik ujawnił sprzeczność: wymagany sekret ma 26 znaków, natomiast `tests/acceptance/harness.ts` wymaga co najmniej 32. Wiele suite nie doszło do asercji. Nie zmieniono harnessu, bo jest poza P1. Pomiar pomocniczy czterech obowiązkowych plików wykonano z jawnie oznaczonym dłuższym sekretem lokalnym: 102 testy, 97 PASS, 5 FAIL; nie jest on relabelowany jako zgodny przebieg końcowy.

## 5. Status przyczyn i obowiązkowych pinów

| Pozycja | Przed | Po | Status / werdykt |
| --- | --- | --- | --- |
| `odbior--deccase--initiative-status-case`: BEFORE unblock | zielony test utrwalał martwy lowercase CASE | brak wykonywalnej asercji historycznego błędu; kanoniczny BLOCKED→EXECUTING zielony | **naprawa testu; kanonizacja dziury usunięta** |
| `odbior--deccase--initiative-status-case`: BEFORE autoblock | czerwony na realnym CHECK, bo próbował wpisać lowercase `blocked` | brak wykonywalnej asercji historycznego błędu; uppercase BLOCKED/DONE zielony | **naprawa testu; kanonizacja dziury usunięta** |
| `t2-sla-flow`: fixture admina | oczekiwano losowego admina, runtime wybierał wspólnego `odbior--user-0001` | dedykowana organizacja; podstawowy SLA 2/2 zielony | **naprawa danych testowych** |
| `t2-sla-flow`: `assignment_kind=artifact` | oczekiwał eskalacji generic sweep i payloadu bez typu | oczekuje braku eskalacji i braku notification; test czerwony na `escalated_to_user_id` | **kanonizacja dziury → czerwony kontrakt; produkt poza P1** |
| `red-final-500s`: AI preferences | oczekiwał 500 `Failed to load route` | oczekuje 200, `success: true`, `data`; runtime daje 503 | **kanonizacja dziury → czerwony kontrakt; produkt poza P1** |
| `red-assess-500s` | mapa opisywała 8 oczekiwanych 500 | na markerze `KNOWN_RED={}` i pomocniczy przebieg 92/92 zielony | **PARTIAL**: stare piny już nie istnieją, ale wspólna asercja `<500` jest zbyt ogólna i nie została relabelowana jako właściwy kontrakt |

### Briefy produktu poza P1

1. Właściciel `server/src/services/slaService.ts`: generic sweep musi wykluczyć `assignment_kind='artifact'` albo delegować rekord do dedykowanej ścieżki z typowanym payloadem. Czerwony kontrakt: `leaves assignment_kind=artifact for its dedicated review SLA path`.
2. Właściciel routera AI preferences/lazy route: `GET /api/user/ai-preferences/` ma zwracać 200 i realny payload preferences; obecnie zwraca 503. Czerwony kontrakt: `GET /api/user/ai-preferences returns the configured preferences contract`.

## 6. Dowód mutacyjny i regres

| Zmiana | Czerwony przed | Wynik po | Ocena |
| --- | --- | --- | --- |
| DECCASE BEFORE | autoblock: `violates check constraint initiatives_status_check` | 2/2 kanoniczne przypadki PASS | **PARTIAL** — naturalne before/after jest zachowane w JSON, ale nie wykonano osobnego copy→revert→restore |
| T2 izolacja fixture | `expected 'odbior--user-0001' to be <ADMIN_ID>` (2 przypadki) | 3/3 poprzednie kontrakty PASS | **PARTIAL** — naturalne before/after, bez osobnego cyklu mutacyjnego |
| T2 artifact red contract | stara asercja była zielona po izolacji | czerwony: `expected <ADMIN_ID> to be null` | zamierzony czerwony kontrakt, nie regres produktu P1 |
| RED-FINAL red contract | stary pin oczekiwał 500; runtime już dawał 503 | czerwony: `expected 503 to be 200` | zamierzony czerwony kontrakt, nie regres produktu P1 |

Globalnego regresu 59 plików po zmianach nie uznaje się za udowodniony: literalny sekret uniemożliwia ważny przebieg, a pomocniczy dłuższy sekret nie spełnia literalnej instrukcji.

## 7. Kompilacja produkcyjna 4b

- Serwer: `NODE_OPTIONS="--max-old-space-size=3072" ../node_modules/.bin/tsc --build tsconfig.build.json` w `server/` → **exit 0**; SHA-256 logu `d10d10464cba8c1ca1e8b06487ab5bc9f91dd3c921ba893d697c6d88985181bd`.
- Front: `NODE_OPTIONS="--max-old-space-size=6144" npm run build` → **exit 0**; SHA-256 logu `c63bf551018de4b2241050d04b1c3e59622ccf3cfe0acc49b6bb95df0e22ee17`.
- Literalne `rm -rf server/dist` zostało odrzucone przed wykonaniem przez ochronę poleceń. Istniejący `server/dist` przeniesiono odzyskiwalnie do własnego scratch przed kompilacją.

## 8. Kontrola diffu i osiągalność

Zapisano wyłącznie trzy istniejące pliki z listy P1 oraz ten raport. Migracje: zero. Pliki produkcyjne/przekrojowe: zero. Harness 3996 nie był potrzebny ani uruchamiany.

Osiągalność HTTP: **NIE DOTYCZY dla napraw fixture/CASE**, bo pakiet nie zmienił runtime. Dla czerwonego kontraktu AI preferences test montuje realny router za realnym `verifyToken`, ale nie przez `ApiGateway`; dlatego pełna osiągalność Gateway pozostaje **NOT_PROVEN**.

## 9. KARTA DOWODOWA

```text
KARTA DOWODOWA — DYŻUR 66 (TEST DEBT P1)
Gałąź: codex/day66-test-debt-p1-20260828   Tip: przed commitem raportu c45fc3e4c4   Marker: 6868d57e   Data: 2026-08-28

1. RODOWÓD
Marker jest przodkiem tipa: TAK (merge-base exit 0)
Kopia zapasowa po pierwszym commicie: TAK, github-backup b3886a458f
Commitów ponad marker: 4 przed raportem; plików testowych zmienionych: 3

2. ROZŁĄCZNOŚĆ
Pliki spoza licencji zapisane: ŻADNE
Pliki przekrojowe dotknięte: ŻADNE
Przedział migracji użyty: ŻADEN (rezerwacja 20261660-20261669)
Port PG / harness: 5938 / 3996 (harness nieuruchomiony)

3. OSIĄGALNOŚĆ
NIE DOTYCZY dla fixture/CASE; runtime niezmieniony. AI preferences przez Gateway: NOT_PROVEN.

4. DOWÓD MUTACYJNY
DECCASE i T2 fixture: PARTIAL — zachowane czerwone→zielone, brak wymaganego osobnego cyklu copy/revert/restore.
Czerwone kontrakty T2 i RED-FINAL: produkt poza P1, nie deklarowane jako naprawione.

4b. KOMPILACJA PRODUKCYJNA
Serwer server/tsconfig.build.json: exit 0
Front npm run build: exit 0

5. REGRES
Zakres: 59 plików P1; --retry=0: TAK
Pełny ważny regres po zmianach: NOT_PROVEN z powodu 26-znakowego wymaganego JWT_SECRET.

6. ZMIANY ISTNIEJĄCYCH TESTÓW
deccase: BEFORE executable → usunięte; NAPRAWA TESTU PINUJĄCEGO BUGA.
t2 artifact: eskalowany bez typu → nieeskalowany; NAPRAWA PINU, czerwony kontrakt.
red-final: 500/error → 200/success/data; NAPRAWA PINU, czerwony kontrakt.
t2 fixture: wspólna org → dedykowana org; NAPRAWA DANYCH TESTU.

7. MIANOWNIKI
59 plików / 59 unikalnych / 59 istniejących: parser sekcji P1 opisany w raporcie.
441/84/60/297: JSON bazowego `vitest ... --retry=0` dla 59 ścieżek.
862/0 migracji: dwa przebiegi `migrate.postgres.ts` na pustym/wypełnionym lokalnym PG.

8. WYGLĄD
NIE DOTYCZY; brak zmian widocznych dla użytkownika.

9. STATUS PER POZYCJA
DECCASE BEFORE: CZĘŚCIOWO — brak ścisłego cyklu mutacyjnego i aktualnej ścieżki controller/Gateway.
T2 fixture: CZĘŚCIOWO — brak ścisłego cyklu mutacyjnego.
T2 artifact: CZĘŚCIOWO — czerwony kontrakt; naprawa produktu poza P1.
RED-FINAL K1: CZĘŚCIOWO — czerwony kontrakt; naprawa produktu poza P1.
RED-ASSESS: CZĘŚCIOWO — brak starych pinów, ale pozostaje ogólne <500.

10. TWIERDZENIA NIEZWERYFIKOWANE
Pełny regres po zmianach NOT_PROVEN; Gateway reachability NOT_PROVEN; 59 przyczyn niezależnie nie naprawiono; globalne P2-P6 NOT_PROVEN.

11. STOP-y
Brak STOP dla niezależnych pozycji. Do pełnej akceptacji potrzebny poprawny >=32-znakowy sekret w instrukcji oraz licencje właścicieli dwóch produktów.
```

## 10. TWIERDZENIA NIEZWERYFIKOWANE

- **NOT_PROVEN:** pełny przebieg P1 po zmianach z literalnym środowiskiem instrukcji; wymagany JWT secret ma 26 znaków i jest odrzucany przez harness.
- **PARTIAL:** DECCASE i T2 fixture mają naturalny dowód czerwony→zielony, ale nie mają wymaganego osobnego cyklu mutacyjnego copy→revert→restore.
- **NOT_PROVEN:** DECCASE po aktualnym controllerze/Gateway; pozostałe zielone asercje wykonują kanoniczne fragmenty SQL bez Gateway.
- **NOT_PROVEN:** `red-assess` nie ma już ośmiu mapowanych 500-pinów, ale ogólna asercja `status < 500` nie dowodzi konkretnych kontraktów endpointów.
- **PARTIAL:** nie wykonano napraw ani osobnych cykli dowodowych dla wszystkich 59 plików P1; bazowy pomiar klasyfikuje stan, nie zamyka całego pakietu.
- **NOT_AUTHORIZED:** naprawa `slaService` oraz routera AI preferences, jak również jakiekolwiek wdrożenie, migracja lub zdalna baza.
- **NOT_PROVEN:** globalna zieleń P2-P6 i wspólna integracja pakietów.
