# M20 — Tabele Studio — FAZA 5 (Kanony) + FAZA 6 (Bezpieczeństwo)

Data: 2026-06-11 · Agent: KANON+SEC · Branch: feat/deliverables-light
Zakres: platforma tabel Airtable-like; FE `src/components/{MyWork/table,AIChat/KimiWorkspace}`, BE `server/src/routes/table-platform*.ts` (9 plików, ~6742 linii) + `server/src/services/tablePlatform/*`.

---

## FAZA 5 — KANONY

### 5.1 §27 TABLE_AND_PREVIEW_CANON — per powierzchnia

| Powierzchnia | Typ | Werdykt §27 |
|---|---|---|
| Główny data-grid (`GridView.tsx`, `CellEditor/CellRenderer`) | interaktywny data-grid Airtable-like | **N.D. dla §27 (inny wzorzec)** — to nie list-table-preview; oceniać osobnym standardem grida. Odnotowane: §27 A–S nie aplikuje się (brak Menu 1/2/3, brak preview-pane — grid jest edytowalny in-place). |
| Widoki alternatywne (Kanban/Calendar/Timeline/Matrix/Gallery/StickyNote) | widoki danych | N.D. dla §27 (to nie listy-preview). |
| Lista baz/workspaces | (brak dedykowanej tabeli-listy) | **BRAK powierzchni list-table** — moduł nie eksponuje klasycznej listy baz w formie tabeli §27; wejście do tabel idzie przez Ideas Table `?tpTable=` / artefakt czatu. Nie ma czego audytować pod §27 A–S. |
| Lista automatyzacji / konektorów / formularzy / dystrybucji | panele (`automations/`, `connectors/`, `forms/`, `DistributionBuilder`) | Renderowane jako panele/buildery, nie tabele §27. Poza zakresem §27. |
| PublicViewPage / PublicFormView | publiczny viewer | Poza §27 (read-only public viewer). Stany loading/error obecne (patrz 5.5). |

**Wniosek §27:** moduł NIE ma klasycznych tabel-list podlegających §27 A–S. Główny grid to świadomie inny wzorzec (data-grid). Odnotować w karcie jako „§27 nie aplikuje — wzorzec data-grid, wymaga osobnego standardu grid-canon (nie istnieje)".

### 5.2 Wzorzec shell — MELS Tabele
**ZGODNY.** `src/utils/melsTabeleFlag.ts`: flaga `ff.mels_tabele` **default OFF**, fallback do `KimiWorkspaceShell`; przy ON → `TabeleMelsView` (adapter `ExecutiveModuleShell`). Adapter prezentacyjny — ten sam `useKimiArtifactPipeline`, zero zmian data-path. Resolution order URL>localStorage>env>OFF. `TabeleView.tsx:17` importuje `isMelsTabeleEnabled`. Test routingu: `__tests__/TabeleView.melsRouting.test.tsx`. **Mocny pozytyw.**

### 5.3 UI-standards / kolory
- **322 trafień hardkodów hex** w `src/components/MyWork/table/` + `TabeleView.tsx` (grep `#[0-9a-fA-F]{6}`). Wysoka liczba — wymaga przeglądu pod DBR77 hex-scan (flaga MELS jawnie czeka na „DBR77 hex scan pass" przed ON — `melsTabeleFlag.ts` komentarz). **P3** — odstępstwo od tokenizacji kolorów.
- EntityStatusChip: nie zweryfikowano użycia w gridzie (grid ma własny `CellRenderer`/`ColorPalette`).

### 5.4 i18n PL/EN
- `TabeleView.tsx`: **37× `t()`, 0× `isPolish`** — czysty wzorzec i18next (lepszy niż M19 z 25× isPolish, lepszy niż M18 EN-only). **Pozytyw.**
- `PublicViewPage.tsx`: **1× `t()`** + hardkod `'Failed to load shared view'` (linia 25) i `'mt-2 text-sm'` UI bez tłumaczeń → publiczny viewer w praktyce EN-only / surowe stringi. **P3.**

### 5.5 Stany: empty/loading/error + cicha degradacja przy flagach OFF
- `PublicViewPage.tsx:12-13,29,41` — ma `loading` i `error` (z `.catch` ustawiającym `error`). OK.
- `EmptyStateView.tsx`, `ViewErrorBoundary.tsx` istnieją — empty/error obsłużone w gridzie.
- **CICHA DEGRADACJA — P2:** wiele ścieżek FE łyka błędy bezgłośnie: `TabeleView.tsx:122,171,361` → `.catch(() => null)` / `.catch(() => {})`. BE zwraca `503 SCHEMA_NOT_READY` (`table-platform.routes.ts:84`) i `404 AI_EDITOR_DISABLED` (`ai-editor.routes.ts:78`), ale **grep FE nie znalazł żadnej obsługi `SCHEMA_NOT_READY`/`AI_EDITOR_DISABLED`/`503`** w `src/components/MyWork/table/` ani w `tablePlatform.api.ts`. Przy flagach OFF / migracjach pending user dostaje **niemą pustkę albo zepsuty preview** z generycznym fallbackiem (`tabele.loadPreviewFailed`), nie jawny komunikat „funkcja wyłączona / schema niegotowa". Odstępstwo od wzorca empty/loading/error.

### 5.6 CARD_CONTENT_FORMULA — N.D. (moduł nie produkuje kart insight/inicjatywa).

---

## FAZA 6 — BEZPIECZEŃSTWO

### 6.0 Architektura gatingu (3 warstwy)
- **Nawigacja:** `/tabele` = D1=visible, **NIE beta-gated** (potwierdzone: brak wpisu w `src/utils/betaAccess.ts`). Świadome — nie ma luki „beta-lock tylko nawigacyjny".
- **Route:** `AppRoutes.tsx:1366` — tylko `<ProtectedRoute requireAuth={true}>`. OK (moduł otwarty).
- **API:** `router.use(verifyToken)` na głównym routerze (`table-platform.routes.ts:306`) + KAŻDY sub-router ma własny `router.use(verifyToken)` (ai-editor:57, qa:44, conversion:42, source-pack:49, relations:27, record-sources:32, form-intake:34). **AuthN szczelne wszędzie.** Mount: `Gateway.ts:943-952` — 10 routerów na `/api/table-platform`, brak wspólnego org-middleware na mount (org-scope deleguje się do middleware permissions / handlerów).

### 6.1 ORG-SCOPE / cross-org IDOR — WZORZEC: **CZĘŚCIOWO DZIURAWY (systemowy)**

**WARSTWA BEZPIECZNA (mocny pozytyw):** `PermissionsService.ts` (`requireBaseAccess` 223, `requireTableAccess` 252, `requireRecordAccess` 415, `requireViewAccess` 439, `requireFieldAccess` 391, `requireRoles` 282) — wszystkie czytają `orgId = authReq.organizationId` **z tokena** i porównują do `tp_bases.organization_id` (`canAccessBase` 170-185). Łańcuch resolucji record/view/field/interface/proposal → base → org jest spójny i kompletny (`requireRoles` 292-358). Endpointy keyed `:baseId/:tableId/:recordId/:viewId/:fieldId` z tymi middleware są **szczelne org-scope**. Sub-routery (ai-editor, qa, conversion, source-pack, relations, record-sources, form-intake) dodatkowo **re-resolwują org z tabeli** i odrzucają cross-org (np. `ai-editor.routes.ts:106` `if (org !== organizationId) return null`). **To bardzo dobra warstwa.**

**WARSTWA DZIURAWA — P1 (systemowy cross-org IDOR na zasobach wtórnych):** szereg endpointów keyed po **wtórnym id** (policyId, syncId, modelId, formId, automationId, distributionId, webhookId, templateId, kpiId, relayId, dependency-config) ma `verifyToken` ale **NIE** waliduje, że zasób należy do org wołającego — przekazuje id z URL prosto do serwisu/SQL. Z 66 endpointów keyed-by-id bez inline-guarda, próbka potwierdza brak org-scope w m.in.:

| Endpoint | plik:linia | Ryzyko |
|---|---|---|
| `GET/POST/PATCH/DEL /tables/:tableId/row-policies`, `/row-policies/:policyId` | routes.ts:4407,4434,4447,4464 | odczyt/zapis polityk wierszy obcej org |
| `GET /tables/:tableId/syncs`, `POST /table-syncs/:syncId/execute`, `DEL /table-syncs/:syncId` | 4511,4524,4537 | **exfiltracja danych** — exec syncu na obcej tabeli |
| `GET/POST /tables/:tableId/record-templates`, `PATCH/DEL /record-templates/:templateId` | 4802,4823,4840,4870 | **odczyt rekordów obcej tabeli jako „szablony" + INSERT/UPDATE/DELETE rekordów w obcej tabeli** (4830 `INSERT INTO tp_records`) |
| `GET/PUT /tables/:tableId/dependency-config` | 4885,4902 | odczyt/zapis config `tp_tables` obcej org |
| `GET /forms/:formId/submissions` | 2804 | **wyciek danych zgłoszeń formularzy** obcej org |
| `GET/PATCH/DEL /forms/:formId` | 2761,2773,2791 | odczyt/modyfikacja formularzy obcej org |
| `GET/PATCH/DEL /governed-models/:modelId` (+ kpis/dimensions/sources) | 3187,3201,3216,3230,3270,3297,3318,3345,3366 | odczyt/modyfikacja modeli governance obcej org |
| `*/automations/:automationId/*` (toggle/delete/run-now/trigger/runs) | 2871-2981 | uruchomienie/usunięcie automatyzacji obcej org |
| `*/distributions/:distributionId/*` (execute/toggle/patch/delete) | 4608-4664 | exec dystrybucji obcej org |
| `*/webhooks/:webhookId/*`, `*/relays/:relayId/*` | 4111-4133,4182-4218 | podgląd payloadów / test webhooków obcej org |

Wzorzec identyczny jak systemowy cross-org IDOR z M01/M03/M10/M13/M14 — tu jednak **szerszy** (dziesiątki endpointów). Endpointy bazowe są chronione; dziurawe są „dosadzone później" zasoby wtórne, które autor pominął przy zakładaniu middleware. **Severity P1** (autentykacja jest — potrzebny ważny token dowolnej org + znajomość/zgadnięcie UUID zasobu; UUID nie są enumerowalne, co obniża z P0 do P1).

### 6.2 Cross-module write (governed models) — P1
`POST /governed-models/:modelId/publish-to-results` (3413), `/sync-to-finance` (3440), `/sync-to-execution` (3469) — **zapis do innych modułów (Rezultaty/Finanse/Wdrożenie)** keyed tylko po `:modelId`, bez weryfikacji org. `getModel(modelId)` (3416/3443) nie filtruje po org → użytkownik org B może opublikować/zsync-ować model org A do swojego (lub cudzego) modułu rezultatów/finansów. **P1** — cross-module + cross-org.

### 6.3 PUBLIC SURFACES

**(a) PublicViewPage / `/public/views/:token` + `/records`** — **BEZPIECZNE w zakresie izolacji danych:**
- token = `randomUUID()` (`MetadataService.ts:1276`, 122-bit, nieenumerowalny). Revoke zeruje `share_token` (1295). Expiry sprawdzane (1326).
- `getSharedView` (1305-1351) scoped do `share_token AND is_shared=true`; rekordy przez `ViewQueryEngine.executeQuery({ tableId: viewData.tableId, viewId: viewData.viewId })` (routes.ts:4063) — **tylko tabela/widok udostępniony**, payload NIE jest `{...row}` na ślepo. Brak wycieku spoza widoku/org.
- **P2 — share_password niewymuszane:** `setSharedView` zapisuje `share_password` (1279), ale `getSharedView` (1305-1351) i oba endpointy `/public/views/:token(/records)` (4038,4052) **NIGDY nie sprawdzają hasła** ani nie przyjmują go w zapytaniu. Widoki „chronione hasłem" są w rzeczywistości otwarte dla każdego z linkiem. (Współgra z quick-fix „share password" z commita ee4319b076 dla M01 — ten sam motyw, tu niezałatany.)

**(b) Publiczne formularze:**
- Nowszy router JWT `form-public.routes.ts` — **wzorcowy:** rate-limit (`publicFormLimiter`), `requireIntakeEnabled`, ukrywa tenant/JWT-subject (87-89), `fieldAllowList`, IP-hash, submission routowane przez `verifyJwt`→`form.id` (125-131). Brak wycieku struktury obcej org.
- Starszy slug-router `publicFormRouter` (`routes.ts:3966`): `/public/forms/:slug` zwraca pola tabeli formularza (3978) — ujawnia tylko strukturę WŁASNEGO formularza (slug→form→table). Submission przez `form.id`→tabela formularza (4007) — org-routing intrinsiczny. OK, ale **brak rate-limitu** na starym slug-routerze (nowszy JWT ma) → **P3** (spam/enumeracja slugów; slug nie jest UUID).

### 6.4 AI Editor — budżet tokenów — **EGZEKWOWANY SERWEROWO (pozytyw)**
`ai-editor.routes.ts`: `estimatedTokensInput/Output` z body są **capowane** (`asPositiveInt(...,200_000)` 184-185), a realny budżet rzuca `AiBudgetExhaustedError` z serwisu (`mapServiceError` 132-140 → 429 + Retry-After). Klient nie obchodzi budżetu przez zaniżenie estymaty — rozliczenie po stronie `AiUsageService`. Org re-resolved (`resolveWorkspaceFromTable` 91-108, odrzuca cross-org 106). **Dobrze.**

### 6.5 Governed models org-scope — patrz 6.1/6.2 (dziura). KPI compute `POST /kpis/:kpiId/compute` (3396) też bez org-scope → **P1**.

### 6.6 Sekrety w konektorach / SSO / SCIM / webhooks — **NAJWAŻNIEJSZE**

| Sekret | Magazyn | Stan | Severity |
|---|---|---|---|
| Service-account tokens | `tp_service_accounts.token_hash` | **SHA-256 hash** (ServiceAccountService.ts:5,45) | OK |
| SCIM tokens | `tp_scim_tokens.token_hash` | **hash** (SCIMService.ts:23) | OK |
| **SSO config (SAML cert / OIDC `clientSecret`)** | `tp_sso_configs.config` = `JSON.stringify(config)` | **PLAINTEXT at rest** — `configureSAML/OIDC` (SSOService.ts:47-63) zapisują cały obiekt z `clientSecret`/`certificate` bez szyfrowania; **brak `encrypt/cipher/kms/aes` w całym SSOService** (grep pusty) | **P1** |
| **Webhook `hmac_secret`** | `tp_webhooks.hmac_secret` | **PLAINTEXT** (`randomBytes(32).hex` → INSERT, WebhookDispatcherService.ts:37-42) | **P2** (klucz HMAC, tylko podpis wychodzący) |

Wzorzec plaintext-integracje znany z M25. **SSO clientSecret w plaintext = P1** (kompromitacja DB = przejęcie IdP klienta). `listWebhooks` (53+) słusznie NIE zwraca `hmac_secret` w SELECT — ale at-rest plaintext pozostaje.

### 6.7 Sekrety/PII w logach
`getSharedView` loguje `token` przy błędzie (`MetadataService.ts:1346`) — token udostępnienia w logach błędów. **P3.**

---

## PODSUMOWANIE FINDINGÓW

| # | Severity | Finding | Dowód |
|---|---|---|---|
| 1 | **P1** | Systemowy cross-org IDOR na zasobach wtórnych (row-policies, table-syncs, record-templates, dependency-config, form submissions, automations, distributions, webhooks, governed-models) — `verifyToken` jest, org-scope brak | routes.ts:4407,4511,4802,4885,2804,2871,4608,3187 i in. (~dziesiątki) |
| 2 | **P1** | Cross-module + cross-org write: publish-to-results / sync-to-finance / sync-to-execution keyed po :modelId bez org | routes.ts:3413,3440,3469 |
| 3 | **P1** | SSO clientSecret / SAML cert plaintext at rest (brak szyfrowania) | SSOService.ts:47-63 |
| 4 | **P1** | record-templates POST/PATCH/DELETE = INSERT/UPDATE/DELETE rekordów w dowolnej tabeli (org obcej) | routes.ts:4823,4840,4870 |
| 5 | **P2** | share_password ustawiane ale nigdy nie weryfikowane → „chronione" widoki otwarte | MetadataService.ts:1279 vs 1305-1351; routes.ts:4038,4052 |
| 6 | **P2** | Webhook hmac_secret plaintext at rest | WebhookDispatcherService.ts:37-42 |
| 7 | **P2** | Cicha degradacja FE przy flagach OFF (503 SCHEMA_NOT_READY / 404 AI_EDITOR_DISABLED nieobsłużone) → niema pustka | TabeleView.tsx:122,171,361; brak handlerów w tablePlatform.api.ts |
| 8 | **P3** | Stary slug-router formularzy bez rate-limitu | routes.ts:3966 (vs form-public.routes.ts:79 limiter) |
| 9 | **P3** | 322 hardkody hex w FE (DBR77 hex-scan pending) | grep `src/components/MyWork/table/` |
| 10 | **P3** | PublicViewPage EN-only / surowe stringi (1× t()) | PublicViewPage.tsx:25 |
| 11 | **P3** | Token udostępnienia logowany przy błędzie | MetadataService.ts:1346 |

**POZYTYWY (odnotować wyraźnie):**
- AuthN (`verifyToken`) szczelne na wszystkich 10 routerach.
- Org-scope na endpointach bazowych (base/table/record/view/field) — spójny, kompletny łańcuch w `PermissionsService` (mocny pozytyw).
- Nowsze sub-routery (ai-editor, qa, conversion, source-pack, form-intake JWT) — re-resolucja org + odrzucanie cross-org = wzorzec referencyjny.
- Public view sharing: token UUID nieenumerowalny, scope do udostępnionego widoku, payload nie-`{...row}` — brak leaku danych (poza brakiem hasła).
- AI Editor budżet egzekwowany serwerowo, niemożliwy do obejścia.
- Service-account + SCIM tokeny hashowane (nie plaintext).
- MELS shell zgodny (default OFF, fallback, brak zmian data-path).
- i18n głównego widoku czysty (37× t(), 0× isPolish).
