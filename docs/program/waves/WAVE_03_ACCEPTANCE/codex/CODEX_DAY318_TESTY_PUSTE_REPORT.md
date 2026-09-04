# CODEX — dyżur 318 — testy puste

Data pomiaru: 2026-09-04  
Marker: `bc18bc7acac2ec825ebb3db2f1309738ab034d58`  
Gałąź: `codex/day318-testy-puste-20260904`  
Worktree: `/private/tmp/cx-day318-testy-puste`

## Wynik

- R0: wykonane; własny mianownik wejściowy `5404 pliki / 42477 bloków / 21 kandydatów / 0 pominiętych`.
- R1: wykonane; skaner zachowuje stare pola i dodaje `selfDefinedSubjects` oraz `selfDefinedSubjectsWithoutProductImports`. `MessageBubble.test.tsx:7` jest wykryty.
- R2: wykonano pomiar wszystkich 15 możliwych pozycji (obu billingCron, bo stary rejestr nie wskazuje, którą mierzył odbiorca). Siedem dostało pełny dowód mutacyjny; dwa puste bloki billingCron naprawiono i ponowna mutacja czerwieni oba. Osiem pozycji pozostaje `NOT_PROVEN` z przyczyną per pozycja.
- R3: usunięto `tests/unit/services/api-extensions.test.ts`; w `src/` i `server/` nie istnieje odpowiadający moduł.
- R4: skaner po zmianach: `5403 / 42474 / 17 / 0`; `BASELINE.files=5403`, `BASELINE.candidates=17`, `BASELINE.skipped=0`; bezpiecznik PASS.

## Marker i stan wejściowy — wynik dosłowny

```text
bc18bc7aca docs(rejestr): M6/M7 zamkniete, M8-M12 — '11 z 15' bylo liczba z obrazka, pulapka fikstury zamknieta, blad nadzorcy
MARKER OK
[core]
        bare = false
bc18bc7acac2ec825ebb3db2f1309738ab034d58
```

`git status --short | head -3` nie wypisał żadnej linii. Tip `github-backup/grafika/m03-20260902` uciekł o sześć commitów; pracę wykonano dokładnie z markera zgodnie z DEC-95. Różnica dotyczy instrukcji dyżurów 314–323 i `_instr_src/*`; nie scalano tipa ani nie wykonywano rebase.

## Baza i Z30

- Przed startem: 64 GiB wolne, porty 6334/5474 puste, zero kontenerów `cx-day318`.
- Kontener: `cx-day318-pg`, obraz `pgvector/pgvector:pg16`, baza `cx318`, bind `127.0.0.1:6334`.
- Migracje: pierwszy przebieg `Postgres migrations complete`; drugi przebieg `Applying migrations: 0` i `Postgres migrations complete`.
- `env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)"`: `BRAK ZMIENNYCH POCZTY`.
- `SELECT ... FROM settings WHERE key LIKE 'smtp%'`: `(0 rows)`.
- grep drenaży w `server/src/Gateway.ts`: 0 trafień.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R1 — detekcja lokalnego podmiotu

`node scripts/dev/testy-puste-skan.mjs --self-test` zwraca `SELF_TEST_OK MessageBubble`. Pełny pomiar wykrywa 190 plików spełniających literalny kontrakt R1 (lokalna deklaracja PascalCase użyta jako JSX/wywołanie, bez importu tego samego identyfikatora z produktu). Z nich 64 nie mają żadnego statycznego importu z `src/` ani `server/src/`.

To osobna lista przeglądowa. Żadnemu z tych plików skaner automatycznie nie nadaje klasy `PUSTY`.

## R2 — tabela rozstrzygnięć

| ID | Wynik | Dowód / blokada | Commit |
|---|---|---|---|
| E0001 | `NOT_PROVEN` | baseline FAIL: `querySelector` na `null`, linia testu 134 | `e1c86e985e` (rejestr) |
| E0002 | NIE PUSTY | PASS → filtr zawsze pusty → FAIL | `a3e7fdb4f3` |
| E0003 | `NOT_PROVEN` | baseline FAIL: `argument handler must be a function` | `e1c86e985e` (rejestr) |
| E0004 | NIE PUSTY | PASS → `en/pl=''` → FAIL | `a3e7fdb4f3` |
| E0006 | NIE PUSTY | PASS → `checkACL={}` → FAIL | `a3e7fdb4f3` |
| E0008 | `NOT_PROVEN` | suite nie ładuje produktu: zerwany import `../../../src/...` | `ef3bfccebc` (rejestr) |
| E0009 | `NOT_PROVEN` | bezpośredni Ollama, SKIP przy `OLLAMA_TEST=false`; Z15 zabrania LLM | `ef3bfccebc` (rejestr) |
| E0010 | `NOT_PROVEN` | jak E0009; brak funkcji produktu do mutacji | `ef3bfccebc` (rejestr) |
| E0011 | `NOT_PROVEN` | jak E0009; brak funkcji produktu do mutacji | `ef3bfccebc` (rejestr) |
| E0012 | NIE PUSTY | PASS → SQL `promoted_to` zmieniony na `mutated_to` → FAIL | `e1c86e985e` |
| E0013 | `NOT_PROVEN` | test importuje `server/src/index.ts`, czego Z30 zabrania w testach | `016c94cd12` (rejestr) |
| E0014 | `NOT_PROVEN` | bezpośredni fetch do niezamontowanego runtime; brak funkcji produktu | `016c94cd12` (rejestr) |
| E0015 | NIE PUSTY | PASS → `buildContext={}` → FAIL | `e1c86e985e` |
| E0016 | PUSTY na markerze; naprawiony | PASS → cała funkcja `return` → PASS; po wzmocnieniu PASS → ta sama mutacja → FAIL | `8086e50aec` |
| E0017 | PUSTY na markerze; naprawiony | PASS → cała funkcja `return` → PASS; po wzmocnieniu PASS → ta sama mutacja → FAIL | `8086e50aec` |

Każda mutacja produktu została cofnięta przez `cp`; `git diff --exit-code -- <produkt>` był pusty po każdym dowodzie. Szczegółowe komendy i wyniki są w JSON-ach artefaktów oraz w ręcznym `REJESTR_TESTY_PUSTE_DOWODY_20260904.md`.

## Pułapki środowiska per pakiet

- E0002/E0015/E0016/E0017 i test bezpiecznika są jednostkowe, z `RUN_DB_TESTS=0 MOCK_DB=true`; nie dowodzą DB ani HTTP.
- E0004/E0006 uruchomiono z właściwym `server/vitest.config.ts` z cwd `server/`; montują repliki/jednostkę, nie realny `ApiGateway` i nie są dowodem produkcyjnej trasy.
- E0012 montuje własne `express()` i mocki; wynik dowodzi wyłącznie zależności asercji od konkretnego SQL produktu, nie realnej ścieżki HTTP/PG.
- E0001/E0003/E0008 są czerwone przed mutacją; nie przypisano im klasy.
- E0009–E0011 są wyłączone przez `OLLAMA_TEST=false`; nie uznano SKIP za PASS.
- E0013 nie był uruchamiany, ponieważ pełny `server/src/index.ts` jest zabroniony w testach.
- E0014 nie był uruchamiany, aby nie łączyć się z nieprzydzielonym lokalnym runtime; brak harnessu 5474 został zachowany jako brak dowodu.

## Pomiar nazw §0.4a

- `przed-nazwy.txt`: 134 unikalne pełne nazwy.
- `po-nazwy.txt`: 131 unikalnych pełnych nazw.
- Zniknęły wyłącznie trzy jawnie usunięte przypadki `API Extensions`: retry, timeout i cancellation.
- Nie dodano nowego przypadku Vitest, ponieważ tabela B.1 nie licencjonuje nowego pliku testowego; test funkcji skanera działa jako `--self-test` w samym licencjonowanym skrypcie.

## Artefakty i SHA-256

Katalog: `/private/tmp/cx-day318-testy-puste-artefakty`

```text
b5669c40755965ddc075353200a7f507932f10ccc7d9ac0fce2edd06eec9ca4b  przed.json
3253ddf88c3827ea665a2f075d7bd1eb703ea45fd317714f72594167d317fd03  r1.json
50e5aacb28041daea413c291254445ac16fbebcbe19e8f02277cfa5d50cfd79a  po-r3.json
5637f4ab2d29d8f8985b5c803f14b357fbf717261f2a2c0652f1195043779917  przed-nazwy.txt
869123239716cd6fd678095b112c165f14cd2ba0b3dab81b9b914f4cd1a15c20  po-nazwy.txt
68496d6975e5f5a56558fe39c54972fc9d00d505ea5d31327355f34747bd18b5  nazwy.diff
8bb87e1083936db396d06d2957735cc961147220b4aefe8a3f613d08ffd65b77  migracje-1.log
9fb6e92bec8ff8f311ce11947e803e02eb73f5e7ab857c34bbf910ff0a97ea90  migracje-2.log
```

## Korekty wobec instrukcji

1. B.3 podaje 13 plików z podmiotem lokalnym, a R1 każe wykryć deklarację PascalCase użytą jako JSX/wywołanie bez importu tego samego identyfikatora. Własny pomiar tego literalnego kontraktu daje 190; dodatkowo 64 bez żadnego statycznego importu produktu. Nie dopasowywano wyniku do oczekiwanej liczby.
2. B.3 mówi o 14 pozostałych mutacjach, ale ręczny rejestr nie wskazuje, który z dwóch bloków billingCron był wcześniej mierzony. Zgodnie z R2 zmierzono oba, dlatego raport zawiera 15 pozycji.
3. B.1 oznacza wszystkie niewymienione pliki jako tylko do odczytu, natomiast R1 żąda nowego testu skryptu. Bezpieczniejsza interpretacja: `--self-test` w pełni licencjonowanym `scripts/dev/testy-puste-skan.mjs`; nie utworzono nielicencjonowanego pliku.
4. B.1 i B.2 odwołują się do „struktury §R.2”, ale dokument nie zawiera paragrafu §R.2 (po §0.5 następują B.1–B.4 i R0–R5). Raport zawiera wszystkie pola jawnie wyliczone w R5.
5. Oczekiwany spadek po R3 wynosił co najmniej 2. Faktyczny spadek to 4, bo poza E0019/E0020 zniknęły z listy dwa wzmocnione bloki billingCron.

## TWIERDZENIA NIEZWERYFIKOWANE

- Liczba `267 plików / 1766 bloków bez żadnego wiązania z produktem`: nowa detekcja mierzy lokalne podmioty i statyczne importy, ale nie definiuje kompletnego „wiązania” obejmującego mocki, dynamiczne importy, `require`, routery i helpery; liczby 267/1766 pozostają nieudowodnione.
- Osiem pozycji `NOT_PROVEN` w tabeli R2 nie ma dowodu mutacyjnego w obie strony; nie są ani `PUSTY`, ani `NIE PUSTY`.
- Testy jednostkowe i repliki Express nie dowodzą produkcyjnej ścieżki ApiGateway/JWT/Postgres.
- Nie mierzono CI, Railway, demo, stagingu ani produkcji.
- Nie dowodzono działania całego korpusu testów; uruchomiono wyłącznie pakiety i przypadki wymagane do tego dyżuru.

