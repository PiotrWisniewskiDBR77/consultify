# CODEX DAY 134 — most inicjatyw

Stan: **CZĘŚCIOWO ZWERYFIKOWANE / HTTP EVIDENCE MISSING**. Wołacz UI i mutacja domenowa na realnym PG są dowiedzione; pełny przebieg ApiGateway + JWT nie został zmierzony.

## Stan wejściowy

Sanity: `64d3de306c docs(funkcje): ...`; gałąź `codex/day134-most-inicjatyw-20260830`; status pusty; `node_modules` jest symlinkiem; `/` miał 30 GiB wolnego. Porty 6017/4934/4935 były wolne.

- T1: `1732: '/adoptions/accepted-classic'`.
- T2: `grep -rn "accepted-classic\|acceptedClassic" src/ | wc -l` → `0`.
- T3: domena istnieje; linia 21 waliduje `initiative.adopt-accepted-classic`.
- T4: teza wymaga korekty: klasyczny zapis występuje w `createInitiativeService.ts:162,179,316,381`, zaś Runtime zapisuje `ie_aggregate_state` w `postgresMaterialCommandUnitOfWork.ts:231`.
- T5: konsument listy jest jeden: `InitiativesHub.tsx:505` → `listRegisteredInitiatives`, implementacja API `runtimeApi.ts:1042`.

## R1 — wołacz

Dodano flagę `initiativeBridgeFlag.ts`: query → localStorage → env → `false`; wyjątek kończy się `false`. Przy ON lista pokazuje standardową neutralną akcję. Użytkownik podaje ID klasycznej inicjatywy i zaakceptowanego kandydata, potwierdza operację, a UI wysyła `POST /api/initiatives/runtime-v1/adoptions/accepted-classic`, po sukcesie odświeża rejestr. Default OFF nie zmienia ekranu.

Test `InitiativesHub.smoke.test.tsx`, `RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0`:

- przed zmianą produkcyjną: 12 testów, 11 PASS, 1 FAIL: `InitiativesHub smoke confirms and calls the accepted-classic bridge when its flag is on`;
- po zmianie: 12/12 PASS, 0 FAIL;
- osobny przypadek: `keeps the accepted-classic bridge absent when its flag is off`.

Artefakty: `day134-ui-before.json` SHA256 `e03ada6...14a`; `day134-ui.json` SHA256 `55b0fe...4e0`.

Pułapki (a)-(e): pakiet UI jest jednostkowy, nie montuje Gateway ani DB, więc (a)-(e) nie są podstawą jego twierdzeń; dowodzi renderowania, potwierdzenia i kształtu żądania, nie egzekucji serwera.

## R2 — mutacja na realnym PostgreSQL

Kontener `cx-day134-pg`, `pgvector/pgvector:pg16`, port 6017, baza `cx134`. Migracje: pierwszy przebieg zakończony `Postgres migrations complete`; drugi `Applying migrations: 0`.

Przed:

```text
classic_id    | runtime_id
day134-classic|
```

Wywołanie domeny zwróciło `status=APPLIED`, `aggregateVersion=1`, `initiativeId=day134-classic`. Po:

```text
classic_id    | runtime_id
day134-classic| day134-classic
```

Startowo rekord był wyłącznie w `initiatives`; po operacji istnieje również jako `aggregate_type='initiative'` w `ie_aggregate_state`. Artefakty `readback-before.log` SHA256 `183f0a...6e4`, `domain-adoption.log` `1b8c51...bc1`, `readback-after.log` `acfa014...530`.

Pułapki: (c) wyłączona jawnie `MOCK_DB=false DB_TYPE=postgres DATABASE_URL=...6017`; (e) dowiedziona SELECT-em przed/po. (a), (b), (d) dotyczą ścieżki HTTP/strażników, której ten dowód nie obejmuje. Wszystkie wymagane zmienne były w tej samej linii.

## R3 — inwentarz ścieżek zapisu

- `InitiativeWizardModal.tsx:1279`, `InitiativeCharterWizard.tsx:438` i `InitiativesHub.tsx:2666` wołają `createInitiativeWriteTruth`.
- Klasyczny `createInitiativeService.ts` i `InitiativeController.ts` wykonują `INSERT INTO initiatives`.
- Assessment ma osobny klasyczny INSERT: `assessmentInitiativeService.ts:1042`.
- Runtime-v1 zapisuje kanoniczny stan w `ie_aggregate_state` przez `postgresMaterialCommandUnitOfWork.ts:231`.
- Most nie migruje tabeli: wymaga zaakceptowanego `initiative_candidates`, receipt `swot_candidate_handoffs` i zatwierdzonego `tool_outputs`, po czym tworzy kanoniczny agregat o tym samym ID.

## Protokół poczty

`env` → `BRAK ZMIENNYCH POCZTY`; `settings WHERE key LIKE 'smtp%'` → 0 wierszy; Gateway nie zawiera drenaży. Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## KOREKTY WOBEC INSTRUKCJI

1. §0.2 Z10 mówi „brak — ten dyżur NIE wprowadza ani jednej nowej flagi”, ale R1 i tabela licencji nakazują utworzyć `initiativeBridgeFlag.ts`. Bezpieczniejsza interpretacja: utworzono wyłącznie imiennie licencjonowaną flagę, default OFF.
2. §0.1/Z34a nakazuje push po commitach, lecz wklejka i §8 mówią „Nie pushujesz”. Nie wykonano pushu.
3. Z24 odwołuje się do nieistniejącego w dokumencie §0.4a. Podano rzeczywistą listę plików zamiast zmyślonego pomiaru.
4. Opis „przenosi rekord z initiatives” jest skrótem: kod wymaga grafu zaakceptowanego kandydata SWOT. UI zachowuje ten kontrakt.

## TWIERDZENIA NIEZWERYFIKOWANE

- **EVIDENCE_MISSING:** realny POST przez `ApiGateway.getInstance().initializeRoutes(app)`, podpisany JWT i `verifyToken`; nie wolno nazywać pełnej ścieżki „działającą wg DoD”.
- Nie wykonano zrzutów właścicielskich na runtime 4934/4935.
- Nie zmierzono produkcji, demo ani stagingu; zgodnie z zakazem nie nawiązano połączenia.

## Zakres zmian

Wyłącznie `InitiativesHub.tsx`, jego test, `initiativeBridgeFlag.ts` i ten raport. Zero zmian w trasie, domenie, migracjach, middleware, `.env*` i Railway.
