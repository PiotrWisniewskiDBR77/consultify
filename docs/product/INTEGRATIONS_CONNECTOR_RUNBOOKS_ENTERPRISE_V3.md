# Connector Runbooks (Enterprise, V3) — SSOT
Last update: 2026-02-27  
Owner: CTO/PO (Piotr)  
Status: draft → review  

> Cel: “prawda operacyjna” dla integracji: **jak się łączymy**, **co synchronizujemy**, **jakie są wymagania vendorów**, **jak to zasila Consultify** i **jakie taski wynikają z wdrożenia**.
>
> Zasada enterprise: jeśli źródło jest płatne, wspieramy model **customer brings subscription** (klient loguje się / dostarcza API key / OAuth), a my zapewniamy konektor, audyt, governance i mapping.

---

## 0) Standard runbooka (każdy connector)

Każdy connector ma poniższe sekcje:
- **Purpose**: po co to w Consultify
- **Auth model**: OAuth2 / API key / webhook / MCP
- **Admin setup (external)**: co trzeba zrobić u vendora (app registration / token / consent)
- **Consultify setup (Settings)**: co admin robi w naszej aplikacji
- **Data contract**:
  - *Inbound* (do Consultify)
  - *Outbound* (z Consultify)
  - mapowanie na kanoniczne obiekty: `task`, `initiative`, `artifact`, `notification`, `kpi`, `calendar_event`
- **Limits & reliability**: rate limits, idempotency, retries
- **Security & compliance**: minimal scopes, rotation, audit
- **Verification**: “test connection” + “smoke flows”
- **Implementation checklist**: gotowe taski techniczne (backend+FE+docs+tests)

---

## A) “Reality check” — czy system jest już gotowy end‑to‑end?

Ten dokument jest SSOT, ale **obecny stan repo** ma *równoległe warstwy integracji* i tylko część “konektorów” jest realnie działająca.

### A1) Warstwy integracji w repo (fakty)

W kodzie są dziś **3 równoległe systemy**:

1) **Org-level integrations (kanoniczne pod V3 sync)**  
   - FE: `src/components/settings/IntegrationSettings.tsx`  
   - BE: `server/src/routes/integrations/integrations.routes.ts`, `server/src/routes/integrations/webhooks.routes.ts`  
   - Użycie: Jira push/pull + webhook inbound, Slack/Teams webhook test, logi synchronizacji, publish do chmur przez `cloud` (patrz niżej).

2) **User-level “integrations” (preferences; częściowo stub/mocks)**  
   - BE: `server/src/routes/settings.routes.ts` (klucz `settings:integrations` w `user_preferences`)  
   - Użycie: np. Notion export w `server/src/routes/report-builder.routes.ts` czyta config z user preferences.  
   - To **nie jest enterprise-ready** jako SSOT dla “pełnej synchronizacji org”.

3) **Unified Sync Hub / Guardrails (T086/T008) — osobny model**  
   - FE: `src/components/Admin/UnifiedSyncHub.tsx`  
   - BE: `server/src/routes/syncHub.routes.ts`, `server/src/services/integrationHubService.ts`, `server/src/services/syncGuardrailsService.ts`  
   - DB: `server/migrations/566_sync_hub_guardrails_t086_t008.sql` (Postgres‑specific: `JSONB`, `gen_random_uuid()`, `NOW()`, `DO $$`).  
   - Ten hub ma bogą UX (health, audit, errors), ale **nie jest 1:1 spięty** z kanoniczną ścieżką org-level integracji i nie jest schema‑adaptive jak `/api/integrations`.

**Wniosek krytyczny:** żeby “zorganizować system pracy z synchronizacją wszystkich narzędzi”, SSOT musi wskazać **jedną kanoniczną warstwę** i deprecjonować pozostałe (albo doprowadzić je do konsolidacji).

### A2) Co realnie działa dziś (end‑to‑end)

“Ready today” = jest endpoint + FE path + minimalny test flow.

- **MCP providers registry (org-level)**: działa (CRUD + test + tools cache + allowlist + audit).
  - FE: `Settings → Integrations → MCP tab`
  - BE: `/api/mcp/providers/*`
- **Jira (org-level) — outbound push + inbound webhook status**: działa w trybie API token/basic auth (nie OAuth 3LO).
  - BE: `/api/integrations/:id/sync` + `/api/webhooks/jira/:integrationId`
- **Slack/Teams (org-level) — webhook outbound**: działa jako “send test message”; routing per‑project zależy od konfiguracji.
  - BE: `/api/integrations/test/:provider`
- **Cloud publish (Drive/OneDrive) — upload bytes + link**: działa na bazie tokenów zapisanych w cloud source.
  - BE: `/api/cloud/sources/:id/upload`, `/api/report-builder/:id/publish/cloud/:cloudSourceId`
- **Calendar (ICS feed)**: działa jako feed `/api/integrations/calendar/ics` (bez OAuth).

### A2.1 Macierz gotowości (SSOT ↔ produkt)

| Connector | Poziom | FE surface | BE surface | Status E2E | Uwagi krytyczne |
|---|---|---|---|---|---|
| MCP providers | org | Settings → Integrations → MCP | `/api/mcp/*` | ✅ ready | CRUD+test+allowlist+tools cache+audit działa |
| Jira tasks sync | org | Settings → Integrations | `/api/integrations/*` + `/api/webhooks/jira/:integrationId` | ✅ partial | działa sync + webhook status; brak OAuth 3LO |
| Slack/Teams webhook | org | Settings → Integrations | `/api/integrations/test/:provider` | ✅ partial | test message działa; brak pełnego routing/actions |
| Cloud publish (Drive/OneDrive) | org | (brak dedykowanego UI; użycie przez report publish) | `/api/cloud/*` + `/api/report-builder/*` | ✅ partial | upload działa, ale brak OAuth connect (tokeny trzeba dostarczyć ręcznie) |
| Calendar | org | (status list + ICS URL) | `/api/integrations/calendar/*` | ✅ MVP | tylko ICS; brak OAuth push events |
| Unified Sync Hub | org | Admin → UnifiedSyncHub | `/api/sync-hub/*` | ⚠️ env-dependent | wymaga migracji Postgres 566; nie jest kanoniczny z `/api/integrations` |
| User integrations (prefs) | user | IntegrationsMarketplace (mock) | `/api/settings/integrations/*` | ⚠️ non-enterprise | to jest preferences store, nie sync engine |

### A3) Co NIE jest gotowe (wymaga implementacji, mimo że jest w SSOT)

- **OAuth flows**: Microsoft 365 / Google Workspace / Jira 3LO / Slack App OAuth — w SSOT opisane koncepcyjnie, ale **brak end‑to‑end auth** (connect → callback → refresh → reauth).
- **Asana/Monday/ClickUp/Azure DevOps**: w SSOT są “cards”, ale **brak realnych konektorów** w warstwie org-level.
- **Research/Knowledge/Competitive intel**: opisane jako źródła, ale **brak adapterów + UI + evidence pipeline**.
- **Superadmin global catalog**: brak jednego miejsca, gdzie superadmin zarządza “catalog of providers” (np. seed/CRUD `integration_providers` + governance: enterprise only, beta, docs link).

---

## B) Role i poziomy konfiguracji (superadmin vs org admin vs user)

### B1) Superadmin (platform-level)
Docelowo (enterprise SSOT):
- Zarządza **katalogiem providerów** (global): `integration_providers` / MCP discovery defaults.
- Wymusza polityki: allowed providers, minimal scopes, compliance, tenant isolation, audit retention.

**Stan dziś (repo):**
- Superadmin API (`/api/superadmin`) nie obejmuje integracji (brak runbooka superadmin dla konektorów).

### B2) Org admin (customer admin)
To jest poziom “pełnej synchronizacji”:
- Connect/disconnect integracje org-level (Slack, Jira, Drive, OneDrive, MCP providers)
- Ustawia mapping: project ↔ channel / project ↔ folder / task↔issue rules
- Uruchamia “test connection”, “sync now”, przegląda logi

**Stan dziś (repo):**
- Jest UI `Settings → Integrations` i endpointy `/api/integrations/*` oraz `/api/mcp/*`.

### B3) User (personal)
- Preferencje (np. digest), prywatne kanały, własne workspace’y.

**Stan dziś (repo):**
- Część integracji jest trzymana jako `user_preferences` (`settings.routes.ts`). To wymaga konsolidacji z org-level, jeśli ma być enterprise SSOT.

---

## C) Przełączniki (toggles) i grafika/ikony — jak ma wyglądać “na pierwszy rzut oka”

### C1) Minimalny zestaw przełączników (per connector)

Każdy connector w UI powinien mieć jawnie:
- **Connection**: `Disconnected | Connected | Requires reauth | Error`
- **Enabled**: `On/Off` (czy connector generuje akcje/outbound)
- **Scope pack**: “Mail / Calendar / Files / PM tasks / Webhooks / MCP tools” (checkboxy lub tags)
- **Sync mode**: `Manual | Scheduled` + “Sync now”
- **Direction**: `Pull | Push | Bi-directional` (jeśli wspierane)
- **Project mappings**: sekcja “Mappings” (np. project→channel, project→folder)
- **Test**: “Test connection” (zawsze) + “Send test message” dla komunikatorów

### C2) Jakie grafiki są potrzebne

Minimalny “system ikon”:
- **Provider icon**: 1 ikona per vendor (monochrome SVG lub spójna ikona Lucide).
- **Category icon**: Communication/PM/Storage/Calendar/Knowledge/Research/MCP.
- **Status icon**: Connected/Degraded/Error/Pending/Reauth.
- **Action icons**: Connect/Disconnect/Test/Sync/Logs/Settings.

Stan dziś (repo):
- `IntegrationSettings.tsx` ma mapowanie ikon providerów w `PROVIDER_ICON` (Lucide).
- `UnifiedSyncHub.tsx` używa emoji jako ikony kategorii (niekanoniczne UX).
- `IntegrationsMarketplace.tsx` jest mock‑style (emoji + statyczna lista) i nie powinna być SSOT dla enterprise sync.

---

## D) Status weryfikacji (“pewne vs założenie”) + źródła

W tym SSOT rozróżniamy:
- **VERIFIED**: zapis oparty o official docs (link) — auth/scopes/endpoints.
- **PARTIAL**: zweryfikowane auth/scopes, ale mapping/flow w Consultify jeszcze projektowy.
- **ASSUMED**: placeholder (do uzupełnienia przed implementacją).

**Źródła (official docs) użyte do VERIFIED/PARTIAL**:
- Microsoft Graph permissions: [Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference)
- Google Workspace scopes: [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth)
- Jira Cloud OAuth 3LO: [OAuth 2.0 (3LO) apps](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps)
- Slack OAuth scopes + webhooks: [Slack scopes](https://api.slack.com/scopes), [Incoming webhooks](https://api.slack.com/messaging/webhooks)
- SEC EDGAR APIs: [EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- OpenAlex works: [OpenAlex Works](https://docs.openalex.org/api-entities/works)
- Crossref REST: [Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)

Uwaga: pozostałe vendor’y w tym dokumencie są dziś **PARTIAL/ASSUMED** (na poziomie “da się przez API/OAuth/webhook”), ale bez endpoint-level spec.

---

## E) GAP register (SSOT target vs. obecne wdrożenie) — co trzeba wyewoluować

Poniżej jest lista gapów, które blokują “system pracy z synchronizacją wszystkich narzędzi” w trybie enterprise.

### E1) P0 (blokujące)

| Gap | Dlaczego blokuje | Co trzeba dowieźć | Gdzie (repo / SSOT) | Powiązany task |
|---|---|---|---|---|
| 1. Brak jednej kanonicznej warstwy integracji | równoległe `/api/integrations` vs `/api/settings/integrations` vs `/api/sync-hub` powodują sprzeczne “źródło prawdy” | konsolidacja + deprecacje + spójne UI | sekcja A/B/C + FE surfaces | `V3-M13` |
| 2. Brak pełnych OAuth flows (M365/Google/Jira/Slack App) | bez connect→callback→refresh nie ma “enterprise onboarding” | pełny OAuth engine + token refresh + reauth | runbooki 1/2/5/3 | `V3-M01..M05` (rozszerzyć) |
| 3. Brak superadmin “catalog/policies” dla providerów | nie da się centralnie zarządzać: enterprise-only, beta, docs links, allow/deny | panel + API do zarządzania `integration_providers` + polityki | SSOT B1 + `/api/superadmin` | (nowy) do dopisania do backlogu obok `V3-M13` |
| 4. Toggle spec nie jest jeszcze wdrożony spójnie | użytkownik nie widzi na pierwszy rzut oka: co jest czym i co robi | jednolite przełączniki + statusy + log links | SSOT C + Settings UI | `V3-M13` + `V3-M01` |

### E2) P1 (krytyczne, ale po konsolidacji)

| Gap | Co brakuje | Co trzeba dowieźć | Powiązany task |
|---|---|---|---|
| 5. PMO poza Jira (Asana/Monday/ADO/ClickUp) | brak realnych org-level konektorów i webhook receiverów | adaptery + mapping + retry + sync logs | `V3-M03` (rozszerzyć) |
| 6. Calendar push (Google/Outlook) | jest tylko ICS feed | push events + update rules + idempotency | `V3-M05` |
| 7. Storage connect przez OAuth | upload działa tylko gdy tokeny są już w `cloud_sources` | “Connect Drive/OneDrive” w Settings + token lifecycle | `V3-M04` (rozszerzyć) |
| 8. Research backbone (EDGAR/GDELT/registries/patents) | brak adapterów + evidence/citation pipeline | ingestion + citations + storage + UI refresh | `V3-M10` |

### E3) P2 (coverage/enterprise add-ons)

| Gap | Co brakuje | Powiązany task |
|---|---|---|
| 9. Knowledge sources (OpenAlex/Crossref/…) | unified search adapters + dedup + licensing notes | `V3-M11` |
| 10. Paid competitive intel (Similarweb/Semrush/…) | BYOS creds model + health + evidence timeseries | `V3-M12` |
| 11. Endpoint-level spec dla wszystkich vendorów | SSOT ma “cards”, ale bez szczegółów endpointów/limits | (praca dokumentacyjna przed implementacją) |

### E4) Co jest “perfekcyjnie kompletne” vs “kompletne koncepcyjnie”

- **Kompletne i potwierdzone w repo (VERIFIED/ready today)**:
  - MCP providers registry (org-level) + allowlist + audit
  - Jira sync (partial: token/basic auth) + inbound webhook status mapping
  - Cloud publish endpoints + report publish-to-cloud
  - Calendar ICS feed (MVP)
- **Kompletne koncepcyjnie, ale nie gotowe wdrożeniowo (PARTIAL/ASSUMED)**:
  - pełne OAuth runbooki (wymagają implementacji w produkcie)
  - reszta konektorów (PMO, research, knowledge, competitive)

---

## 1) Microsoft 365 (Outlook / Teams / SharePoint / OneDrive) — Microsoft Graph

### Purpose
Enterprise “super-connector” dla:
- Email digests + share links
- Calendar sync (due dates, gate reviews)
- Publishing exports (OneDrive/SharePoint)
- (P1/P2) Teams interactions / approvals

### Auth model
- **OAuth2** + Microsoft Entra ID (Azure AD)
- Preferowane: **delegated** (user-based) + ewentualnie app-only tam gdzie konieczne (enterprise)
- API: **Microsoft Graph**

### Admin setup (external — Entra ID)
1) Create **App Registration**
2) Configure Redirect URI (Consultify OAuth callback)
3) Configure permissions (minimal scopes; dobierane per capability):
   - Mail outbound: `Mail.Send`
   - Mail ingest (optional): `Mail.Read` lub `Mail.ReadWrite`
   - Calendar sync: `Calendars.ReadWrite`
   - Files: `Files.ReadWrite.All`
   - SharePoint sites: `Sites.ReadWrite.All`
   - Basic identity: `openid`, `profile`, `email`, `offline_access`
4) Admin consent (jeśli wymagany)
5) Optional hardening: Application Access Policies (limit mailbox scope), Conditional Access

### Consultify setup (Settings)
- Settings → Integrations → “Microsoft 365 / Outlook” → **Connect (OAuth)**  
- Test: wysyłka test mail / utworzenie test event / upload test file (w zależności od wybranej capability)
- Konfiguracje per org:
  - docelowy site/folder dla eksportów
  - mapping project → Teams channel/webhook (jeśli używamy webhooków)

### Data contract
- **Outbound**
  - `notification` → Teams/Email
  - `artifact` (pdf/pptx/docx) → upload + share link → zapis w attachments
  - `calendar_event` → create/update event
- **Inbound**
  - Jira/Ado-like: (P2) incoming emails → evidence
  - (P1/P2) Teams actions → approvals/ack

### Limits & reliability
- Rate limits: Graph ma limity per app/tenant; stosujemy backoff + retry.
- Idempotency: przy publish exports używamy deterministycznego “path/key” (np. reportId + timestamp).

### Security & compliance
- Minimal scopes per capability, segregacja tokenów (org-level)
- Audit: każda akcja outbound/inbound logowana (sync log + audit trail)

### Verification (smoke)
- Connect → Test mail send
- Create calendar event for task due date
- Publish report PDF → OneDrive/SharePoint → link wraca do attachments

### Implementation checklist (task-ready)
- [ ] M365 OAuth app + callback endpoints + token storage (encrypted)
- [ ] Graph client: mail send + calendar events + file upload + share link
- [ ] Settings UI: connect/test + folder/site picker (enterprise)
- [ ] Audit logs + retry policies

### Verification status
- **PARTIAL**: uprawnienia/scopes oparte o official docs; brak endpoint-level spec i brak działającego OAuth flow w repo.

---

## 2) Google Workspace (Gmail / Drive / Calendar)

### Auth model
- OAuth2 + Google APIs
- Uwaga: część scope’ów jest “sensitive/restricted” → wymaga procesu weryfikacji dla publicznych aplikacji.

### Minimal scopes (docelowo)
- Gmail outbound: `https://www.googleapis.com/auth/gmail.send`
- Calendar events: `https://www.googleapis.com/auth/calendar.events`
- Drive publish: zwykle `https://www.googleapis.com/auth/drive` (restricted) lub warianty bardziej ograniczone (np. drive.file jeśli model pozwala)

### Use-cases
- Publish exports do Drive + share link
- Calendar sync (tasks/gates)
- Email digests

### Implementation checklist
- [ ] OAuth consent + Google API client
- [ ] Drive upload + link share
- [ ] Calendar event create/update
- [ ] Gmail send

### Verification status
- **PARTIAL**: scopes zweryfikowane w official docs; brak implementacji OAuth + Drive/Calendar/Gmail end-to-end.

---

## 3) Slack (Notifications / Routing / Optional actions)

### Auth model
Docelowo 2 tryby (enterprise):
1) **Incoming Webhook** (fast onboarding, per-channel)
2) **Slack App OAuth2** + Web API (bot token) (dla rich capabilities)

### Minimal scopes (Slack App)
- `incoming-webhook` (dla webhook flow)
- `chat:write` (dla Web API message send)
- opcjonalnie: `channels:read`, `groups:read` (listing), `commands`, `interactive_messages` (actions)

### Use-cases
- outbound: gates/risks/tasks/digests
- routing per project: mapping project → channel
- (P1) inbound actions: approve/ack

### Implementation checklist
- [ ] Slack connector: webhook + Web API mode
- [ ] Project→channel mapping UI
- [ ] Delivery logs + retries

### Verification status
- **PARTIAL**: webhook outbound istnieje (test message) w org-level; Slack App OAuth + Web API niezaimplementowane.

---

## 4) Microsoft Teams (Incoming Webhooks + optional Graph)

### Auth model
- Minimal: **Incoming Webhooks** (simple POST)
- Enterprise: Microsoft Graph (richer cards/messages/approvals)

### Implementation checklist
- [ ] Teams webhook mode (already)
- [ ] (P1) Graph-based richer messages/actions

### Verification status
- **PARTIAL**: webhook outbound istnieje (test message) w org-level; Graph (OAuth) niezaimplementowany.

---

## 5) Jira Cloud (PMO sync)

### Auth model
- Preferowane: **OAuth 2.0 (3LO)** (Atlassian)
- Quick-start: API token (enterprise may still allow but less ideal)

### Required steps (Atlassian)
- Register OAuth app in Atlassian developer console
- Obtain cloudId via `accessible-resources`
- Use `api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...`

### Use-cases
- Task↔Issue mapping + status sync
- Inbound webhooks: issue updated → update task status

### Implementation checklist
- [ ] OAuth 3LO flow + token refresh + secure store
- [ ] Issue create/update + mapping table
- [ ] Webhook receiver + signature validation (where supported)
- [ ] Field mapping config per project (status, issueType, labels)

### Verification status
- **PARTIAL**: opis OAuth 3LO i base URL zgodny z official docs; w repo działa sync Jira, ale obecnie w trybie token/basic-auth + minimalny inbound webhook.

---

## 6) Azure DevOps (PMO sync)

### Auth model
- OAuth2 / PAT (enterprise policy dependent)
- Webhooks: Service Hooks subscriptions

### Use-cases
- Work items sync (task↔work item)
- Inbound updates

### Implementation checklist
- [ ] OAuth/PAT config + ADO REST client
- [ ] Service Hooks subscription mgmt + receiver
- [ ] Status mapping per process template

### Verification status
- **ASSUMED**: doc-level placeholder (do uzupełnienia o endpointy/scopes z Microsoft Learn przed implementacją).

---

## 7) Asana / Monday.com / ClickUp (mid-market PM)

### Auth model
- Asana: OAuth2 + webhooks
- Monday: OAuth2 lub personal tokens; webhooks z challenge + JWT verify
- ClickUp: OAuth2 lub personal token; webhooks z HMAC signature

### Use-cases
- MVP task sync (create/update/status)
- Per-project mapping

### Implementation checklist
- [ ] OAuth flow + token storage per org
- [ ] Webhook verification + receiver
- [ ] Task object mapping + status normalization

### Verification status
- **ASSUMED**: doc-level placeholder (do uzupełnienia o endpointy/scopes + handshake webhooków przed implementacją).

---

## 8) Drive/SharePoint-class storage (Dropbox / Box) + infra storage (S3/Blob)

### Dropbox / Box
- OAuth2
- Upload file + create shared link (+ optional password/expiry)

### AWS S3 / Azure Blob
- Presigned URLs / SAS tokens (valet key pattern)
- Signed links + retention policies

### Implementation checklist
- [ ] Upload + share link + evidence attach
- [ ] Signed URL generation + metadata tracking

### Verification status
- **ASSUMED**: doc-level placeholder (koncept zgodny z typowymi API, ale bez endpoint-level spec w tym SSOT).

---

## 9) Notion / Confluence (knowledge/content)

### Notion
- Internal integration (token + manual “share page/database”) or OAuth for public integration
- Use-cases: export reports, query/update DB, research notes

### Confluence
- OAuth 3LO or API tokens (scoped tokens recommended)
- Use-cases: publish “consulting pack” pages, decision logs, KB search

### Implementation checklist
- [ ] OAuth/token config + API client
- [ ] Publish pages from report/deck
- [ ] Search + cite sources

### Verification status
- **ASSUMED/PARTIAL**: Notion/Confluence mają official docs, ale w tym SSOT nie ma jeszcze endpoint-level spec; dodatkowo w repo Notion export korzysta z user preferences (wymaga konsolidacji).

---

## 10) External Information (US/EU research) — enterprise research backbone

### SEC EDGAR (US)
- Public APIs on `data.sec.gov`
- **User-Agent header required** (fair access guidelines)
- Use-cases: filings ingest, XBRL facts, peer comparisons

Checklist:
- [ ] CIK lookup + submissions fetch
- [ ] XBRL company facts ingestion
- [ ] Store citations (url, timestamp, excerpt, hash)

### Verification status
- **PARTIAL**: EDGAR basic endpoints + wymagania fair-access (User-Agent, limity) są w official docs; brak implementacji w repo.

### GDELT (global news/events)
- DOC 2.0 API / GDELT Cloud (API key optional depending on service)
- Use-cases: competitor monitoring, trend/risk signals

Checklist:
- [ ] Query builder (company/topic)
- [ ] Ingest articles (metadata + URL) + summarization + citation

### Company registries (EU/UK)
- OpenCorporates (token; free/paid)
- Companies House (public API + streaming)

Checklist:
- [ ] Entity identity resolution (name → company id)
- [ ] Ownership / filings metadata (where available)

### Patents
- USPTO PatentsView (API key)
- EPO OPS (credentials; free tier + paid)

Checklist:
- [ ] Assignee-based queries (competitor)
- [ ] Trend dashboards (counts by class/year)

### Competitive web signals (paid)
- Similarweb, Semrush, BuiltWith, Wappalyzer

Checklist:
- [ ] Domain benchmarking endpoints
- [ ] Store results as evidence + time series

### Verification status
- **ASSUMED/PARTIAL**: EDGAR jest zweryfikowany; pozostałe (GDELT/registries/patents/competitive intel) są opisane na poziomie koncepcji i wymagają dopięcia official docs + endpoint-level spec przed implementacją.

---

## 11) External Knowledge (books / science)

### Books
- Open Library (public)
- Google Books (API key / OAuth optional)
- ISBNdb (paid)

### Science / expert
- OpenAlex (public)
- Crossref (public)
- Semantic Scholar (API key may be required)
- arXiv (API + OAI-PMH)
- PubMed (NCBI E-utilities; API key recommended)
- DOAJ (API; some keys may be publisher-only)

Checklist:
- [ ] Search + fetch metadata
- [ ] (OA only) ingest full text where legal
- [ ] citation tracking + RAG indexing

### Verification status
- **PARTIAL**: OpenAlex/Crossref mają official docs (linki w sekcji D), ale ten SSOT nie ma jeszcze szczegółowego kontraktu endpointów, limitów, i polityki licencyjnej per źródło.

---

## 12) MCP Providers (internal + external)

### IRIS (Plant Ops)
- Streamable HTTP MCP
- Extra headers: `Authorization: Bearer <MES_API_TOKEN>`, `X-Factory-Id`

### DBR77 Marketplace
- Streamable HTTP MCP
- Auth header: `Authorization: Bearer <marketplace_token>`

Checklist:
- [ ] Provider connect/test + tools cache
- [ ] Allowlist policies (READ-only default)
- [ ] Audit in `mcp_audit_logs`

### Verification status
- **VERIFIED (repo)**: org-level MCP registry + allowlist + tools cache + audit jest zaimplementowane w backendzie i ma UI w Settings.

