# Integracje i synchronizacje (V3) — Plan wdrożenia + ścieżki użycia w aplikacji
Last update: 2026-02-26  
Owner: CTO/PO (Piotr + AI)  
Status: draft → review  

> Cel: domknąć (lub zastąpić) niedokończone integracje z fazy v2 i **dowieźć pełną synchronizację** z kluczowymi środowiskami zewnętrznymi (email/komunikatory/chmury/PM/kalendarze/PMO), a równolegle przygotować **strategię MCP** (rynek + wewnętrzne systemy: **IRIS** + **Marketplace**).

---

## 0) Kontekst i to co już jest w kodzie (fakty)

W repo istnieją dwie warstwy integracji:

- **Integracje „klasyczne” (org-level)**: tabele `integration_providers`, `integrations`, `integration_sync_mappings`, `integration_sync_log` (migracja `server/migrations/256_integrations_system.sql`) + serwis `server/src/services/integrationService.ts` + route’y `server/src/routes/integrations/integrations.routes.ts`.  
  To jest właściwa baza pod „pełną synchronizację” (webhooks, mappingi, retry, logi).

- **Integracje „user-level” (notifications/integrations)**: `user_integrations` + `user_integration_sync_logs` (migracja `server/migrations/105_user_integrations.sql`) + FE hook `src/hooks/useUserIntegrations.ts`.  
  Ta ścieżka jest dobra do per‑user autoryzacji (np. prywatny kalendarz, DM w Slack), ale w repo są markery „unavailable” dla Jira/ClickUp user integration (`server/src/services/integrations/*UserIntegration.ts`).

- **MCP (Model Context Protocol)**:
  - istnieje `/api/mcp/providers` oraz `/api/mcp/context` (`server/src/routes/mcp.routes.ts`) sugerujące org-level listę providerów MCP (`mcp_providers`),
  - istnieją 2 implementacje MCP w kodzie:
    - „user-scoped MCP server” (`server/src/mcp/mcpServer.ts`) — narzędzia typu `consultinity.tasks.*`, `consultinity.notifications.*`,
    - „central tool registry” (`server/src/services/ai/mcpServer.ts`) — schematy tool calling dla AI w aplikacji.

**Wniosek**: fundamenty są, ale trzeba je ujednolicić i „dowieźć końcówki” (realne konektory + spójne UI + realny sync engine).

---

## 1) Zasady projektowe (MUST)

- **Jedna platforma integracji**: integracje nie mogą żyć jako 3 równoległe systemy. V3 kończy na modelu:
  - **Org integrations** (system-of-record dla synchronizacji artefaktów i danych firmy),
  - **User integrations** (opcjonalnie, do per‑user kanałów: kalendarz, DM, osobiste workspace’y),
  - **MCP providers** (katalog zewnętrznych MCP serwerów + 2 wewnętrzne: IRIS i Marketplace).

- **Idempotencja i audyt**: każda operacja sync ma `sync_log` + mappingi; akcje outbound muszą być bezpieczne na retry.

- **Konflikty są jawne**: jeśli zmiana przyjdzie z zewnątrz i wewnątrz — stan `conflict` + UI do rozstrzygnięcia.

- **Bezpieczeństwo**:
  - tokeny szyfrowane w app layer, rotacja/refresh, minimal scopes,
  - rozdzielenie uprawnień: admin org konfiguruje integracje org-level; user konfiguruje user-level,
  - ścisły audyt: kto/ kiedy / co wysłał / co pobrał (logi, korelacja z obiektami).

---

## 2) Zakres „pełnej synchronizacji” — co synchronizujemy (obiekty)

### 2.1 Kanoniczne obiekty w Consultify (lokalne typy)

- `project`
- `initiative`
- `task` (w tym: action items / execution tasks)
- `decision` (np. Deep Thinking / governance)
- `notification` (event → kanał)
- `artifact`:
  - `report` (Report Builder / eksport PDF)
  - `deck` (Presentation Generator / PPTX)
  - `attachments` (pliki, linki, evidence)
- `kpi` / `kpi_value` (Results module)
- `calendar_event` (spotkania, terminy gate’ów, review KPI)

### 2.2 Mapowania na zewnątrz (external typy)

- PM tools: `issue`, `task`, `card`, `epic`, `milestone`
- Calendar: `event`
- Communication: `message`, `thread`, `channel`
- Storage: `file`, `folder`, `permission_link`
- Email: `email` (outbound), opcjonalnie `email_thread` (inbound — zwykle P2)
- PMO/ITSM: `ticket`, `change_request`, `work_item`
- BI/ERP/Plant ops: `metric`, `timeseries`, `asset`, `workorder` (dla IRIS)

---

## 3) Konektory v3 — lista integracji (P0/P1/P2)

> P0 = wymagane w tej fazie, P1 = rozszerzenie tej fazy, P2 = „market coverage” (przez Zapier/Make i/lub MCP).

### 3.1 Email (wysyłka)

- **P0**: SMTP (już jest wzmiankowane w architekturze) + szablony transakcyjne (powiadomienia/raporty).  
- **P1**: Microsoft 365 (Graph / Outlook) dla organizacji enterprise.
- **P1**: Gmail/Google Workspace (jeśli ma sens dla klientów).

Sync scope:
- outbound: wysyłka powiadomień, digestów, linków do raportów/decków.

### 3.2 Komunikacja / wiadomości

- **P0**: Slack (workspace + kanały per projekt; DM dla decyzji/mention).
- **P0**: Microsoft Teams (kanały + adaptive cards).
- **P1**: WhatsApp Business (tylko outbound alerting; zwykle enterprise ogranicza użycie).

Sync scope:
- outbound: `notification`, `decision_required`, `gate_pending`, `task_due`, `risk_alert`.
- inbound (P1): komendy / action callbacks (np. „Approve gate”, „Acknowledge risk”).

### 3.3 Chmury danych / pliki

- **P0**: Google Drive (folder per projekt, export report/deck, link back do Consultify).
- **P0**: OneDrive/SharePoint (analogicznie).
- **P1**: S3 / Azure Blob jako „enterprise storage backend” dla artefaktów.

Sync scope:
- outbound: publikacja `artifact` (pdf/pptx) + evidence attachments.
- inbound (P2): import plików jako attachments do initiative/interview (opcjonalne).

### 3.4 Zarządzanie projektami / zadaniami / PMO

- **P0**: Jira (bi‑directional task sync + status mapping + linkowanie issue↔initiative/task).
- **P0**: Asana / Monday (co najmniej 1 z nich jako alternatywa poza Jira).
- **P1**: ClickUp (częsty w consulting/SMB).
- **P1**: Azure DevOps (dla klientów industrial/enterprise).
- **P2**: ServiceNow / Planview / MS Project / Primavera (PMO heavy) — przez MCP/Zapier/Make lub dedykowany konektor, zależnie od klienta.

Sync scope:
- bi-directional: `task` (priority, due date, status, assignee) + komentarze (P1).
- outbound: `initiative` → epic/feature (P1) + traceability link.

### 3.5 Kalendarze

- **P0**: Google Calendar + Outlook Calendar — minimum: due dates i spotkania review/gates.
- **P1**: dwukierunkowa synchronizacja eventów (zmiana daty w kalendarzu aktualizuje termin w Consultify).

### 3.6 Automatyzacje (catch‑all)

- **P0**: Webhooks + API keys (już przewidziane w migracji 256).
- **P1**: Zapier + Make (kluczowe dla „długiego ogona” SaaS).

---

## 4) MCP — rynek (co podłączyć) i jak to wpinamy w V3

### 4.1 Źródła discovery

- **MCP Registry (oficjalny)**: `modelcontextprotocol.io/registry/about` + API registry.  
- **Katalogi społecznościowe**: np. `mcpserverdirectory.org`, `findmymcp.com`.  

### 4.2 Krótka lista MCP providerów „worth it” (2026)

**P0 (największa dźwignia w consultingu):**
- GitHub (issues/PR/search), Slack, Google Drive.
- Microsoft Graph MCP Server for Enterprise (delegated scopes: M365/Outlook/SharePoint/Teams) — dla klientów enterprise.

**P1 (PMO / knowledge):**
- Jira / Confluence (jeśli dostępne jako MCP lub przez gateway/partner).
- Notion (często jako MCP lub klasyczne API; u nas istnieje też eksport API w `integrationHubService`).
- Linear, GitLab.

**P2 (enterprise ops / data):**
- ServiceNow, Salesforce, HubSpot, Zendesk.
- PostgreSQL/Snowflake/BigQuery (read-only „grounding” + analizy).

### 4.3 Jak MCP ma działać w Consultify (kontrakt)

- **MCP jako „provider”** w systemie (org-level):
  - `name`, `type`, `status`, `config` (URL serwera, auth, namespace, allowlist narzędzi),
  - test połączenia + health,
  - audyt wywołań (już jest `mcp_audit_logs`).

- **Polityki**:
  - allowlist narzędzi (np. tylko READ do czasu włączenia MUTATION),
  - limity (rate/tokens/cost),
  - mapowanie „które moduły mogą wołać które narzędzia”.

---

## 5) Integracje wewnętrzne: MCP‑IRIS + MCP‑Marketplace (DBR77)

### 5.1 MCP‑IRIS (Plant Operation System)

**Cel**: automatyczne zasilanie Results/KPI, evidence, oraz inicjatyw/akcji danymi z operacji (plant ops).

#### 5.1.1 Referencyjny schemat komunikacji (zgodny z `newapp`)

To jest **kanoniczny** wzorzec, który przyjmujemy jako „docelowy kontrakt” dla MCP‑IRIS:

Klient MCP (agent/LLM)
→ **MCP Streamable HTTP** (domyślnie)
→ endpoint `MCP_PATH=/mcp` (port 3100; za Traefik także pod `/mcp`)
→ `mcp-server` (FastMCP)
→ wywołanie konkretnego toola (`@mcp.tool()`)
→ `MesApiClient` (httpx `AsyncClient`)
→ HTTP do MES API (`MES_BASE_URL`) z nagłówkami:
- `Authorization: Bearer <MES_API_TOKEN>`
- `X-Factory-Id: <factory_id>` (opcjonalnie; domyślnie `MES_FACTORY_ID` lub per-request)
→ JSON odpowiedź / błąd
→ mapowanie błędów MES (4xx/5xx) → `MesApiError` → błąd toola (dla klienta MCP).

**Implikacje dla Consultify (MUST w v3):**
- **Transport**: traktujemy MCP‑IRIS jako **zewnętrzny MCP server** (Streamable HTTP) konfigurowany jako provider.
- **Konfiguracja per org**: `mes_base_url`, `mes_api_token` (sekret), `factory_mode` (`default` / `per_request`) + allowlist tooli.
- **Kontekst fabryki**:
  - dla KPI/Results: zwykle `default factory`,
  - dla Initiatives/Execution: możliwe `per_request factory_id` (np. initiative przypięta do plant/site).
- **Obsługa błędów**: 4xx/5xx MUSZĄ być mapowane na spójny error kontrakt w Consultify (status + reason + retriable).

#### 5.1.2 Zakres tooli MCP‑IRIS (stan docelowy z `newapp`)

W `newapp` jest **35 narzędzi w 6 grupach**:
- `production_orders`
- `master_data`
- `operator`
- `process_definitions`
- `traceability`
- `health`

**Mapowanie na moduły Consultify (gdzie realnie to wykorzystujemy):**
- **Results (KPI/ROI)**: `master_data`, `traceability` (metryki + time-series), `health` (jakość źródła, dostępność).
- **Execution**: `production_orders` (workorders/zlecenia), `operator` (przypisania/ack), `health`.
- **Initiatives (Evidence/Traceability)**: `traceability` (dowody: batch/serial, zdarzenia), `process_definitions` (standardy procesu jako „źródło”).
- **Governance**: `health` (alerty danych/operacji jako risk signals).

Proponowany zestaw MCP tools/resources:
- Tools (READ):
  - `iris.assets.search`
  - `iris.workorders.list`
  - `iris.kpi.timeseries.get`
  - `iris.events.list` (awarie, przestoje, incydenty)
- Tools (MUTATION, etapowo):
  - `iris.workorders.create` (tylko po akceptacji usera)
  - `iris.workorders.update_status`
- Resources:
  - `iris://site/{id}/overview`
  - `iris://asset/{id}/history`

**Ścieżki użycia w aplikacji**:
- `Results` → KPI → „Źródło danych: CONNECTOR/MCP‑IRIS” (w v3: przynajmniej „Coming soon” + konfiguracja).
- `Initiative` → Evidence/Attachments → „Import evidence from IRIS”.
- `Execution` → Task → „Link to IRIS workorder / create workorder”.

### 5.2 MCP‑Marketplace (DBR77)

**Cel**: pobieranie i publikowanie zasobów „marketplace” (template’y, playbooki, prompty, narzędzia, komponenty PMO).

Proponowany zestaw MCP tools/resources:
- Tools (READ):
  - `marketplace.catalog.search`
  - `marketplace.asset.get`
  - `marketplace.recommendations.get` (np. „templates for this initiative type”)
- Tools (MUTATION):
  - `marketplace.asset.publish` (dla wewnętrznych zespołów DBR77)
  - `marketplace.order.create` / `license.assign` (jeśli marketplace ma transakcje)
- Resources:
  - `marketplace://asset/{id}`
  - `marketplace://collection/{id}`

**Ścieżki użycia w aplikacji**:
- `Tools` → „Get template from Marketplace” (wpięte w Tool Library / Known Tools).
- `Presentations` → „Visuals/Assets from Marketplace”.
- `MyWork` → Ideas/Artifacts → „Publish as template”.

---

## 6) Ścieżki w aplikacji (UI) — gdzie integracje są konsumowane

### 6.1 Settings (konfiguracja)

- **Settings → Integrations** (`src/views/settings/IntegrationsModule.tsx`)
  - Apps (org-level): Slack/Teams/Jira/Drive/OneDrive/S3/…  
  - API Keys (Zapier/Make/partner API)
  - Webhooks (inbound/outbound)
  - Calendar sync (Google/Outlook)

- **Settings → User Integrations** (per-user)
  - prywatny kalendarz, DM w Slack/Teams, osobiste workspace’y.

- **SuperAdmin/Enterprise**: health dashboards, audit, allowlist, limity.

### 6.2 MyWork (operacyjne użycie)

- Inbox/Notifications → routing zdarzeń na kanały: in-app, email, Slack, Teams.
- Decisions → „Export decision” (Notion/Confluence/Slack już ma ślady w `integrationHubService`).

### 6.3 Initiatives / Execution / Governance

- Initiative → automatyczne tworzenie/aktualizacja zadań w Jira/Asana/Monday.
- Execution → dwukierunkowa synchronizacja statusów i due dates.
- Governance/Gates → „decision required” push do Slack/Teams + opcjonalny approve callback.

### 6.4 Presentations / Reports

- Export PDF/PPTX → publikacja do Drive/SharePoint/S3 + zapis linku jako attachment/evidence.
- „Share” → generuje link (zewnętrzny) + opcjonalnie wysyłka mail/slack.

### 6.5 Results (KPI/ROI)

- KPI source: manual (R0) + connector (P1) + MCP‑IRIS (włączane etapowo).
- Cyclic KPI report → wysyłka do email/slack/teams + zapis do Drive/SharePoint.

---

## 7) Plan wdrożenia (deliverables, kolejność)

### 7.1 Sprint A — Ujednolicenie fundamentu (1–3 dni)

- Spiąć jeden „Integration Registry”:
  - org integrations: CRUD + provider list z DB (`integration_providers`)
  - user integrations: tylko tam gdzie to konieczne (kalendarz/DM)
  - MCP providers: CRUD + test + audit
- Wyrównać UI `Settings → Integrations` tak, żeby nie było „mocków” (lista z backendu, statusy realne).

### 7.2 Sprint B — P0 konektory (1–2 tyg.)

- Slack: kanały per projekt + outbound powiadomienia (min 5 eventów) + mapping project↔channel.
- Teams: analogicznie (webhook/adaptive cards).
- Jira: task sync (create/update/status mapping) + webhook inbound.
- Drive/OneDrive: export report/deck do folderu projektu + link back.
- Google/Outlook calendar: push eventów (due dates, gate reviews).
- Email: SMTP + digesty + wysyłka linków do artefaktów.

### 7.3 Sprint C — MCP market + IRIS/Marketplace (1–2 tyg. „podłączenie”, potem iteracje)

- MCP provider catalog (z registry): discovery + konfiguracja + allowlist.
- MCP‑IRIS: READ‑only tools do KPI (time‑series) + proof-of-value w Results.
- MCP‑Marketplace: READ‑only katalog assetów + import do Tools/Presentations.

### 7.4 Sprint D — P1/P2 + hardening (ciągłe)

- Konflikty, retry, rate limits, observability dashboards.
- Zapier/Make: stabilne API keys + event catalogue (triggers/actions).
- Dodatkowe PMO: Azure DevOps / ServiceNow / Confluence / Notion (MCP lub API).

---

## 8) Kryteria „pełnej synchronizacji” (DoD)

- Dla każdej integracji P0:
  - connect/disconnect + test + health,
  - minimum 1 scenariusz inbound + 2 outbound (jeśli dotyczy),
  - mappingi w `integration_sync_mappings`,
  - logi w `integration_sync_log`,
  - UI: statusy, ostatni sync, ostatni błąd, retry.

- Dla MCP‑IRIS i MCP‑Marketplace:
  - provider jest konfigurowalny,
  - co najmniej 3 narzędzia READ działają end‑to‑end,
  - audyt w `mcp_audit_logs`,
  - jedno realne użycie w UI (Results dla IRIS, Tools/Presentations dla Marketplace).

