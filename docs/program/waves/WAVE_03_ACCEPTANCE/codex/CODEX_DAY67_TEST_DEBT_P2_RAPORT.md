# DYŻUR 67 — TEST DEBT P2 — RAPORT PO FINALNEJ KOREKCIE KLASYFIKACJI

## Status

`PARTIAL` — pozycja „naprawialny dług testowy P2” jest **ZROBIONE**. Końcowy izolowany regres: **41/49 zielonych plików, 8/49 czerwonych plików**. Pozostałe czerwienie są nazwanymi kontraktami produktu, schematu, release albo decyzji właścicielskiej. Nie deklaruję `FIXED` dla B9 ani żadnego z tych kontraktów.

Gałąź: `codex/day67-test-debt-p2-20260828`. Marker: `6868d57ebcb346e7d4bf142eb89229bc6bcd3e98`. Start drugiej samopoprawy: `de1161233b37141dea8afe8e5080dc91587ccdf8`. Remote: wyłącznie `github-backup`.

## Środowisko, migracje i regres

- wyłącznie własny kontener `cx-day67-pg`, `127.0.0.1:5939`, baza `cx_day67_testdebt`;
- pełne istniejące migracje: exit 0; drugi przebieg: `Applying migrations: 0`, exit 0;
- nowych migracji: 0; rezerwacja `20261670-20261679` nieużyta;
- zero Railway, demo, stagingu i produkcji;
- każdy z 49 plików uruchomiono osobnym procesem z wymaganym real-PG env i `--retry=0`;
- wynik: **41 PASS / 8 FAIL**. Logi: `/private/tmp/consultify-day67-test-debt-p2-artifacts/final-correction-isolated/`.

Jednorazowa czerwień `pmo-initiatives.routes.program-rollup.test.ts` z poprzedniego przebiegu nie odtworzyła się po cofnięciu proponowanej zmiany (4/4 zielone), więc nie wprowadzono nieudowodnionej korekty. Końcowy pełny przebieg także jest zielony dla tego pliku.

## Dyspozycja wszystkich 41 plików czerwonych na wejściu

Baseline drugiej samopoprawy miał 41 czerwonych plików. Poniżej każdy ma pierwszą przyczynę, kategorię, właściciela i werdykt: 33 zamknięto w P2, 8 pozostaje jako kontrakty produktu/decyzji.

| plik | pierwsza przyczyna | kategoria / właściciel | werdykt |
| --- | --- | --- | --- |
| `agentProductionBuildBoundary.test.ts` | komendy build/release różnią się od pinu | produkt/release: `server/package.json`, `railway.toml` | poza P2, czerwony |
| `aiActionExecutor.wave3-runtime.test.ts` | adapter `INSERT tasks` pomijał `organization_id` | test: ten plik | ZROBIONE |
| `controllers/AuthController.test.ts` | brak challenge API w mocku | test: ten plik | ZROBIONE |
| `controllers/DecisionController.test.ts` | brak transakcji, stary finalizer i status | test: ten plik | ZROBIONE |
| `controllers/InitiativeController.test.ts` | stare project/access/benefits/DONE fixtures | test: ten plik | ZROBIONE |
| `controllers/InterviewAssignmentsController.test.ts` | brak transakcji, `changes`, idempotency | test: ten plik | ZROBIONE |
| `controllers/OrganizationController.audit.test.ts` | stary nieatomowy mock IAM | test: ten plik | ZROBIONE |
| `controllers/adminAudit.emission.test.ts` | stary mock IAM i błędny fail-safe | test: ten plik | ZROBIONE |
| `database/mockDatabase.test.ts` | wadliwy parser aliasów/callback mock DB | produkt: `server/src/database/Database.ts` | poza P2, czerwony |
| `generateDeliverable.canvasTools.test.ts` | brak `buildNoteEvidenceContract` w mocku | test: ten plik | ZROBIONE |
| `harvardModuleContract.test.ts` | brak mountu Process Flow | produkt: `server/src/index.ts` i route | poza P2, czerwony |
| `helpChat.routes.test.ts` | oczekiwany wyciek surowego błędu | test: ten plik | ZROBIONE |
| `middleware/apiKeyAuth.middleware.test.ts` | wyciek `doMock` i brak user/FK fixture | test/dane: ten plik | ZROBIONE |
| `middleware/orgContext.middleware.test.ts` | HISTORYCZNY NIEOSIĄGALNY FIXTURE: nielegalne role odrzucane przed middleware | dane/test: ten plik | ZROBIONE W P2; zastąpiono schema fail-closed + legalnym middleware contract, 48/48 |
| `notificationService.test.js` | SQLite shape kontra PG | dane/test: ten plik | ZROBIONE |
| `organizationService.test.js` | produkt zapisuje brakujące `created_by_user_id` | produkt/schema: `organizationService.ts` lub migracja | poza P2, czerwony |
| `permissionService.test.ts` | brak fail-closed `{fallback:false}` w asercjach | test: ten plik | ZROBIONE |
| `routes/accessRoleBuilder.security.test.ts` | kolejka mocków przechodziła między testami | test: ten plik | ZROBIONE |
| `routes/adminP32.security-audit.test.ts` | membership bez `ACTIVE` | test: ten plik | ZROBIONE |
| `routes/document-studio.routes.leak-guard.test.ts` | brak aktualnych precondition | test: ten plik | ZROBIONE |
| `routes/h64-failsoft-batch6.test.ts` | schema-readiness 503 przed badaną gałęzią | test: ten plik | ZROBIONE |
| `routes/interview.routes.org-guard.test.ts` | niepełne eksporty lokalnego mocku | test: ten plik | ZROBIONE |
| `routes/metricsOrgRoutes.test.ts` | stary auth mock i brak parent error handlera | test: ten plik | ZROBIONE |
| `routes/partner-payouts-auth.test.ts` | niepełne eksporty lokalnego mocku | test: ten plik | ZROBIONE |
| `routes/pmo-decisions.routes.org-guard.test.ts` | niepełne eksporty lokalnego mocku | test: ten plik | ZROBIONE |
| `routes/pmo-initiatives.routes.org-guard.test.ts` | niepełne eksporty lokalnego mocku | test: ten plik | ZROBIONE |
| `routes/pmo-initiatives.routes.program-rollup.test.ts` | niepełne eksporty; późniejsza flaga nieodtworzona | test: ten plik | ZROBIONE, 4/4 |
| `routes/tools.routes.org-guard.test.ts` | niepełne eksporty lokalnego mocku | test: ten plik | ZROBIONE |
| `services/UnifiedExportService.test.ts` | fixture fontu VM | środowisko/test: ten plik | unit-flow ZROBIONE |
| `services/adminSessionService.test.ts` | zły indeks parametru | test: ten plik | ZROBIONE |
| `services/artifactRegistryService.test.ts` | historyczny helper `resolvePresentationSlideCount`; produkt używa coherence + mappera | test: ten plik | ZROBIONE W P2; aktualna powierzchnia 9/9 |
| `services/documentStudio/documentBlockProseGenerator.warnings.test.ts` | test oczekiwał wycieku `provider down` | test: ten plik | ZROBIONE |
| `services/generateDeliverableTool.test.ts` | stary audience `internal` | test: ten plik | ZROBIONE |
| `services/partnerCertificatePdf.test.ts` | realny font odrzucany przez PDFKit/fontkit | produkt/środowisko: `pdfFonts.ts`, asset | poza P2, czerwony |
| `services/partnerToolkitResources.test.ts` | fixture fontu VM | środowisko/test: ten plik | unit-flow ZROBIONE |
| `services/presentationGeneratorService.evidencePersist.test.ts` | stary mock deck-document | test: ten plik | ZROBIONE |
| `services/presentationGeneratorService.narrativeExtended.test.ts` | stary mock deck-document | test: ten plik | ZROBIONE |
| `services/systemAlertNotifier.test.ts` | mock starego SlackService | test: ten plik | ZROBIONE |
| `slackRouter.test.ts` | bezstrefowy timestamp + Europe/Warsaw wygasza dedupe | produkt/schema: Slack router/migracja | poza P2, czerwony |
| `subscriptionAnalyticsService.test.ts` | serwis i konsumenci runtime nie istnieją; test opisuje potencjalne MRR/churn/LTV/cohort | decyzja właścicielska | `OWNER_PRODUCT_DECISION`, czerwony; nie blokuje P2 |
| `wave8AgentRuntimeService.test.ts` | `wave8_schema_write_failed` | produkt/schema: runtime + schema owner | poza P2, czerwony |

Pełne nazwy historycznych czerwonych testów są zachowane w logach baseline i cyklach mutacyjnych w katalogu artefaktów. Poniżej komplet nazw wszystkich kontraktów nadal czerwonych w finale.

## Pozostałe 8 czerwonych plików — pełne nazwy

1. `agentProductionBuildBoundary.test.ts`: `Agent production build boundary > uses the fail-hard production project for the public backend build command`; `Agent production build boundary > runs the packaged strict Postgres migrator before the Railway API starts`. Produkt/release; właściciel `server/package.json`, `railway.toml`; poza P2.
2. `database/mockDatabase.test.ts`: `mock Database > updates and reads my_idea_maps rows by composite key with select aliases`; `mock Database > reads mock table columns through dbSchema helper`. Produkt; właściciel `server/src/database/Database.ts`; poza P2.
3. `harvardModuleContract.test.ts`: `Harvard module contract — every module has a mounted backend > M07 Ideas — Process Flow — primary endpoint base is mounted in the route layer`. Produkt; brak `/api/v8/process-flow/contract`; poza P2.
4. `organizationService.test.js`: `OrganizationService > createOrganization > should create a new organization`; `... > should store organization in database`; `... > should add creator as OWNER member`; `OrganizationService > getOrganization > should return organization by ID`; `OrganizationService > addMember > should add a member to organization`; `... > should reject invalid roles`; `OrganizationService > getMembers > should return organization members`; `OrganizationService > getUserOrganizations > should return user organizations`; `OrganizationService > updateMemberRole > should update member role`; `OrganizationService > removeMember > should remove member from organization`; `OrganizationService > AI Settings > should get default AI settings`; `... > should update AI settings`. Produkt/schema; brak kolumny `created_by_user_id`; poza P2.
5. `services/partnerCertificatePdf.test.ts`: `generatePartnerCertificatePdf > integration contract: application font renders Polish glyph input into a valid PDF`. Produkt/środowisko; `pdfFonts.ts:143`, `Not a supported font format or standard PDF font`; poza P2. Helvetica dowodzi tylko unit-flow; realny font i polskie glify `NOT_PROVEN`.
6. `slackRouter.test.ts`: `slackRouter.routeToSlack > dedupe SURVIVES a simulated process restart (durable, DB-backed)`. Produkt/schema; timestamp bez strefy; poza P2.
7. `subscriptionAnalyticsService.test.ts`: kolekcja pliku nie startuje, bo `server/src/services/subscriptionAnalyticsService.js` nie istnieje. **`OWNER_PRODUCT_DECISION`** — brak serwisu i konsumentów runtime; potencjalne MRR/churn/LTV/cohort wymaga osobnej decyzji zakresowej. Nie blokuje zamknięcia test-local P2.
8. `wave8AgentRuntimeService.test.ts`: `Wave 8 agent runtime > exposes a complete specialized agent catalog with scoped tools and schemas`; `... > stores admin-editable AgentDefinition overrides in the Wave 8 database catalog`; `... > blocks tool misuse and swarm without approval and budget gate`; `... > launches role-specific schema-valid output and creates owner-audited schedules`; `... > enforces approvalPolicy and processes due schedules`; `... > records eval run hooks as audit-only hooks without executing an evaluator`; `... > enforces tool scope before executing agent tools`. Produkt/schema; `wave8_schema_write_failed`; poza P2.

## B9 — obowiązkowy pin

Werdykt: **KANONIZACJA DZIURY — `NOT_AUTHORIZED` do implementacji produktu**. `harvardCrossModuleFlows.test.ts` przechodzi 22/22 i nadal wymaga `B9` w `status === 'stub'`; asercji nie zmieniono.

Potrzebny plik produktu: `server/src/services/tablePlatform/ModuleSyncService.ts`. Zapis kończy się na `tp_module_sync_results`. Brakuje konsumenta/read-back w Results (M15), Finance (M16) i Execution/Initiatives (M14). Minimalny przyszły dowód: realny Gateway + JWT + membership, zapis B9, niezależny read-back skutku w trzech modułach dla tego samego tenantu i negatywny read-back drugiego tenantu, real-PG, `--retry=0`.

## Mutacje i asercje

Każda nowa reprodukowalna naprawa miała kopię `cp`, zielony przebieg, kontrolowane cofnięcie z nazwanym czerwonym testem, przywrócenie, zielony przebieg i kontrolę diffu. Logi `second-*-mutation-red.log` oraz `second-*-restored-green.log` są zachowane.

Finalna korekta dodała trzy osobne cykle: Artifact Registry (mutacja przywracająca fantomowe `slideCount: 11`), Org Context schema fail-closed (mutacja kodu constraintu `23514 → 23505`) oraz legalny middleware contract (mutacja oczekiwanej roli `ADMIN → MEMBER`). Każda mutacja zaczerwieniła dokładnie nazwany test, a pełne pliki po odtworzeniu przeszły odpowiednio 9/9 i 48/48. Stare przypadki `sanitizes whitespace-padded membership role before attaching org context` oraz `falls back to MEMBER role when membership role contains control characters` mają werdykt: **HISTORYCZNY NIEOSIĄGALNY FIXTURE — zastąpiony kontraktem fail-closed**.

Zmiany asercji są zamierzonym zachowaniem, nie osłabieniem: fail-closed IAM; `draft → pending`; generyczny warning bez wycieku; audience `executive`; idempotent replay bez ponownego lifecycle write; 422 `CARD_CONTENT_FORMULA_VIOLATION`; `CLOSURE_GATE_DECISION_REQUIRED` zamiast starego bezpośredniego DONE/handoff. Nie użyto `.skip`, `@ts-ignore`, `@ts-expect-error`, zmian progów, `exclude` ani stash.

## Kompilacje i SHA-256 artefaktów

- serwer: brak `server/dist`, następnie `npm exec tsc -- --build tsconfig.build.json` w `server/` — exit 0. Literalne `rm -rf` odrzuciła warstwa wykonawcza; katalog przeniesiono odzyskiwalnie do scratch;
- frontend: pierwszy `npm run build` osiągnął 10 508 modułów, potem OOM ~4 GB; `NODE_OPTIONS=--max-old-space-size=8192 npm run build` — exit 0;
- summary final-isolated: `c62015f26cf0ff9103b6f2eced87452601112af77b6b1b9a4bf6be9581b5a2b9`;
- manifest logów: `7d7bdf90cf88610ee990199982a85f22e4e0c930af9bd46b548528c588352e4f`;
- server build log: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`;
- frontend build log: `dfd9bd4328d7dbdd59caaf8b6e72b7ac9fcb29fe903a2cd897b6030f4a23e178`;
- migration pass 1: `cb65fefba10ca0b20df9161ffb5d6256222a4397940d0c1df2d1e978a064652b`;
- migration pass 2: `e470c4ead51106b8c22a0b72145c0b017a255ebe73bcfc8b4042d71c7fd4c2f4`.

## Commity i karta

Commity drugiej samopoprawy: `4634fe69eb`, `f616691cdb`, `a7e4085014`, `d041d2a4b3`, `77e7b4cf28`, `a9b88317f0`, `cdf75300c3`, `3a5180fef3`, `b32f1f2da4`, `37f796a33e`, `8e855adf03`. Finalna korekta testów: `d5707bb971`. Każdy wypchnięto natychmiast na `github-backup`.

- finalny tip: symbolicznie `github-backup/codex/day67-test-debt-p2-20260828`; dokładny SHA jest podawany w oddaniu po utworzeniu i wypchnięciu commita raportu. Literalny SHA commita zawierającego własny SHA jest kryptograficznym samoodwołaniem;
- marker przodkiem: TAK; produkt/migracje/setup/helpers/`__mocks__`/Vitest config bez zmian;
- finalnie: 41 PASS / 8 FAIL; naprawialny dług testowy P2 ZROBIONE; B9 `stub`, `NOT_AUTHORIZED`;
- status: `PARTIAL`.
