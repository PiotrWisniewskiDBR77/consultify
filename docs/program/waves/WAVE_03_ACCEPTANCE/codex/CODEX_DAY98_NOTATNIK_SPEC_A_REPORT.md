# CODEX DAY 98 — Notatnik / SPEC-A

Data: 2026-08-29  
Gałąź: `codex/day98-notatnik-spec-a-20260829`  
Baza wykonawcza: `8c7a853a6cb82c9b498210049c5487ea033caa9b`

## Wynik

`PARTIAL / READY_FOR_OWNER_SCREENSHOT_REVIEW`. Notatnik realnie renderuje wspólny
`ArtifactRightPanel` wyłącznie po jawnym włączeniu `ENABLE_NOTEBOOK_SPEC_A_SHELL`.
Wartość domyślna pozostaje `false`; OFF zachowuje zastany panel. Nie zmieniono
silnika edytora, zapisu ani treści notatki.

## Wejście i korekty wobec instrukcji

Wynik markera i sanity, dosłownie:

```text
INSTRUCTION MARKER OK
8c7a853a6cb82c9b498210049c5487ea033caa9b
```

Wiadomość zlecająca podała marker `188cb75f5b8f3b87eb8346160e5ee1aa56942988`,
a wydana instrukcja w `§0.1` nakazała `8c7a853a6cb82c9b498210049c5487ea033caa9b`.
Oba są przodkami tipa; zastosowałem bezpieczniejszy i nowszy marker literalnie
wskazany w procedurze wykonawczej. Tip uciekł do `3afc15dc51`; integrację wykonuje nadzorca.

Teza §A o „wyłącznie komentarzu” była częściowo nieaktualna: zastany
`NotebookRightRail.tsx` miał własny pięciosekcyjny accordion i testy, lecz nie
importował ani nie renderował wspólnego `ArtifactRightPanel`. Wynik pomiaru:
5 plików w `src/` realnie renderowało `<ArtifactRightPanel`; 39 plików zawierało
import/wzmiankę. Notatnik należał tylko do drugiej grupy.

Seeder znajduje się w `scripts/dev/seed-wave3-my-work-owner-review-owned.mjs`.
Seeder sam tworzy użytkowników (lower-case SQL, dlatego literalny grep z W2 nie
zwrócił trafienia). Pierwsza omyłkowa próba przez `node` ujawniła brak modułu JS;
uruchomienie przez `npx tsx` było właściwe. Ścieżka `reset/provision` ujawniła
zastany błąd `n is not defined`, ale `seed` i `readback` zakończyły się pełnym
manifestem FINAL.

## B.1 — stan zastany, DoD §18.1

Stan przed zmianą: **8 z 16**.

| # | Wynik | Dowód przed zmianą |
|---|---|---|
| 1 | NIE | Menu 1 nie było kompletną, współdzieloną powłoką; akcje były rozproszone. |
| 2 | NIE | Panel był lokalną implementacją, nie wspólnym komponentem. |
| 3 | TAK | Lokalny accordion deklarował Akcje · Właściwości · Powiązania · Komentarze · Historia/AI. |
| 4 | TAK | `NotebookContextPanel` udostępniał relacje jako osobną sekcję. |
| 5 | TAK | Stały przycisk AI i sekcja Historia/AI były widoczne. |
| 6 | NIE | Nie wykonano pełnego testu guardu niezapisanych zmian dla wszystkich warstw. |
| 7 | TAK | Empty/loading/error nie były zastępowane fałszywymi danymi. |
| 8 | TAK | Zrzuty light/dark używały tokenów `c-*` w zmienianym panelu. |
| 9 | TAK | W panelu nie użyto crimson dla fokusa/statusu/selection. |
| 10 | NIE | Nie było dowodu pełnego cyklu Tab/Shift+Tab. |
| 11 | NIE | Nie było dowodu pełnej hierarchii Escape. |
| 12 | NIE | Część istniejących kontrolek nie miała jawnego `focus-visible` ring. |
| 13 | TAK | Teresa nie była uruchamiana; brak regresji istniejącego slotu. |
| 14 | TAK (N/D) | Notatnik nie jest generatorem/wizardem. |
| 15 | NIE (N/D) | Notatnik nie jest Canvasem A. |
| 16 | NIE (N/D) | Notatnik nie jest Canvasem A. |

Po zmianie i oględzinach: **10 z 16** — doszły pkt 1 i 2 w zakresie panelu/Menu 1;
pozostałe braki nie zostały fałszywie podniesione.

## B.2 — rdzeń

- `notebookSpecAShellFlag.ts`: `export const ENABLE_NOTEBOOK_SPEC_A_SHELL = false;`.
- Rozstrzyganie fail-closed: query → localStorage → env → `false`.
- OFF: zwracany jest niezmieniony `legacyRail`.
- ON: `<ArtifactRightPanel sections={specASections}>` jest realnie renderowany.
- Kolejność: `actions`, `properties`, `relations`, `comments`, `history`.
- Domyślnie otwarte tylko Akcje i Właściwości; pozostałe sekcje zwinięte.
- Trasy Gateway odczytane bez zmian: `app.use('/api/my-work', myWorkRoutes)` i
  `app.use('/api/notebook', deprecationHeader('/api/v8/notebook'), notebookV4Routes)`.

## B.3 — zrzuty 8 z 8

Katalog: `/private/tmp/cx-day98-notatnik-artefakty`.

```text
59a89f1c913d274484c55c4787ca5b9fc26e462e19bc5eccb8709a5e7ae515d5  01-off-light-empty.png
9f28786b14a646efa42224b4678533ceed0c45a13677279f7cce55ac62e3a7a3  02-off-dark-empty.png
f45b79ebc8ad4fe4e64b28aeae1526b2c453dd5dc6f64374951529b8e8214216  03-off-light-data.png
01b549a307bd0fe269bad5e3d5959dcd12d244e17a7ac1d123c546db133bf1e4  04-off-dark-data.png
49ef2ef0c86600504339d54cf949dbbbbc008a9117df22596cfd5a3721177ccc  05-on-light-empty-relations.png
c2e79ce8ad20246a14a4f41c14efd5d1c733ab60bdbe0f04530195ce02f2d30a  06-on-dark-empty-relations.png
8c8c8f2f04ccb2ca5b8b5fd8fc85c3d39f7eb7d1f9377eb99de90d751bb88b3c  07-on-light-data.png
55da56824b155c2c183c4e00d41497caab7cffeed5063ed66edf57b831379ece  08-on-dark-data.png
```

Wszystkie obejrzane. OFF pokazuje zastany panel/listę. ON pokazuje wspólny panel,
Akcje/Właściwości rozwinięte, Powiązania i puste Komentarze uczciwie zwinięte.
Zrzut `08` został powtórzony po wykryciu otwartego menu profilu; hash powyżej
dotyczy wersji czystej.

## B.4 — testy i dowód mutacyjny

Pakiet fokusowy, `--retry=0`: **21 z 21 PASS**. Pełne nazwy są w
`day98-focused-green-2.json`; obejmują m.in.:

- `... keeps the accepted bespoke rail when ENABLE_NOTEBOOK_SPEC_A_SHELL is not enabled`
- `... renders the shared ArtifactRightPanel only for an explicit review override`
- `... renders the five canonical sections in the fixed order`
- `... wires Akcje (Export/Share/Version history) to the same handlers as the kebab registry`
- `ENABLE_NOTEBOOK_SPEC_A_SHELL is fail-closed by default`

Pełny katalog `src/components/MyWork/notebook/__tests__`, `--retry=0`:
**31 z 31 plików, 82 z 82 nazw PASS**, JSON: `day98-notebook-regression.json`.

Mutacja: usunięto `properties` z warunku `defaultOpen`.

```text
RED: success=false
NotebookRightRail — SPEC-A accordion renders the shared ArtifactRightPanel only for an explicit review override
RESTORE: MUTATION RESTORE DIFF EMPTY
GREEN: success=true; 12 z 12 nazw NotebookRightRail.behavior PASS
```

Pułapki (a)–(e): pakiety są czysto komponentowe (`RUN_DB_TESTS=0 MOCK_DB=true`),
nie przechodzą przez V8/auth/DB ani seeder; dowodem jest brak importów Gateway,
middleware i DB w trzech zmienionych pakietach. Nie są dowodem egzekucji backendu.

Root `tsc --noEmit` nie dał wyniku: proces Node zakończył się błędem pamięci.
`git diff --check` = PASS.

## Baza, runtime i Z30

- PostgreSQL: `pgvector/pgvector:pg16`, `127.0.0.1:5982`, baza
  `consultify_w3_my_work_owner_day98`.
- Pierwsza migracja zakończona sukcesem; drugi przebieg: `Applying migrations: 0`.
- Kanoniczny runtime: serwer `4860`, klient `4861`, health/ready/frontend `200`.
- Runtime potwierdził 863 migracje, SQL marker i fingerprint dirty candidate.
- `env` → `BRAK ZMIENNYCH POCZTY`; tabela `settings` → `0 rows` dla `smtp%`;
  Gateway → 0 trafień drenaży.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano tablet/mobile ani PL; zrzuty są desktop EN, bo fixture uruchomił EN.
- Nie wykonano pełnego ręcznego cyklu Tab/Shift+Tab i hierarchii Escape.
- Nie wykonano pełnego root `tsc`, ponieważ proces wyczerpał pamięć.
- Nie twierdzę, że moduł My Work jest zaakceptowany przez właściciela; flaga pozostaje OFF.
- Nie mierzono produkcji, demo, stagingu ani Railway — były poza zakresem i zakazane.

## Kryteria K1–K8

K1 PASS · K2 PASS · K3 PASS · K4 PASS · K5 PASS (8/8) · K6 PASS · K7 PASS ·
K8 PASS. Werdykt nie zmienia flagi na ON i nie nadaje akceptacji właściciela.
