# RAPORT — CODEX2 — Jeden magazyn, część 2

## 0. Metryka

Marker: `19440011e9` · gałąź: `codex/jeden-magazyn-czesc-2-20260911`.

SHA: E1 `362af21358`; E2 `NIEZROBIONE`; E3 (częściowe, per plik) `aac390ceb6`, `6b163ec454`, `703d9195c2`, `92fc4b732c`; E4–E8 `NIEZROBIONE`; E9: commit tego raportu.

`git merge-base --is-ancestor 19440011e9 HEAD` → exit `0`.

`git rev-parse HEAD` → `92fc4b732cc1ac46c929d11817a6a5414077748c`; `git status --short` → pusty przed utworzeniem raportu.

Kontener/baza/porty: `cx-codex2-pg` / `cx_codex2` / `6452`; port harnessu `5592` nie został zajęty. Migracje: przebieg 1 zastosował migracje do `20262107`; przebieg 2: `Applying migrations: 0`, `Migration complete`. Wszystkie commity niosą cztery wymagane znaczniki; hook `check-freeze.sh` przepuścił każdy commit.

## 1. K-PUNKTY — PRZED i PO

| K | Co mierzę | PRZED (mój pomiar / autor) | PO | Komenda |
|---|---|---:|---:|---|
| K1 | bramki inicjatywy tylko legacy | 50 / 50 | 48, etap nieukończony | `rg -n "SELECT id FROM initiatives WHERE id" server/src \| rg -v __tests__ \| wc -l` |
| K2 | istniejące fallbacki | 3 / 3 | 5 logicznie, dwa nowe za flagą | komenda 2 z §0.1a |
| K3 | bramki ocen | 37 / 37 | 37, niezrobione | komenda 8 |
| K4 | pola karty z pisarzem | 3/4 / 3/4 | 4/4 (`title`, `summary/problem`, `description/proposedOutcome`, owner) | test klienta 7/7 i realdb 6/6 |
| K5 | sześć ścieżek legacy | 0/6 wycofanych; 6/6 ma wołaczy / zgodne | bez zmian; E2 niezrobione | komenda 7 |
| K6 | siedem powierzchni | 2/7 treść + 1/7 słabe / 3/7 surowo | 2/7 treść + 1/7 słabe; dwa statusy 404 naprawione, brak treści | test E8 `--retry=0` |
| K7 | finanse bez aliasu | niezmierzone | niezmierzone | E5 niezrobione |
| K8 | artefakty | niezmierzone | niezmierzone | E6 niezrobione |
| K9 | demo bez agregatu | seed istnieje; liczba lokalnie 0 / autor podał dług | 0 na świeżej bazie | komenda 12 |
| K10 | pominięte przez migrator | 0 lokalnie / autor: dane z innego środowiska | 0, `UNKNOWN` dla kopii danych | cykl E1c |

## 2. Stan wejściowy — 14 komend z §0.1a

Pełny dosłowny wynik: `/Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty/stan-wejsciowy-14-komend.txt`.

Wynik komendy (2), dosłownie:

```text
FALLBACK: server/src/controllers/InitiativeController.ts:3275
FALLBACK: server/src/routes/initiatives-additive.routes.ts:60
FALLBACK: server/src/services/initiative/initiativeKpiAssignmentService.ts:262
```

Wynik komendy (7), dosłownie:

```text
milestones: TasksMilestonesSection.tsx:753,875
resources: ResourcesSection.tsx:1326; InitiativeDocumentView.tsx:2925,3986
staffing-plans: src/services/api.ts:7187,7203,7216
budget-items: InitiativeDocumentView.tsx:2953,4050,4068
gate-roles: InitiativeGatesWorkflowTable.tsx:752; GateReadinessSection.tsx:948; InitiativeDocumentView.tsx:2858
move: InitiativeTeamSection.tsx:142
```

Rozbieżność komendy 13: pomiar wykrył rzeczywiste ciche `catch` w `PresentationDeck.tsx` (2) i `FinanceSavedViewsPanel.tsx` (1), nie tylko komentarze wskazane w wyjściu skróconym.

## 3. Etapy — po jednej sekcji na etap (E1…E9)

### E1

Zrobione: kanoniczny `PUT`, obsługa czterech pól, walidacja właściciela/polityki, jawny `409`, flaga zapisu default OFF, klient wysyła owner, migrator parametryzuje bazę i odmawia wszystkich hostów Railway. Realdb: 6/6; klient: 7/7; TypeScript: zielony. Definicja nie jest w pełni spełniona: brak dowodu mutacyjnego i licznik jednego żądania w oknie 12 s nie został osobno zmierzony. §0.2e: realny Postgres, JWT, brak auth bypass, `--retry=0`.

### E2

NIEZROBIONE. Potwierdzono tylko, że wszystkie sześć tras ma realnych wołaczy. Nie wycofano żadnej ścieżki bez dowodu wspólnego modelu odczytu.

### E3

CZĘŚCIOWE. Przełączono po jednej bramce: Results dashboard i Execution capacity timeline. `ON`: oba przestały odpowiadać 404 dla rekordu kanonicznego; `OFF` zachowuje legacy lookup. K1 50→48. Pozostałych 45 bramek nie przełączono. Testy tras zastanych nie wystartowały przez istniejący niepełny mock `validateOrgMembership`; TypeScript i realny test ApiGateway przeszły. §0.2e: realny przebieg wymusił `ENABLE_V8_GLOBAL=true`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, PostgreSQL i realny JWT.

### E4

NIEZROBIONE: projekcja ocen i pomiar tożsamości.

### E5

NIEZROBIONE: finanse.

### E6

NIEZROBIONE: artefakty.

### E7

NIEZROBIONE: siódmy pisarz.

### E8

NIEUKOŃCZONE. Pomiar po dwóch bramkach: lista i karta spełniają treść; KPI tylko kryterium słabe; Execution i Results zwracają 200, ale bez id/tytułu; My Work nie listuje rekordu; raport echo-uje id bez tytułu. Nie zmieniono testu, nie usunięto `it.todo`, nie wykonano czterech macierzy ani zapisu po odczytach. Nie dopisywano pól do kopert tylko po to, by zazielenić test.

### E9

Raport ma wszystkie 14 sekcji i jawnie zachowuje czerwone bramki. Nie oznacza odbioru całego bloku.

## 4. Dowody mutacyjne (Z32)

NIE WYKONANO. Wymagane minimum (E1, E3, E4 oraz trzy E8) pozostaje czerwonym warunkiem odbioru. Nie przedstawiam zwykłych testów jako dowodów mutacyjnych.

## 5. Pomiar zasięgu testów (§0.4a, Z24)

Pomiar wejściowy root-config: 3 nazwy, 2 zaliczone, 1 `todo`; błędna próba z `server/vitest.config.ts` zebrała 0 i nie jest dowodem. Po E1 dodano 10 przypadków (6 realdb oraz 4 jednostkowe), lecz pełny końcowy `po-nazwy.txt` i `diff` nie zostały wykonane. Warunek Z24: **NIESPEŁNIONY**.

## 6. Deklaracja Z30

Nie uruchomiłem serwera aplikacyjnego ani drainera outboxa. Nie zestawiłem połączenia do Railway/demo/staging/produkcji. Nie wczytałem `server.env`. Przed zapisami sprawdzono brak `SMTP_`/`EMAIL_FROM`, brak ustawień SMTP w bazie i brak `startExecutionOutboxDrainer` w Gateway. `SELECT count(*) FROM ie_outbox_delivery_receipts` po E1/E1c → `0`.

## 7. Migracje i manifesty

E1c: dry-run nie utworzył manifestu. Apply 1 i 2 utworzyły manifesty poza repo; oba: legacy/canonical/eligible/created `0`, md5 legacy przed/po `d41d8cd98f00b204e9800998ecf8427e`. Verify → `ok:true`, rollback → `deleted:0`, ponowny verify → `ok:true`. Ostrzeżenie narzędzia: pusty manifest nie potwierdza żadnego utworzonego agregatu. E5/E6: niezrobione.

## 8. Korekty wobec instrukcji

Brak `02_DECYZJA_NADZORCY.txt`, dlatego WARIANT N. Na świeżej bazie nie było „dzisiejszych 2 rekordów”, tylko 0; niczego nie dosiewano. Komenda 13 ujawniła trzy realne ciche `catch`. Testy tras V8 nie startują z powodu długu mocka. Nie użyto bazy stagingowej ani właścicielskiej, więc liczby danych autora nie są potwierdzone lokalnie.

## 9. STOP-y

| Miejsce | Fakt | Licencja | Czego potrzeba | Co dostarczyłem ZAMIAST |
|---|---|---|---|---|
| E3 | 45 bramek pozostało | tylko wskazane bramki, per plik | dalsza implementacja i testy per plik | 2 bramki, K1=48, izolacja flagą |
| E8 | 200 bez treści na Results/Execution; My Work nie czyta inicjatyw; raport bez tytułu | test E8 wąski; brak zgody na sztuczną kopertę | prawdziwe projekcje/read-model | macierz rzeczywista 2+1/7 |
| E1c | baza ma 0 rekordów legacy | tylko lokalna baza 6452 | legalna kopia danych z rekordami | pełny cykl na pustym manifeście z ostrzeżeniem |

## 10. TWIERDZENIA NIEZWERYFIKOWANE

Niezweryfikowane: realne liczby z kopii stagingu autora; wydajność projekcji dla 121 rekordów; zachowanie pozostałych 45 bramek; sześć następców E2; tożsamość ocen; aliasy finansów; integralność artefaktów; skuteczność demo seed; 7/7 E8; zachowanie przeglądarki na porcie 5592.

## 11. DO DECYZJI WŁAŚCICIELA

| Decyzja | Czego zabrakło, żeby rozstrzygnąć samodzielnie |
|---|---|
| rekordy bez projektu/właściciela | brak decyzji i legalnego źródła danych dla wskazanych 105 rekordów |
| tożsamość core↔legacy ocen | brak reguły produktu i właściciela backfillu |
| 65 osieroconych linków artefaktów | brak reguły: usunąć, naprawić czy zachować jako audyt |
| aliasy finansowe na demo | zakaz połączenia z demo i brak autoryzacji backfillu |

## 12. ZNALEZISKA POBOCZNE

- `pmoValidation.middleware.ts`: bramka bez `organization_id`, nietknięta; wymaga osobnej decyzji o granicy tenanta.
- `initiative.validators.ts:70`: `status.default('DRAFT')` pozostaje.
- Dwa egzemplarze słownika stanów pozostają ryzykiem rozjazdu, choć test parytetu istnieje.
- `server.env` może zawierać żywe SMTP; nie został otwarty ani załadowany.
- `initiativeOwnerEligibility.swiezyProjekt.realdb.test.ts:59`: nie sprawdzono ponownie — `UNKNOWN`.
- Unit testy V8 mają niepełny mock `validateOrgMembership` i kończą się przed zebraniem testów.

## 13. Artefakty

| Plik | SHA-256 |
|---|---|
| `/Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty/stan-wejsciowy-14-komend.txt` | `b2516f3cb62206150feb57a686f651f94fadede291ddb61a52f48f50a55635d8` |
| `/Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty/e1-client-final.json` | `c588f623d8f290d73de749ecd46d43b36e85d1598ac3e2817ca3927dfc5caaf6` |
| `/Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty/e1-realdb-final.json` | `7d799ea9cea71dceeaf22ea9fa75cad106deb95390ec9dbb257647d5541fe684` |
| `/Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty/migracje-przebieg-1.log` | `f39985b1a40d03d4652ed41716fb6da03feab8691bfa788e9b74b6f17bda1bfd` |
| `/Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty/migracje-przebieg-2.log` | `d97f82397a74fefebe0f3e88d00261aff4e899e4e375bf39ee5f428f837cfa63` |
| `/Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty/inicjatywy-kanon-apply-2026-09-10T21-14-05-025Z.json` | `a9d4dba0693fe26649083905898b3dc8bdcf62634756bf315c564a5c61b0134a` |
| `/Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty/inicjatywy-kanon-rollback-2026-09-10T21-14-20-140Z.json` | `9856a4f8106538c05181f7934a4988dae7f27862cb5737db3d40cee00929fb19` |

Werdykt końcowy: **NIEGOTOWE DO ODBIORU / NOT_PROVEN**. Gotowy jest E1 z zastrzeżeniami; E3 jest częściowy; E2 i E4–E8 pozostają niezrobione.
