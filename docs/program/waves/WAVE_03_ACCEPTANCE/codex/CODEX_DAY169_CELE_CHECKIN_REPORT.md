# CODEX — DYŻUR 169 — CELE / OKNA CHECK-INU

Data: 2026-08-30

Marker: `18ba1bd3cf`

Gałąź: `codex/day169-cele-checkin-20260830`

Commit rdzenia: `8363bcb5a3`

Werdykt: **R2/R3 ZROBIONE; R1 PARTIAL; R4 PARTIAL**.

Nie ustawiono żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiono `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## §0.1 — baza pracy i marker

`df -h /` pokazał `30Gi` wolnego. Porty `6060`, `5008`, `5009` były wolne. Kontener: `cx-day169-pg`, obraz `pgvector/pgvector:pg16`, port hosta `127.0.0.1:6060`, baza `cx169`.

Wynik markera, dosłownie:

```text
2310f715f8 docs(codex): dyzury 168 i 169 wydane — priorytety wlasciciela: bootstrap wskaznika, okna check-inu celu
c1170e4766 merge: dyzur 167 (dlug narzedzi — bramka migracji wpieta w CI, parser naprawiony, config PG odpiety w polowie) — odbior adwersaryjny
e3061d9c1c odbior 167: P1/P2 B, P3/P4 A; root vitest.config nietkniety przez blad w MOJEJ licencji — 80 testow obchodzi ten bug recznie
18ba1bd3cf DYZURY PRIORYTETOWE dla toru funkcji: wskaznik bez polityki widocznosci, cel bez okien check-inu
MARKER OK
```

Wynik sanity, dosłownie:

```text
18ba1bd3cf62645cbf3792dc860c50593c95d63b
```

`git status --short | head -3` nie wypisał nic. Tip uciekł o trzy commity; zgodnie z instrukcją rozpoczęto dokładnie z markera. Lista plików rozejścia zawierała m.in. `server/vitest.config.ts` z późniejszą naprawą dyżuru 167; nie scalano jej i nie wykonywano rebase.

Migracje:

- przebieg 1: `✅ Postgres migrations complete`;
- przebieg 2: `Applying migrations: 0`, `✅ Postgres migrations complete`;
- `SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';` → `(0 rows)`.

Nowa migracja `20260830_day169_okr_cadence_windows.sql` **nie powstała**: istniejące tabele i indeks deduplikacyjny wystarczyły; naprawa jest wyłącznie wpięciem zdarzeniowym i addytywnym seedingiem.

## R1 — mapa cyklu życia przed zmianą

| Ogniwo | Uruchamiacz | Istnieje | Wołane na markerze |
|---|---|---:|---:|
| Program | `POST /programs`, publikacja `POST /programs/:programId/publish` w `okr.routes.ts` | TAK | TAK |
| Cykl | `POST /cycles/:cycleId/activate` → `mountTransitionRoute` → `runOkrCycleLifecycleTransition` | TAK | TAK |
| Alternatywa cyklu | `proposeAndExecuteDueCycleTransitions`, nagłówek P10 w `okrCycleScheduler.ts` | TAK | NIE, świadomie niewpięta |
| Set | `POST /sets/:setId/activate` → `mountSetTransitionRoute` → `runOkrSetLifecycleTransition` | TAK | TAK, niezależnie od Cyklu |
| Cel/KR | trasy `POST /sets/:setId/objectives`, `POST /objectives/:objectiveId/key-results` | TAK | TAK |
| Okna | `generateCadenceOccurrences` wywoływana tylko przez `generateCadenceOccurrencesAndSeedCheckInObligations` | TAK | NIE — grep wejściowy: definicja i dwa komentarze, zero wołań |
| Check-in | `POST /key-results/:keyResultId/check-ins`; walidator wymaga `cadenceOccurrenceId: z.string().uuid()` | TAK | blokowany brakiem produkowanego identyfikatora okna |

Pułapka T4 potwierdzona: funkcja na markerze kończyła się wcześniej przy pustym `createdOccurrenceIds`, więc Set aktywowany po Cyklu nie mógł dostać obowiązków dla istniejących okien.

Dowód SQL sprzed aktywacji w każdym z dwóch przebiegów HTTP: `occurrences=0`, `obligations=0`. **Nie zachowano osobnego, post-aktywacyjnego przebiegu bazowego sprzed zmiany**, dlatego B1/R1 ma status `PARTIAL / EVIDENCE_MISSING`, a nie `VERIFIED`. Grep wejściowy dowodzi braku wołacza, lecz nie zastępuje wymaganego pomiaru HTTP+SQL.

## R2 — rozstrzygnięcie architektury i zmiana

Odrzucono trzeci mechanizm harmonogramowania:

- `agentPlanSchedulerJob.ts:72` ma `if (process.env.ENABLE_AI_TASKS_WORKER !== 'true')`; identyczna bramka jest w `Scheduler.ts:879`. Flaga jest default OFF, a job dyspatchuje plany agentowe.
- `wave8AgentScheduleJob.ts:12-18` woła wyłącznie `processDueWave8AgentSchedules`; ten w `wave8AgentRuntimeService.ts:1208-1210` czyta `wave8_agent_schedules`. To worker agentów i leasingu, nie generyczny tick OKR.
- `generateCadenceOccurrences` materializuje cały zakres Cyklu jednorazowo; potrzebne są zdarzenia aktywacji, nie polling.

Wpięcie:

- po zastosowanej aktywacji Cyklu `okr.routes.ts:843-865` best-effort woła generator i zwraca `checkInSeeding` z identyfikatorami okien;
- po zastosowanej aktywacji Setu `okr.routes.ts:1385-1405` best-effort woła `seedExistingCheckInObligationsForSet`;
- `okrCheckInScheduler.ts:140-190` czyta wszystkie istniejące okna Cyklu nowo aktywowanego Setu i wszystkie jego nieanulowane KR-y. `createObligation` zachowuje idempotencję przez dotychczasowy klucz zawierający `cadence_occurrence_id`.

Błąd seedingu jest logowany i nie zmienia `HTTP 200` samej aktywacji. Nie zmieniono `Scheduler.ts`, workerów, rollupu, walidatora ani KPI.

## R3 — dwa przebiegi Real HTTP → Gateway → JWT → RealPG

Test: `server/src/services/resultsVnext/okr/__tests__/day169.checkin-windows.pg.test.ts`.

Pełne nazwy zielonych przypadków:

```text
Day 169 check-in windows through real ApiGateway and PostgreSQL R3: Set active before Cycle gets windows, obligations, HTTP check-in and rollup — passed
Day 169 check-in windows through real ApiGateway and PostgreSQL R3/T4: Set active after Cycle gets obligations for existing windows and HTTP check-in — passed
```

Każdy przypadek montuje `ApiGateway.getInstance().initializeRoutes(app)`, używa podpisanego JWT, wymusza rzeczywisty strażnik beta, tworzy Program → Cykl → Set → Cel → 2 KR-y przez trasy HTTP, a następnie wykonuje oba porządki aktywacji. Dane organizacji/użytkowników są technicznym bootstrapem SQL; wszystkie operacje domenowe idą przez HTTP.

Readback w obu scenariuszach:

- przed aktywacją: `occurrences=0`, `obligations=0`;
- po właściwej aktywacji: liczba obowiązków = liczba okien × 2 KR-y;
- identyfikator okna pochodzi z odpowiedzi trasy aktywacyjnej (`checkInSeeding.cadenceOccurrenceIds`), nie z ręcznego wywołania serwisu;
- `POST .../check-ins` kończy się `201`;
- SQL po check-inie: `current_value=50`, `progress=0.5`, `objective_progress=0.25`, `set_progress=0.25` — rollup `equal_average` zadziałał bez ręcznej ingerencji.

Pułapki Z33:

- (a) `ENABLE_V8_GLOBAL=true` w tej samej linii;
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; konto OWNER/ADMIN ma realny ACTIVE membership;
- (c) `MOCK_DB=false`, `DATABASE_URL=postgresql://...127.0.0.1:6060/cx169`; test asertuje bazę `cx169` i serwerowy port `5432`;
- (d) `ENABLE_TEST_AUTH_BYPASS=false`; test używa podpisanego JWT;
- (e) oba porządki aktywacji są osobnymi nazwanymi przypadkami.

Config: uruchomiono z katalogu `server` przez `--config vitest.config.ts`, czyli faktycznie `server/vitest.config.ts`. Na markerze zarówno `server/vitest.config.ts:17`, jak i root `vitest.config.ts:210` mają `DB_TYPE: 'sqlite'`. Pierwszy przebieg z roota dał `No test files found` i 0 testów — **nie został uznany za PASS**. Efektywny `postgres` jest ustawiany lokalnie w `beforeAll` i natychmiast asertowany; plików config nie zmieniono.

## R4 — mutacja

Zielony kod skopiowano do `/private/tmp/cx-day169-cele-checkin-scratch/okr.routes.green.ts`. Mutacja zmieniła warunek zaczepu Setu na fałszywy. Przebieg z `--retry=0` był czerwony: obie ścieżki zobaczyły `checkInSeeding=null`; późny Set nie otrzymał listy istniejących okien. Mutacja została cofnięta przez `cp`, bez `git stash`. Po przywróceniu: 2/2 nazwane przypadki `passed`; `npx tsc --noEmit -p server/tsconfig.json` → exit 0; `git diff --check` → czysto.

Status R4 pozostaje `PARTIAL`: czerwień jest właściwie związana z podciętym zaczepem, ale pierwszy przypadek zatrzymuje się na kontrakcie odpowiedzi Setu przed sprawdzeniem późniejszego seedingu Cyklu. Nie zawyżam tego do pełnego dowodu dwóch niezależnych mutacji.

## `sourceReference` — pomiar, bez naprawy

- design `OKR_E003_DESIGN.md:445`: `source_reference TEXT NULL`, opaque string, bez live FK;
- walidator create/update: `z.string().max(500).nullable().optional()`;
- UI `OkrKeyResultFormModal.tsx:530`: zwykłe pole tekstowe związane ze stanem `sourceReference`;
- brak walidacji/FK i brak wpływu na rollup pozostawiono bez zmian.

Rekomendacja właścicielska: jeżeli ma powstać wiązanie KPI/inicjatywy, potrzebna jest osobna decyzja o typowanym, wersjonowanym kontrakcie; nie należy zmieniać dzisiejszego pola opisowego w ukryty live FK.

## Artefakty i SHA-256

```text
ec35d1b74c3fd4cf78fa29a31d7a278fbf70dfe2ba44c4dd2325ac785992804a  day169-http-db-evidence.json
f8f78594ca708524684196394e4001138501100b52415e457b413a32f4031409  day169-vitest-green.json
8af6cd1cb35565d6e3dbbac73247c8e66b2198fda124bfa4e0fc4bf564edefc8  day169-vitest-mutation-red.json
7284afab474a94f80ffb1626fd163c3a5c6a393ea9d84e3699b8d3f279c6a88d  day169-vitest-restored-green.json
8db464b77155b1bfeaaa57993311c50c98c9dcba63f692e299520fb47d11ba7d  migrations-pass1.log
a21e9b44e77d2cc51323d7b88f2b0d6536ffd680fc52998962e03219c7b43c7f  migrations-pass2.log
```

Ścieżka: `/private/tmp/cx-day169-cele-checkin-artefakty`.

## Pomiar zasięgu i korekty wobec instrukcji

`git diff --name-only 18ba1bd3cf..HEAD` po commicie rdzenia:

```text
server/src/routes/resultsVnext/okr.routes.ts
server/src/services/resultsVnext/okr/__tests__/day169.checkin-windows.pg.test.ts
server/src/services/resultsVnext/okr/okrCheckInScheduler.ts
```

Instrukcja wielokrotnie odsyła do `§0.4a`, ale wydany plik nie zawiera nagłówka ani treści `§0.4a` (po `§0.2d` następuje `§0.5`). Zastosowano bezpieczniejszą interpretację: uruchomiono cały jedyny nowy katalog testowy dyżuru, porównano pełne nazwy przypadków i nie przypisano temu pomiarowi szerszego zasięgu regresji.

Rozbieżność configu: B9 mówi, że `server/vitest.config.ts` został naprawiony dyżurem 167, lecz marker pokazuje `DB_TYPE: 'sqlite'` w linii 17. Tip zawiera późniejsze commity dyżuru 167; zgodnie z regułą markera nie scalono ich. Zastosowano lokalne nadpisanie w teście i opisano je wyżej.

## TWIERDZENIA NIEZWERYFIKOWANE

- Zachowanie demo/staging/produkcji: **NIEZWERYFIKOWANE** — zakaz Z28.
- Pełny korpus regresji repozytorium: **NIEZWERYFIKOWANY**; uruchomiono nowy pakiet Day169 i TypeScript serwera, nie wszystkie testy repo.
- B1 post-aktywacyjny baseline sprzed zmiany: **EVIDENCE_MISSING**.
- Niezależna mutacja każdego z dwóch zaczepów osobno: **PARTIAL**.
- Dostępność `cadenceOccurrenceId` poza odpowiedziami tras aktywacyjnych: brak osobnej trasy listującej okna; **NOT PROVEN** dla użytkownika, który nie uczestniczył w aktywacji. To jest realny produktowy brak do decyzji, nie naprawiony poza licencją dyżuru.
- Best-effort błąd seedingu (wymuszone uszkodzenie DB przy zachowaniu HTTP 200): **NIEZWERYFIKOWANY** mutacyjnie.

## Stan końcowy

- Push po pierwszym commicie: wykonany na `github-backup/codex/day169-cele-checkin-20260830`.
- `origin`, Railway, demo, staging i produkcja: nietknięte.
- Walidacja `cadenceOccurrenceId`: nietknięta i nadal wymagana.
- Rollup, KPI, `Scheduler.ts`, workery i globalna infrastruktura testowa: nietknięte.
