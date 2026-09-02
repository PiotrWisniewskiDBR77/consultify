# CODEX DAY 242 — UPRAWNIENIA

## Streszczenie

Gałąź: `codex/day242-uprawnienia-20260901`. Baza: `df7f13056f`.

- Permission Requests approve/reject: kod naprawiony, cztery właściwe asercje HTTP/SQL
  są mutation-sensitive.
- AI Context PUT/DELETE: kod naprawiony, obie mutacje są mutation-sensitive.
- Videos DELETE: statyczny check dodany, lecz pozycja **EVIDENCE_MISSING / NOT VERIFIED
  LIVE**, ponieważ pełne migracje nie tworzą tabeli `videos`.
- Nie zmieniono `Gateway.ts`, flag, middleware globalnych, migracji ani trzech plików
  wzorcowych.

## Blok 0 i R1

```text
df -h / -> 11-12 GiB wolne (powyżej progu 5 GiB)
merge-base --is-ancestor df7f13056f github-backup/codex/m03-admin-20260824
MARKER OK
git rev-parse HEAD
df7f13056fa24995be07f64b0e8c877b3faeab45
git status --short | head -3
<pusto>
porty 6221, 5196, 5197: brak listenerów przed startem
```

Tip uciekł do przodu o `fdac443d4d` i `818e9cec0b`; zgodnie z instrukcją praca
pozostała dokładnie na markerze. R1 potwierdził istniejące checki w Project Members,
Studio i Escalations oraz brak checków w pięciu mutatorach objętych dyżurem. Wszystkie
trzy routery są montowane przez `mountStub`; `contextRoutes` jest na liście jawnego 501.

Pełne rodziny tras:

| Rodzina | Wszystkie endpointy |
| --- | --- |
| Permission Requests | `GET /`, `POST /`, `PUT /:id/approve`, `PUT /:id/reject` |
| Videos | `GET /`, `POST /`, `DELETE /:id` |
| AI Context | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` |

Konsumenci frontu: `PermissionRequestSection.tsx:129` woła `Api.getPermissionRequests`,
ale `src/services/api.ts:13158` zwraca lokalnie `[]`; nie znaleziono żywych wywołań
`/api/permission-requests`, `/api/videos` ani `/api/context` w `src/`.

## Real Postgres i bezpieczna poczta

Kontener `cx-day242-pg`, `127.0.0.1:6221`, baza `cx242`, obraz
`pgvector/pgvector:pg16`. Pierwszy przebieg: `Applying migrations: 880` i
`Postgres migrations complete`; drugi: `Applying migrations: 0`.

```text
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)"
BRAK ZMIENNYCH POCZTY
SELECT key ... FROM settings WHERE key LIKE 'smtp%';
(0 rows)
grep drenazy w Gateway.ts
0 trafień
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera
wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu
outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane. Rejestracja
wywołała wyłącznie konsolowy transport `Using Host: Mock (Console)`.

## R2 — dowody

Komplet env był w tej samej linii: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres
NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=... JWT_SECRET=...`.
Testy biegły z katalogu `server/`, configiem `vitest.config.ts` i `--retry=0`; wariant
z roota i ścieżkami `server/src/...` dał uczciwe `0 tests`, nie został uznany za PASS.

Mutacja RED (`day242-mutation-red.json`): cztery testy bezpieczeństwa FAIL; po usunięciu
checków wszystkie obce żądania zwracały `200` zamiast oczekiwanego `404`. Po odtworzeniu
przez `cp`, `diff -u` kopia–plik był pusty. Stan FIXED
(`day242-fixed-green-assertions.json`): cztery właściwe asercje PASS, 0 FAIL.

Runner jako całość nadal ma exit 1 z powodu zastanych nieobsłużonych odrzuceń realnego
`POST /api/auth/register`: runtime-DDL używa typu `DATETIME`, a następnie brakuje tabeli
`email_verification_tokens`. Nie osłabiono testu ani nie zmieniono auth/migracji.

Videos: kontrakt `day242-videos-org-isolation.realpg.test.ts` jest czerwony, ponieważ
`information_schema.columns` zwraca `[]`. Bez licencji na migrację nie utworzono atrapy
tabeli i nie wpisano `VERIFIED`.

## §0.4a — pełne nazwy

Przed zmianą: R1.8 wykazał zero plików trzech pakietów, więc zbiór nazw był pusty.
Po zmianie dodano pięć pełnych nazw: approve, reject, context PUT, context DELETE oraz
videos schema prerequisite. Żadna wcześniejsza nazwa nie zniknęła.

## R3 — przesiew 19 plików

| Plik | Klasyfikacja | Dowód |
| --- | --- | --- |
| `ai/ai-ab-testing.routes.ts` | DZIURAWY statycznie | serwis `abTesting.ts:83,165,182-282` operuje po `id`, bez org |
| `ai/ai-budgets.routes.ts` | DZIURAWY statycznie | router `:109-153,266-305,410-425`; serwis `aiBudgetService.ts:235-290,566-572` |
| `ai/ai-drafts.routes.ts` | DZIURAWY statycznie | approve/reject `:310-389`; `draftService.ts:39-78` aktualizuje po `id` |
| `ai/ai-training.routes.ts` | BEZPIECZNY | DELETE deleguje do `AITrainingController.ts:179-193`, SQL ma `organization_id` |
| `ai/aiExplain.routes.ts` | GLOBALNY/NIETRWAŁY | kontroler zwraca explainability, brak mutacji obiektu tenantowego w próbce |
| `ai/aiAnalytics.routes.ts` | GLOBALNY/NIETRWAŁY | szczegóły action/playbook są odpowiedziami bez SQL (`AIAnalyticsController.ts:196-229`) |
| `ai/aiAsync.routes.ts` | GLOBALNY/NIETRWAŁY | status joba jest odpowiedzią mock, bez SQL (`AIAsyncController.ts:57-83`) |
| `assessment/assessment-ai.routes.ts` | BEZPIECZNY dla trwałych odczytów | `getAssessmentData :55-63` ma `id AND organization_id` |
| `billing/settlements.routes.ts` | DZIURAWY odczyt | `GET /:id/line-items :76-91` filtruje wyłącznie `settlement_id`; process jest globalnym SuperAdmin |
| `billing/tokenBilling.routes.ts` | BEZPIECZNY/PER-USER | DELETE API key przekazuje `userId` do serwisu (`:205-222`) |
| `revenue.routes.ts` | GLOBALNY/PLATFORMOWY | cały router wymaga `requireSuperAdmin` (np. `:31-36`); świadomie zarządza wieloma org |
| `knowledgeBase.routes.ts` | GLOBALNY/PUBLICZNY | brak tenantowej mutacji obiektu przyjmującej id w próbce |
| `scenarios.routes.ts` | NIETRWAŁY | trzy endpointy zwracają wyliczoną atrapę bez SQL (`:13-88`) |
| `baselines.routes.ts` | NIETRWAŁY | kontroler deklaruje minimal implementation, bez zapisu (`BaselinesController.ts:16-79`) |
| `assessmentEvidence.routes.ts` | BEZPIECZNY | kontroler i serwis przekazują org; `AssessmentEvidenceService.ts:58-66,77-105` |
| `core-docs.routes.ts` | GLOBALNY/PLATFORMOWY | router wymaga SuperAdmin + capability `ai_ops` (`:11-15`) |
| `caseWorkspace/intake.routes.ts` | BEZPIECZNY | org pochodzi z aktora `:106-134`; odczyt deleguje `requireCaseAccess` (`:142-154`) |
| `v8/admin/partner-review.routes.ts` | GLOBALNY/PLATFORMOWY | jawny komentarz i `requireSuperAdmin` (`:14-20`) |
| `organization/rbac.routes.ts` | GLOBALNY/PLATFORMOWY | warianty role permissions wymagają SuperAdmin (`:256-317`); tabele nie mają org scope |

Nowych dziur R3 nie naprawiano — poza licencją Dnia 242.

## TWIERDZENIA NIEZWERYFIKOWANE

- Videos DELETE nie ma live-proof ani mutacji RED→GREEN z powodu brakującej tabeli.
- Cztery asercje Permission/Context są zielone, lecz całe uruchomienie nie jest zielone
  z powodu unhandled rejections z rejestracji; dlatego wynik to `PARTIAL`, nie pełne DoD.
- R3 jest przesiewem statycznym; nowe kandydaty nie mają live-proof.

## Korekty wobec instrukcji

1. T5 obalona: po 880 migracjach istnieją `permission_requests` i `ai_contexts`, lecz
   nie istnieje `videos`; komenda autora również nie znalazła definicji w migracjach.
2. Instrukcja zakładała żywego konsumenta Permission Requests; pomiar pokazał komponent,
   który woła atrapę `Api.getPermissionRequests: async () => []`, nie trasę HTTP.
3. Realny register ujawnia zastany runtime-DDL `DATETIME` i brak
   `email_verification_tokens`; to wynik, nie powód do modyfikacji plików bez licencji.
4. `JWT_SECRET=cx242-test-secret-do-not-reuse` z instrukcji jest krótszy niż walidator
   wymaga; Config zgłosił ostrzeżenie. Nie zmieniano Config.

## Commity i artefakty

- `5f3e96c118` Permission Requests
- `0a54e839a2` AI Context
- `7b5788a727` Videos static guard + red schema contract

Artefakty poza repo:

- `day242-mutation-red.json` — SHA256 `585b85ee749345c61be896c30fcaba96e5092b2fdbedf85af8ae4588f56c0fac`
- `day242-fixed-green-assertions.json` — SHA256 `d5e87f41f95e9965ddb506f0e13bbc4c6b859529f6332b729b6fc7b6283b7c5b`
- `day242-context-videos.json` — SHA256 `98c3aa38dee45cba01bf228728e21d9185ea814b208bbea565dc58e819087da9`
- `przed-nazwy.txt` — SHA256 `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`
- `po-nazwy.txt` — SHA256 `0137fe6d173401ef7c82007c9409a06ddb1956827b14da6429acd567b83be8a2`
