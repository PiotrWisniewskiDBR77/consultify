# CODEX DAY 73 — Execution owner evidence report

Data wykonania: 2026-08-29  
Marker: `b57253c0397994d2acd7eb79dd56e874fe40c55a`  
Gałąź: `codex/day73-execution-owner-20260829`  
Zakres: `06_EXECUTION`, pakiet dowodowy G07–G10  
Werdykt: `PARTIAL / FIXTURE_PASS / 16_OF_20_SCREENSHOTS`

## Podsumowanie

Pierwsza próba zakończyła się zasadnym STOP-em: pierwotna instrukcja błędnie
przypisała migracje komendzie `seed`. Po wydaniu poprawki wznowiono dyżur
sekwencją `POSTGRES_DB=postgres` → `provision` → `seed` → `readback`.
Fixture i kanoniczny runtime przeszły pełną kwalifikację. Wykonano i obejrzano
**16 z 20** wymaganych zrzutów. Cztery puste stany — Sterowanie i Raporty w obu
motywach — są nieosiągalne, ponieważ lokalny DEV fallback podstawia dane przy
pustej odpowiedzi API. Nie zmieniono kodu produktu.

## §0.1 — baza, marker i sanity

Wolne miejsce przed startem:

```text
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi   7.4Gi    62%    459k   77M    1%   /
```

Wynik komend (2), dosłownie:

```text
b8fa285c83 docs: dyzury 72 (Wyniki) i 73 (Wykonanie) + DEC-277..279 dysk, przypiete migracje, wydanie
b57253c039 docs(ledger): DEC-271..276 AKCEPT wlasciciela UI Partnera + odbior 69/70/71 + licencja na stala migracji
b48dc4ddc4 merge: dyzur 70 proba 3 — trzeci STOP, stala 834 w seederze
8c33ea26ea merge: dyzur 71 — bramka C.1 zatrzymala ryzykowna zmiane, K4 FAIL
3b86048090 merge: dyzur 69 proba 2 — K4 zwolnione, ekran Prowizji po polsku, akcept wlasciciela
ee981c4212 fix(i18n): domknij polski interfejs partnera
33323504fb test(day71): measure schema isolation gate
da8192d837 docs(finance): record day70 third fixture stop
a4e3312908 docs(ledger): DEC-269/270 drugi STOP dyzuru 70 + poprawka nr 2
3b1f4af016 docs(instrukcje): POPRAWKA 2 dyzuru 70 — nazwa bazy consultify_w3_finance_owner_*, narzedzie zrzutow, porty chronione
6ecf9a3e21 merge: dyzur 70 proba 2 — drugi zasadny STOP (nazwa bazy narzucona przez harness)
11240d9c25 docs: DEC-266..268 odbior dyzuru 69, dwa znaleziska, licencja na testy pinujace
149b893184 docs(finance): record day70 corrected-seed stop
4ba28438d2 merge: dyzur 69 fala jezykowa — PARTIAL uczciwy, klasa B/D Partnera
b92528e223 docs(day69): zapisz czesciowy raport i dowody
edc11e3340 fix(i18n): rozpocznij fale jezykowa Partnera
85619fcb9e docs: DEC-264/265 odbior STOP-u dyzuru 70 + poprawka instrukcji u zrodla
1008976649 merge: dyzur 70 Finanse — zasadny STOP, raport i MODULE_ACCEPTANCE
7ebd967e10 docs(ledger): DEC-262 WYCOFANIE falszywego zarzutu wobec wykonawcy + DEC-263 kolejnosc macierzy
e85371d110 docs(instrukcje): dyzur 71 izolacja schematu testowego (48 plikow, bramka dowodowa)
590cc5e9a3 docs(finance): record day70 cleanup
ec129e83e3 docs(finance): finalize day70 evidence card
6ef8c3f08c docs(finance): record day70 owner fixture stop
5aca498cfd docs(ledger): DEC-259..261 odbior dlugu integracyjnego + przyczyna zrodlowa w infrastrukturze testowej
688b407e22 merge: raport dlugu integracyjnego (klasyfikacja 742/742, uczciwy NOT_PROVEN)
MARKER OK
```

Wynik komend (7), dosłownie:

```text
b57253c0397994d2acd7eb79dd56e874fe40c55a
```

Tip uciekł do przodu o jeden commit. Wymagany pomiar:

```text
b8fa285c83 docs: dyzury 72 (Wyniki) i 73 (Wykonanie) + DEC-277..279 dysk, przypiete migracje, wydanie
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_72_WYNIKI_ODBIOR.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_73_WYKONANIE_ODBIOR.md
```

## §A — weryfikacja stanu wejściowego

W1:

```text
5: * `consultify_w3_execution_owner_*`. Seed requires a new wx/0600 manifest.
21:const PREFIX = 'consultify_w3_execution_owner_',
62:  if (!db.startsWith(PREFIX) || !/^consultify_w3_execution_owner_[a-z0-9_]+$/.test(db))
```

W2: brak wyjścia — seeder nie ma przypiętej liczby migracji.

W3:

```text
73:| G07  | Piotr review card | `READY_FOR_GUIDED_REPLAY` | Shared operator card: `../../GUIDED_OWNER_REPLAY.md`, row 7. Owner decisions remain pending. |
74:| G08  | First-impression review | `NOT_STARTED` | — |
75:| G09  | Guided CX journey review | `NOT_STARTED` | — |
76:| G10  | Alternate-state owner review | `NOT_STARTED` | — |
```

## Z30 — dowód braku wysyłki

Przed operacją zapisującą:

```text
BRAK ZMIENNYCH POCZTY
```

`grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts`
nie zwrócił trafień. Po pierwszej nieudanej próbie odczyt konfiguracji bazy zwrócił:

```text
ERROR:  relation "settings" does not exist
LINE 1: SELECT key, left(coalesce(value,''),8) FROM settings WHERE k...
```

Po poprawnym `provision` ponowny odczyt tabeli `settings` zwrócił `0 rows`.
Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. W pierwszej próbie nie uruchomiłem
`server/src/index.ts`. Podczas wznowienia §B.2 nakazał kanoniczny runtime, który
uruchamia `server/src/index.ts`; jego izolacja dotenv potwierdziła brak
zabronionych kluczy i wartości. Żaden e-mail ani zaproszenie kalendarzowe nie
zostało wysłane.

## B.1 — fixture i readback

Porty `5945` i `4670` były wolne. Uruchomiono wyłącznie kontener
`cx-day73-pg` z obrazem `pgvector/pgvector:pg16`, bazą
`consultify_w3_execution_owner_day73` i mapowaniem
`127.0.0.1:5945:5432`. `pg_isready` zwrócił:

```text
/var/run/postgresql:5432 - accepting connections
```

Nie uruchomiono migracji ręcznie. Seeder został wywołany z kompletem zmiennych
w tej samej linii: `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`,
`NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`,
`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, lokalnym `DATABASE_URL`
na porcie `5945` oraz lokalnym `JWT_SECRET`.

Wynik seed, dosłownie:

```text
relation "execution_case_links" does not exist
```

Manifest nie powstał. Niezależny readback:

```text
 execution_case_links |       fixture_markers
----------------------+-----------------------------
                      | wave3_owner_fixture_markers
(1 row)
```

W pierwszej próbie zielonego readbacku fixture'u nie było. Ten historyczny
wynik został następnie zamknięty poprawnym wznowieniem opisanym niżej.

### Pułapki Z33 dla tego pomiaru

- (a) `ENABLE_V8_GLOBAL=true` podano w tej samej linii; nie jest przyczyną
  błędu SQL.
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` podano w tej samej
  linii; strażnik Results nie zdążył zostać osiągnięty.
- (c) `MOCK_DB=false DB_TYPE=postgres` oraz loopback `DATABASE_URL` podano w tej
  samej linii. Niezależny odczyt `psql` tej samej bazy potwierdza realny PG.
- (d) `ENABLE_TEST_AUTH_BYPASS=false` podano w tej samej linii; runtime i HTTP
  nie zostały uruchomione.
- (e) dotyczy bezpośrednio: kod markera uruchamia `db:migrate:strict` wyłącznie
  w `provision()` (`scripts/dev/seed-wave3-execution-owner-review.mjs:82-92`).
  `main()` kieruje komendę `seed` bezpośrednio do `seed(c)`
  (`scripts/dev/seed-wave3-execution-owner-review.mjs:511-520`), bez migracji.

### STOP — B.1 fixture

Rodzaj: MERYTORYCZNY  
Powód: nakazana komenda `seed` weszła do niezmigrowanej, utworzonej przez
kontener bazy i zakończyła się brakiem tabeli `execution_case_links`.  
Licencja, którą sprawdziłem: §D pozwala zapisać wyłącznie raport i
`06_EXECUTION/MODULE_ACCEPTANCE.md`; §D jawnie zabrania zapisu seedera i
migracji. Wynik: seeder tylko do odczytu, bez obejścia.  
Dowód: wynik seed i niezależny readback SQL powyżej; kod
`scripts/dev/seed-wave3-execution-owner-review.mjs:82-92,511-520`.  
Co dostarczyłem ZAMIAST zmiany: reprodukcję na przypisanym kontenerze, dowód
braku tabeli oraz dokładny brief przyczyny.  
Co zrobiłbym, gdyby zapadła decyzja X: po korekcie procedury albo seedera
utworzyłbym świeżą bazę, uzyskał FINAL manifest i zielony readback, a dopiero
potem uruchomił kanoniczny runtime i macierz 20 zrzutów.  
Rekomendacja dla nadzorcy: wydać jedną spójną sekwencję. Bezpieczne warianty to
albo kontener z bazą `postgres` i komenda `provision` tworząca bazę docelową,
albo jawna migracja istniejącej bazy przed `seed`; promień obejmuje wyłącznie
procedurę fixture'u Execution.  
Stan: zacommitowano wyłącznie dokumentację w commicie dyżuru 73.  
Czy kontynuowałem pozostałe pozycje: NIE w pierwszej próbie; TAK po wydaniu
poprawki i uzyskaniu zielonego readbacku.

## Wznowienie po poprawce wydania — B.1

Nowa, wiążąca sekwencja została wykonana bez ręcznych migracji:

1. `cx-day73-pg`, `POSTGRES_DB=postgres`, `127.0.0.1:5945:5432`;
2. `provision` utworzył `consultify_w3_execution_owner_day73` i zastosował
   pełny łańcuch **863 migracji**;
3. `seed` utworzył nowy manifest
   `/private/tmp/cx-day73-artefakty/execution-owner-manifest-resume-1.json`;
4. `readback` zakończył się zielono.

Wynik `provision`, dosłownie:

```text
✅ Postgres migrations complete
{"command":"provision","database":"consultify_w3_execution_owner_day73","migrationMode":"exact-current-strict"}
```

Wynik readbacku potwierdził: `fixtureId=W3-EXECUTION-OWNER-v1`,
`ownershipState=FINAL`, `databaseName=consultify_w3_execution_owner_day73`,
`executionStatus=CLOSED`, `executionVersion=3`, evidence `APPROVED`, Results
`DELIVERED`, `attemptCount=1` oraz sześć person. Manifest ma tryb `0600` i sumę:

```text
8391b885caa68bb5450991b843bb55ddf647ceee9c5bdd9c31671be31a9ba644  /private/tmp/cx-day73-artefakty/execution-owner-manifest-resume-1.json
```

Odczyt SMTP po migracjach:

```text
 key | left
-----+------
(0 rows)
```

### Kanoniczny runtime

Runtime na `4670/4671` zakwalifikował dokładny SHA
`fc72f0cff1e0a9e2d845bf4444ec70d65482678b`: health/ready/frontend
`200/200/200`, migration state `ok`, SQL migration state `ok`, 863 migracje,
client marker i SQL marker zweryfikowane. `ENABLE_TEST_AUTH_BYPASS=false`,
`E2E_MODE=false`, sekret nie został zapisany, a credentials serwera nie
trafiły do procesu Vite. Łańcuch migracji:
`b69768dcc8bc3c1b241663deb114f38f223ddaeabf768894c623a8c80c19251b`.

## B.2–B.3 — zrzuty i oględziny

Wykonano i obejrzano **16 z 20** zrzutów. Liczba zaliczonych plików PNG w
`/private/tmp/cx-day73-artefakty`: `16`. Pierwszy, zasłonięty onboardingiem
przebieg 20 PNG został zachowany poza katalogiem artefaktów w
`/private/tmp/cx-day73-scratch/attempt1-obscured/` i nie jest liczony.

Nie relablowano stanów. Realizacje: pełny owner, pusty foreign. Praca i Zasoby:
pusty owner, pełny foreign, ponieważ pusty wynik Cases aktywuje lokalny DEV
fallback. Sterowanie i Raporty: pełny stan dla obu person, więc puste stany są
nieosiągalne. Źródło mechanizmu:
`src/components/Execution/executionLocalReviewData.ts:1-9` oraz użycia fallbacku
w `ExecutionResourcesSurface.tsx:98-104`, `ExecutionControlSurface.tsx:263-269`
i `ExecutionReportsSurface.tsx:210-277`.

### Oględziny każdego zrzutu

| Plik | Wynik oględzin |
| --- | --- |
| `day73-execution-realizacje-light-full.png` | Style i jasny motyw obecne. Nagłówki PL; wartość `Launch customer pilot` EN. `0%` czytelne, brak dat/kwot. Bez ucięć i surowych ID. Akcent crimson `Model` nie oznacza stanu krytycznego. HTTP 500. |
| `day73-execution-realizacje-dark-full.png` | Jak wyżej; ciemny motyw potwierdzony klasą `dark`. Kontrast czytelny, brak nachodzenia. HTTP 500. |
| `day73-execution-realizacje-light-empty.png` | Zamierzony pusty stan po polsku, wyśrodkowany i czytelny; bez surowych kodów. Crimson `Model` poza semantyką krytyczną. HTTP 500. |
| `day73-execution-realizacje-dark-empty.png` | Jak wyżej w ciemnym motywie; tekst i karta mają czytelny kontrast. HTTP 500. |
| `day73-execution-praca-light-full.png` | Nagłówki i statusy PL, daty w formacie PL. Nazwy osób są małymi literami. Dwa tytuły są wizualnie skrócone wielokropkiem. Bez surowych ID; crimson `Model` niekrytyczny. HTTP 500. |
| `day73-execution-praca-dark-full.png` | Jak wyżej w ciemnym motywie; tabela czytelna, te same skrócenia tytułów. HTTP 500. |
| `day73-execution-praca-light-empty.png` | Zamierzony pusty stan PL; liczniki 0 zgodne, bez surowych kodów i nachodzenia. HTTP 500. |
| `day73-execution-praca-dark-empty.png` | Jak wyżej w ciemnym motywie; kontrast czytelny. HTTP 500. |
| `day73-execution-zasoby-light-full.png` | Nagłówki PL, ale prawa część tabeli jest ucięta przy 1440 px; nagłówek i wartości wychodzą poza viewport. Widoczne surowe `UNKNOWN`, a DOM zawiera też `PARTIAL`, `NONE`, `CURRENT`, `CAPACITY_CONFLICT`. Liczby dziesiętne używają kropki (`0.72–0.78`, `0.8–0.9`), nie polskiego przecinka. HTTP 500. |
| `day73-execution-zasoby-dark-full.png` | Jak wyżej w ciemnym motywie; ten sam krytyczny problem szerokości i surowych kodów. HTTP 500. |
| `day73-execution-zasoby-light-empty.png` | Zamierzony pusty stan PL, czytelny; liczniki 0, bez surowych kodów. HTTP 500. |
| `day73-execution-zasoby-dark-empty.png` | Jak wyżej w ciemnym motywie; brak nachodzenia. HTTP 500. |
| `day73-execution-sterowanie-light-full.png` | Nagłówki, wartości i daty PL; brak ucięć, surowych ID i nachodzenia. Crimson `Model` pozostaje niekrytyczny. Pusty wariant nieosiągalny. HTTP 500. |
| `day73-execution-sterowanie-dark-full.png` | Jak wyżej w ciemnym motywie; kontrast czytelny. Pusty wariant nieosiągalny. HTTP 500. |
| `day73-execution-raporty-light-full.png` | Nagłówki/statusy/daty PL, ale nazwy raportów i definicji EN; drugi tytuł ucięty wielokropkiem. Widok pokazuje fallback mimo 500 API. Pusty wariant nieosiągalny. |
| `day73-execution-raporty-dark-full.png` | Jak wyżej w ciemnym motywie; kontrast czytelny, to samo ucięcie tytułu i 500 API. Pusty wariant nieosiągalny. |

Każdy z 16 przebiegów zarejestrował:

```text
500 /api/report-builder/definitions?kind=EXECUTION_PACK
```

Log serwera wskazuje `SELECT * FROM report_definitions` i PostgreSQL `22P02`:
`invalid input syntax for type uuid: "w3-exe-*-org-v1"`. Mimo 500 Raporty
wyświetlają lokalny zestaw przeglądowy; nie jest to dowód sprawnego API.

### SHA-256 zrzutów

```text
5b305da3cfb4b0cbe4c887e3e73cfa2500da593f2da73723a32f0a289fbd39a5  day73-execution-praca-dark-empty.png
fc2a860d337a0b327e099684444e5dcd98db0146cb8c24a47b5aff816c2470ae  day73-execution-praca-dark-full.png
7b39f286773ad17bdaf75446be43946dc58b7d3555a76f6e56a728b483c2d165  day73-execution-praca-light-empty.png
cb8ea9e798194f465c87ef0925c6b6e77fedb0ade6ebab6a50f83e2fabf73268  day73-execution-praca-light-full.png
67c6167abb9143629c01dca619eb93b6ae9508365d94a4c2673736b1e643ca55  day73-execution-raporty-dark-full.png
9ab832b0c704705b0ad1a958682b211c5b67806b0ec82f05daa41c77782289fc  day73-execution-raporty-light-full.png
14de96488f6db088568167c7f091aab70a9eb6ced626c655eaf47fef77b32188  day73-execution-realizacje-dark-empty.png
9f473103590783ea267c1ec8072f4c6932e807ceb7af832812de4407e62da4a2  day73-execution-realizacje-dark-full.png
fbe5e3368f597ac4afdf2d9d7d871626deba126c1fdfcff9e7b35ddff5643cfb  day73-execution-realizacje-light-empty.png
356600f362b3187c178d3e094798fe368ccf15867246231f07385f6f36d7372f  day73-execution-realizacje-light-full.png
80c2f50260db86185658c29bfe144e256899268c7be00bb9e5baa08dfc9956f9  day73-execution-sterowanie-dark-full.png
9ece9b4fc1e1eb1404387960491d4f185c7f7eb115a7a59785e986f82e382374  day73-execution-sterowanie-light-full.png
8bbe7260320359cc885ee3585a65916a0b66ec45e9fee96edd153216369845f4  day73-execution-zasoby-dark-empty.png
e7bbc854a674912d08db4096a2e2ddecb92ab30e6827a9cabe4c082b90dc2384  day73-execution-zasoby-dark-full.png
e52b645db83ecf6a6e22bc2847fda6c678e186038b42fe24c8b6d677e5b53714  day73-execution-zasoby-light-empty.png
99c098e458da7440d760dfa6d7f44eab847319afe43d6cf2770207c9690f2998  day73-execution-zasoby-light-full.png
```

Rejestr obserwacji DOM/konsola/HTTP:
`fbd2cbfa972e527a37173b1343cfca674a31736433c57e01530a723adba6a6b0`
(`/private/tmp/cx-day73-artefakty/day73-execution-matrix-observations.json`).
Manifest runtime:
`3aad1db25d3d105f1f143ffc54e7871e019069db33e14e6584a5aa3f6fb28927`
(`/tmp/consultify-wave3-runtime-manifest-day73.json`).

### Sprzątanie

Kanoniczny `stop` potwierdził zakończenie wyłącznie własnych grup procesów,
wolne porty 4670/4671 i zachowanie bazy do kontrolowanego dropu. Następnie
manifest-bound `drop` zwrócił:

```text
{"command":"drop","database":"consultify_w3_execution_owner_day73","catalogMatches":0}
```

Kontener `cx-day73-pg` usunięto z wolumenem. Manifest fixture'u i wszystkie
zaliczone artefakty zachowano.

## Korekty wobec instrukcji

1. §A mówi: „TEN SEEDER SAM URUCHAMIA MIGRACJE” oraz przypisuje wywołanie z
   linii około 90 seederowi jako całości. §B.1 jednocześnie nakazuje: kontener
   tworzy bazę → bez ręcznych migracji → `seed`. Kod markera pokazuje, że
   wywołanie migracji leży wyłącznie w `provision()`, a `seed` go nie wywołuje.
   Wybrałem bezpieczniejszą interpretację: nie zmieniłem kodu, nie uruchomiłem
   ręcznej migracji i zatrzymałem pozycję po mierzalnym błędzie.
2. Instrukcja odwołuje się do nieobecnych §0.3, §0.4a, tabeli licencji, §R.1 i
   sekcji „TEZY ZLECENIA”. Zastosowałem jawny zakres zapisu z §D, samodzielny
   pomiar `git diff --name-only` i format STOP z §0.5.
3. §0.2b zabrania uruchomienia `server/src/index.ts`, a §B.2 nakazuje użyć
   kanonicznego `start-wave3-owner-runtime.mjs`, który uruchamia właśnie
   `server/src/index.ts` (`scripts/dev/start-wave3-owner-runtime.mjs:681`). Po
   wznowieniu zastosowałem późniejszy, konkretny nakaz §B.2. Przed startem i po
   migracjach potwierdziłem brak env SMTP i brak rekordów SMTP; runtime
   potwierdził izolację dotenv i brak zabronionych sekretów.
4. Twardy mianownik 20 zakłada osiągalność pustego i pełnego stanu wszystkich
   pięciu ekranów. Pomiar pokazał, że lokalny DEV fallback uniemożliwia pusty
   stan Sterowania i Raportów. Zgodnie z zakazem relabelowania wynik pozostaje
   16 z 20.

## Kryteria końcowe

- K1: `PASS` — FINAL fixture, zielony `seed` i niezależny `readback`.
- K2: `PASS_FOR_16_OF_20` — raport: 16 z 20; zaliczone pliki PNG na dysku: 16;
  każdy ma SHA-256. Cztery pozycje jawnie brakują.
- K3: `PARTIAL_16_OF_20_INSPECTED` — każdy z 16 zrzutów obejrzany ze stylami;
  cztery puste warianty są nieosiągalne.
- K4: wynik końcowego `git diff --name-only` znajduje się poniżej; oczekiwane
  są wyłącznie dwa dokumenty.
- K5: `PARTIAL / 16_OF_20`; G07–G10 odzwierciedlają realny wynik bez PASS,
  FIXED ani VERIFIED.

## NIEZWERYFIKOWANE

- Puste Sterowanie light/dark i puste Raporty light/dark — 4 z 20 pozycji.
- Czy dane lokalnego DEV fallbacku widoczne dla foreign owner są dopuszczalnym
  materiałem przeglądowym, czy defektem izolacji wizualnej; nie ma decyzji
  właściciela rozstrzygającej tę granicę.
- Przyczyna modelowa, dla której seeder używa identyfikatorów organizacji
  niezgodnych z kolumną UUID `report_definitions.organization_id`.
- G07–G10 z perspektywy właściciela.

## Zakres zmian wobec markera

Komenda:

```bash
git -C /private/tmp/cx-day73-execution diff --name-only b57253c0397994d2acd7eb79dd56e874fe40c55a..HEAD
```

Wynik końcowego readbacku po commicie:

```text
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY73_EXECUTION_OWNER_REPORT.md
docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md
```
