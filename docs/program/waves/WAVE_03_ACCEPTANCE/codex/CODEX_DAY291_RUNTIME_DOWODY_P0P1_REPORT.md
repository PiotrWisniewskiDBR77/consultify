# CODEX DAY 291 — runtime dowody P0/P1

Data pomiaru: 2026-09-03. Gałąź: `codex/day291-runtime-dowody-p0p1-20260903`.

## R1 — środowisko

Stan: `PASS` dla lokalnego środowiska dowodowego. Użyto wyłącznie kontenera
`cx-day291-pg`, portu PostgreSQL `6295`, backendu `5260` i Vite `5261`.

### Marker — wynik dosłowny

```text
67d235cfa0 Merge agent/p0p1-rozliczenie-20260903: rozliczenie 121 pozycji P0/P1 (33 naprawione, 43 otwarte, 8 nieweryfikowalne, 1 zdezaktualizowana, 36 z rejestrow poza licznikiem)
MARKER OK
67d235cfa079d663ea87ddb46a167c0aa9d7ecab
```

`git status --short | head -3` nie wypisał żadnej linii.

Tip `github-backup/grafika/m03-20260902` był 12 commitów przed markerem; listę
commitów i 29 zmienionych ścieżek zmierzono przed utworzeniem środowiska.
Praca pozostała dokładnie na markerze zgodnie z DEC-2026-08-26-95.

### Migracje i baza

Pierwszy strict run bez `--safe` zakończył się:

```text
→ 20260812a_case_workspace_outbox_next_retry_at.sql
→ 20260813b_audits_source_classification_split.sql
→ 20260813c_method_core_roles_and_approvals.sql
→ init-pgvector.sql
✅ Postgres migrations complete
```

Drugi przebieg: `Applying migrations: 0` i `✅ Postgres migrations complete`.
Liczba plików w `server/migrations`: `1103`. Kanoniczny seeder Inicjatyw
utworzył lokalną bazę `consultify_w3_initiatives_owner_day291` z `886`
zastosowanymi migracjami, 6 personami, dwiema organizacjami i trwałym markerem
fixture `FINAL`. Runtime manifest potwierdził SHA markera, `migrationState: ok`,
`sqlMigrationState: ok`, backend 200, frontend 200 i `clientMarkerVerified: true`.

### Z30

`env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)"` zwróciło `BRAK ZMIENNYCH
POCZTY`. `Gateway.ts` nie zawiera startu drenażu. Po migracjach zapytanie do
`settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy. Runtime potwierdził
`DOTENV_DISABLED` po obu stronach i brak zakazanych kluczy w pięciu procesach.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane.

### Pomiar nazw testów PRZED

`tests/unit/initiatives/initiativeRecordCanon.test.ts`: 6/6 PASS. Pełne nazwy
są w `/private/tmp/cx-day291-runtime-dowody-artefakty/przed-nazwy.txt`.
Pakiet jest czysto statyczny (`RUN_DB_TESTS=0 MOCK_DB=true`); nie dowodzi
egzekucji DB ani auth i nie przechodzi przez pułapki (a)-(e).

### Korekty wobec instrukcji

Surowe `grep -c 'NIEWERYFIKOWALNE'` zwróciło `12`, nie `8`, ponieważ poza ośmioma
wierszami pozycji liczy również tekst i wiersze podsumowań. Lista identyfikatorów
z tabeli nadal zawiera dokładnie osiem pozycji wskazanych w zleceniu.

## R2 — ASM-OWN-001/002/003

Scenariusze źródłowe: `OWNER_FEEDBACK_REGISTER.md:10-43,102-151,207-240`
oraz `modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md:109-111`. Zmierzone przez
kanoniczny runtime, prawdziwy login OWNER, podpisany JWT,
`ApiGateway.initializeRoutes`, realny PostgreSQL i flagę V8 włączoną przez
kanoniczny bootstrap. `ENABLE_TEST_AUTH_BYPASS=false`; runtime pracował w
`NODE_ENV=development`, więc testowe samowyłączenia auth i Results nie miały
zastosowania.

| ID | HTTP / ciało | Zimny readback | Werdykt |
| --- | --- | --- | --- |
| ASM-OWN-001 | `GET /api/method/packs` → 200 `{"packs":[]}`; `GET /api/method/sessions` → 200, jawna pusta lista | osobny klient `pg`: `owner_sessions=0` | `NIE DOTYCZY KODU → G16`: route działa lokalnie; wcześniejsze proxy 404 jest rozjazdem wdrożenia. Pusty katalog w tej fixture nie dowodzi kompletności treści/licencji. |
| ASM-OWN-002 | `GET /api/method/sessions` → 200; deep-link do nieistniejącej sesji → 404 `Session not found` | `owner_sessions=0`; `foreign_sessions=0` | `NIE DOTYCZY KODU → G16` dla 404 proxy; fail-closed jest sprawny. Utworzenie nowej sesji nie było częścią fixture Inicjatyw i pozostaje niezmierzone. |
| ASM-OWN-003 | `GET /api/method/outputs` → 200 `{"outputs":[],"total":0,...}` | `owner_outputs=0` | `NIE DOTYCZY KODU → G16`: endpoint jest osiągalny; brak Output w tej fixture jest uczciwym stanem pustym, nie dowodem trwałości Assessment. |

Obcy OWNER otrzymał własną pustą listę sesji 200; nie zobaczył danych tenant-a
głównego. Artefakty: `evidence/runtime-p0p1-20260903/asm-*.txt` i
`asm-cold-readback.json`.

Gotowe zdania do rejestru:

- ASM-OWN-001: „Lokalny marker 67d235cfa0 wystawia `/api/method/packs` i
  `/sessions` przez realny Gateway/JWT/PG z HTTP 200; wcześniejsze 404 za proxy
  klasyfikujemy jako defekt wdrożenia do G16, nie kodu.”
- ASM-OWN-002: „Nieistniejąca sesja fail-closed daje jawne 404 `Session not
  found`; lokalny draft nie został uznany za serwerową sesję.”
- ASM-OWN-003: „`/api/method/outputs` lokalnie odpowiada 200, a osobny klient PG
  potwierdza 0 trwałych Output w użytej fixture; proxy 404 nie reprodukuje się.”

## R3 — RES-OWN-003 i D8 escalation

| ID | Scenariusz i dowód | Werdykt / zdanie do rejestru |
| --- | --- | --- |
| RES-OWN-003 | Źródło wymaga trwałości 4 KPI, 3 OKR i 3 ROI, ale opisuje je wprost jako UI fixture (`modules/09_RESULTS/MODULE_ACCEPTANCE.md:92`). Nie znaleziono licencjonowanego jednego writera, którym wolno byłoby odtworzyć dokładnie te 10 wierszy. | `OTWARTE / EVIDENCE_MISSING`: „Widoczna fixture 4/3/3 nadal nie ma dowodu zapisu HTTP → zimny PG → restart → HTTP; nie utożsamiać jej z trwałym Results.” Szacunek samego pomiaru po wskazaniu writera/seedera: 2–4 h. |
| D8 `decision-record.escalation` | OWNER `PUT /api/decisions/:id/enhancements` → 200; osobny klient `pg` odczytał `{"level":"manager","reason":"cold-readback-day291"}`; obcy PUT i GET → 404; OWNER GET przed i po restarcie runtime → 200 z identycznym polem. | `NAPRAWIONE / VERIFIED_RUNTIME`: „Pole escalation zapisuje się przez trasę, istnieje w zimnym SQL, przeżywa restart i jest niewidoczne dla obcego tenant-a.” |

Artefakty D8: `evidence/runtime-p0p1-20260903/d8-*`. Zastany test
`day277-decyzje-zapis.pg.test.ts` nie jest zielonym dowodem: 0/2, ponieważ jego
stary payload nie zawiera wymaganego dziś pola `escalation`; walidator zwraca
400 przed sprawdzeniem tenant-a. Nie zmieniano testu ani walidatora.

Pułapki: realne żądania wykonywano w `NODE_ENV=development`, auth bypass był
false; zimny readback wykonał osobny klient `pg`. Restart objął wyłącznie
własne zapisane PGID-y i ponowne uruchomienie kanonicznym bootstrapem.

## R4 — INI-OWN-001

Kanoniczny seeder Inicjatyw na markerze nie tworzy 11 rekordów. Zimny SQL
wykazał 1 realną inicjatywę: `DRAFT`, lecz `current_stage`, `stage`, daty,
ownerzy legacy, ROI, risk, confidence i value timing są `null`; agregat runtime
ma `lifecycleState=IN_EXECUTION`, `readiness=NOT_EVALUATED`, ale `gateStatus`,
`expectedEffect`, `confidence`, `health` i `timeWindow` są `null`.

Werdykt: `OTWARTE` (`server/scripts/seed-wave3-initiatives-owner-review.ts`,
fixture nie realizuje populacji 11 wierszy wymaganej przez scenariusz). Gotowe
zdanie: „Na kanonicznej lokalnej fixture marker 67d235cfa0 ma 1, nie 11 realnych
inicjatyw; rekord ma lifecycle, lecz większość pól przeglądowych pozostaje
pusta, więc INI-OWN-001 nadal blokuje odbiór danych.” Szacunek przygotowania
pełnej reprezentatywnej fixture i pomiaru: 1–2 dni.

Nie wykonano zrzutu 5261: instrukcja wymaga rekordu z listy i populacji 11;
zrzut pojedynczej niekompletnej fixture nie rozstrzygnąłby zleconej tezy.

## R5 — EXE-OWN-003/005 i INT-INIT-AI-OBS-001

| ID | Dowód | Werdykt / zdanie do rejestru |
| --- | --- | --- |
| EXE-OWN-003 | `git log --all -S'Back to list'` wskazuje stare commity `0288a6bc39`, `91f28be6c1`, ale marker nie zawiera zamówionej deterministycznej populacji trzech wierszy; rejestr mówi „uncommitted local review worktree”. | `OTWARTE`: „Opisanej pracy lokalnej nie ma jako checkpointu na linii markera; nie odtwarzano jej zgodnie z Z40.” Szacunek: 0,5–1 dnia po odzyskaniu źródła. |
| EXE-OWN-005 | W drzewie markera brak tekstu `Wróć do listy`; `Back to list` nie występuje w kodzie Execution, a rejestr mówi `pending checkpoint`. | `OTWARTE`: „Dynamiczny Menu 3/Back to list opisany jako pending checkpoint nie jest udowodniony w markerze.” Szacunek: 1 dzień implementacji i testu stanu powrotu. |
| INT-INIT-AI-OBS-001 | Grep w `src/components/Interview` i backend routes/services nie odnalazł wołacza `fill section`; dostępne trafienia dotyczą generatora Inicjatyw. Nie użyto klucza providera i nie wykonano wywołania LLM (Z15). | `NIEWERYFIKOWALNE BEZ PROVIDERA / EVIDENCE_MISSING`: „Na markerze nie ustalono osiągalnego wołacza Interview fill, więc warstw a/b/c nie wolno uznać za sprawne.” Szacunek diagnostyki po wskazaniu exact route: 2–4 h. |

## R6 — tabela dziewięciu pozycji

| ID | Werdykt |
| --- | --- |
| ASM-OWN-001 | NIE DOTYCZY KODU → G16; lokalne HTTP 200 |
| ASM-OWN-002 | NIE DOTYCZY KODU → G16; fail-closed 404 |
| ASM-OWN-003 | NIE DOTYCZY KODU → G16; lokalne HTTP 200 |
| RES-OWN-003 | OTWARTE / EVIDENCE_MISSING |
| D8 escalation | NAPRAWIONE / VERIFIED_RUNTIME |
| INI-OWN-001 | OTWARTE; 1 zamiast 11 rekordów |
| EXE-OWN-003 | OTWARTE; brak checkpointu na markerze |
| EXE-OWN-005 | OTWARTE; brak checkpointu na markerze |
| INT-INIT-AI-OBS-001 | NIEWERYFIKOWALNE BEZ PROVIDERA / brak ustalonej trasy |

### TWIERDZENIA NIEZWERYFIKOWANE

- trwałość dokładnych 4 KPI / 3 OKR / 3 ROI z UI Results;
- pełna populacja i screenshot 11 inicjatyw;
- przelot Network/UI Interview przez trzy warstwy;
- zachowanie scroll/selection po powrocie z dynamicznego dokumentu Execution;
- owner acceptance i jakiekolwiek zachowanie staging/produkcji.

### Pomiar nazw testów PO

Ten sam pakiet kanonu inicjatywy: 6/6 PASS. `diff przed-nazwy.txt
po-nazwy.txt` jest pusty; nie dodano ani nie utracono żadnej nazwy. Hash obu
plików nazw: `9e510adc10a198a9e810fdd349f985224a6007c8d7675f8c825a7b855e2fe1a2`.
Nie wykonano zmian produktu.

Hash głównych artefaktów poza repo:

- migracje 1: `e0daee3816173519c6f85797567b81fb77c663dc15de45c2e62ff1031cf29769`
- migracje 2: `f7274df8efa5c772536a3500fa34af723214f63f0cdce33e60e2a1a4e3768923`
- seed: `daf80396809b3bab00781ff8ba068617a4b3fee4dd47662240b176629706e2a5`
- test D8 (czerwony, nie PASS): `667e94fb3dd8698896ca7065a53d57a27b63ce170e3001e4239d13a6737b102f`
