# Table Platform — Final Implementation Plan

**Data:** 2026-03-15  
**Cel:** Domknięcie 100% parytetu z Airtable + unikalne przewagi Consultify  
**Koordynator:** AI Agent (nadzór 6 agentów)  
**Szacowany czas:** 3 fazy, ~4-6 godzin pracy agentów

---

## Stan wyjściowy

| Metryka | Wartość |
|---------|---------|
| Backend services | 29 |
| Migracje SQL | 20 (700-719) |
| API routes | 105+ |
| Frontend components | 80 |
| Formuły | 86 |
| Typy pól | 25 |
| Typy widoków | 8 |
| Testy | 246/246 pass |
| Parytet Airtable | ~92% |

---

## Luki do zamknięcia (9 pozycji)

| # | Funkcja | Priorytet | Agent | Faza |
|---|---------|-----------|-------|------|
| 1 | Templates marketplace (katalog gotowych baz) | P1 | Agent 1 | I |
| 2 | View sharing (share link + read-only) | P1 | Agent 1 | I |
| 3 | Google Sheets import | P1 | Agent 2 | I |
| 4 | Created by / Last modified by (display name) | P1 | Agent 2 | I |
| 5 | Automation action types (rozszerzenie) | P1 | Agent 3 | I |
| 6 | View sharing UI (frontend) | P1 | Agent 3 | I |
| 7 | Zapier/Make webhook relay | P2 | Agent 4 | II |
| 8 | Artifact distribution (raport/tabela → email/Slack) | P2 | Agent 5 | II |
| 9 | PWA manifest + offline-first (mobile interim) | P2 | Agent 6 | II |

**Poza zakresem (osobne projekty):**
- Mobile app natywna (React Native) — osobny projekt
- Data residency (multi-region infra) — wymaga zmian Railway/AWS

---

## Faza I — Core Parity (Agent 1-3)

### Agent 1: Templates + View Sharing (backend)

**Task 1.1: Templates Marketplace**

Cel: Użytkownik może wybrać gotowy szablon bazy (CRM, Project Tracker, HR, itp.) i sklonować go jednym kliknięciem.

Backend:
- Migracja `720_templates.sql`:
  ```sql
  CREATE TABLE tp_base_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    thumbnail_url TEXT,
    schema_snapshot JSONB NOT NULL,
    is_featured BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```
- `TemplateService.ts`:
  - `listTemplates(category?)` — lista szablonów
  - `getTemplate(id)` — szczegóły
  - `createFromTemplate(templateId, workspaceId, baseName, userId)` — klonuje bazę z `schema_snapshot` używając istniejącego `MetadataService.duplicateBase` flow
  - `publishAsTemplate(baseId, name, description, category)` — zapisuje snapshot bazy jako szablon
  - `seedDefaultTemplates()` — 6 domyślnych szablonów (CRM, Project Tracker, HR Onboarding, Product Roadmap, Content Calendar, Bug Tracker)
- Routes:
  - `GET /templates` — lista
  - `GET /templates/:id` — szczegóły
  - `POST /templates/:id/use` — klonuj do workspace
  - `POST /bases/:baseId/publish-template` — opublikuj jako szablon

Frontend:
- `TemplateGallery.tsx` — grid kart z kategoriami, wyszukiwaniem, przyciskiem "Use Template"
- Przycisk "New from Template" w toolbarze IdeaTableTool

**Task 1.2: View Sharing (backend)**

Cel: Użytkownik może wygenerować link do widoku read-only (bez logowania).

Backend:
- Migracja `721_view_sharing.sql`:
  ```sql
  ALTER TABLE tp_views ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;
  ALTER TABLE tp_views ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false;
  ALTER TABLE tp_views ADD COLUMN IF NOT EXISTS share_password TEXT;
  ALTER TABLE tp_views ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;
  ```
- W `MetadataService`:
  - `shareView(viewId, options?)` — generuje token, ustawia `is_shared=true`
  - `unshareView(viewId)` — usuwa token
  - `getSharedView(token)` — zwraca view + records (read-only)
- Public routes:
  - `GET /public/views/:token` — zwraca dane widoku
  - `GET /public/views/:token/records` — zwraca rekordy (z paginacją)

---

### Agent 2: Google Sheets Import + Created/Modified By

**Task 2.1: Google Sheets Import**

Cel: Użytkownik podaje URL Google Sheet → system pobiera dane i tworzy tabelę.

Backend:
- W `CsvImportService.ts` dodać `importFromGoogleSheet(sheetUrl, baseId, userId)`:
  - Parsuje URL → wyciąga `spreadsheetId`
  - Pobiera dane przez Google Sheets API v4 (public export as CSV: `https://docs.google.com/spreadsheets/d/{id}/export?format=csv`)
  - Dla arkuszy publicznych: bezpośredni fetch
  - Dla prywatnych: informacja że wymaga OAuth (future)
  - Parsuje CSV → reużywa istniejący `importToNewTable`
- Route: `POST /bases/:baseId/import/google-sheets` — body: `{ url: string, tableName?: string }`

Frontend:
- W toolbarze import: dodać opcję "Google Sheets" obok CSV/XLSX
- Dialog z polem URL + przycisk "Import"

**Task 2.2: Created By / Last Modified By (display name)**

Cel: Rekordy przechowują nie tylko userId ale też display name autora.

Backend:
- W `RecordsService.ts`:
  - Przy `createRecord`: zapisać `__created_by_name` w data JSONB (obok istniejącego `created_by`)
  - Przy `updateRecord`: zapisać `__modified_by_name` w data JSONB
  - Potrzebna helper function `resolveUserName(userId)` — query do tabeli users/profiles
- W `SchemaValidationService.ts`:
  - Dodać `createdBy` i `lastModifiedBy` do allowed field types
  - Są to auto-computed fields (read-only)

Frontend:
- W `PlatformCellRenderer.tsx`: dodać renderery dla `createdBy` i `lastModifiedBy` — avatar + name

---

### Agent 3: Automation Actions + View Sharing UI

**Task 3.1: Rozszerzenie Automation Actions**

Cel: Dodać 8 nowych typów akcji (Airtable ma ~20).

W `AutomationService.ts` rozszerzyć `executeAction`:

| Action Type | Opis | Implementacja |
|-------------|------|---------------|
| `create_record` | Utwórz rekord w dowolnej tabeli | `RecordsService.createRecord` |
| `delete_record` | Usuń rekord | `RecordsService.deleteRecord` |
| `find_records` | Znajdź rekordy wg warunków | `ViewQueryEngine.executeQuery` |
| `send_slack` | Wyślij wiadomość Slack | Webhook do Slack API |
| `send_teams` | Wyślij wiadomość Teams | Webhook do Teams API |
| `run_script` | Uruchom JavaScript snippet | Isolated VM (vm2/isolated-vm) |
| `update_linked_records` | Aktualizuj powiązane rekordy | `RelationService` + `RecordsService` |
| `duplicate_record` | Duplikuj rekord | `RecordsService.createRecord` z kopią data |

Każda akcja:
- Walidacja konfiguracji przy tworzeniu
- Logging do `tp_automation_runs`
- Error handling z retry (max 3)

**Task 3.2: View Sharing UI**

Frontend:
- `ShareViewDialog.tsx`:
  - Przycisk "Share" przy każdym widoku w ViewSwitcher
  - Toggle "Enable sharing"
  - Kopiowanie linku
  - Opcjonalne hasło
  - Data wygaśnięcia
- Integracja z `MetadataService.shareView` API

---

## Faza II — Ecosystem (Agent 4-6)

### Agent 4: Zapier/Make Webhook Relay

Cel: Umożliwić integrację z Zapier/Make bez pełnej rejestracji w marketplace.

Backend:
- `WebhookRelayService.ts`:
  - `createRelay(baseId, eventTypes, targetUrl, secret)` — rejestruje relay
  - `listRelays(baseId)` — lista
  - `deleteRelay(relayId)` — usuń
  - `testRelay(relayId)` — wyślij test event
  - Relay nasłuchuje na EventBus i forwarduje do `targetUrl` z HMAC
- Events do forwardowania: `record.created`, `record.updated`, `record.deleted`, `schema.changed`
- Routes:
  - `POST /bases/:baseId/relays`
  - `GET /bases/:baseId/relays`
  - `DELETE /relays/:relayId`
  - `POST /relays/:relayId/test`

Frontend:
- `WebhookRelayPanel.tsx` — lista relay'ów, tworzenie, testowanie
- Dostępny z ConnectorList lub z ustawień bazy

---

### Agent 5: Artifact Distribution

Cel: Moduł wysyłki raportów/tabel/widoków na email i Slack.

Backend:
- Migracja `722_distribution.sql`:
  ```sql
  CREATE TABLE tp_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('view', 'table', 'chart', 'interface')),
    source_id UUID NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'slack', 'teams', 'webhook')),
    channel_config JSONB NOT NULL,
    schedule TEXT,
    format TEXT DEFAULT 'xlsx' CHECK (format IN ('csv', 'xlsx', 'pdf', 'png')),
    is_active BOOLEAN DEFAULT true,
    last_sent_at TIMESTAMPTZ,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```
- `DistributionService.ts`:
  - `createDistribution(config)` — utwórz
  - `executeDistribution(id)` — pobierz dane źródłowe → eksportuj → wyślij
  - `scheduleDistribution(id, cron)` — harmonogram
  - `listDistributions(baseId)`
  - `deleteDistribution(id)`
  - Kanały:
    - Email: nodemailer z załącznikiem
    - Slack: webhook z plikiem
    - Teams: webhook z linkiem
    - Webhook: POST z danymi
- Routes: CRUD + execute + schedule

Frontend:
- `DistributionBuilder.tsx`:
  - Wybór źródła (widok/tabela/chart)
  - Wybór kanału
  - Konfiguracja odbiorców
  - Harmonogram (CronBuilder reuse)
  - Preview

---

### Agent 6: PWA + Offline-First

Cel: Aplikacja działa jako PWA na mobile z podstawowym offline.

Frontend:
- `public/manifest.json`:
  ```json
  {
    "name": "Consultify",
    "short_name": "Consultify",
    "start_url": "/my-work",
    "display": "standalone",
    "background_color": "#0f172a",
    "theme_color": "#7c3aed",
    "icons": [...]
  }
  ```
- Service Worker (`public/sw.js`):
  - Cache-first dla statycznych assets
  - Network-first dla API calls
  - Offline fallback page
- `useOfflineAware` hook (istniejący) → rozszerzyć:
  - Sync queue z retry po reconnect
  - Indicator "Offline — changes will sync"
- Meta tags w `index.html`:
  ```html
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <link rel="manifest" href="/manifest.json">
  ```
- Responsive fixes:
  - Toolbar collapse na mobile
  - Touch-friendly cell editing
  - Swipe gestures na kanban

---

## Faza III — Stabilization & Verification

Po zakończeniu Faz I-II:

1. **Kompilacja TypeScript** — 0 errors w Table Platform
2. **Testy** — all pass
3. **Migracje** — chain verification (700-722)
4. **Audyt parytetu** — finalna macierz vs Airtable
5. **Aktualizacja dokumentacji** — `TABLE_PLATFORM_STATUS` update

---

## Gate Reviews

| Gate | Warunek | Decyzja |
|------|---------|---------|
| Faza I → II | TS: 0 errors, testy pass, templates + sharing + actions działają | GO/NO-GO |
| Faza II → III | Relay, distribution, PWA działają, testy pass | GO/NO-GO |
| Faza III → DONE | Audyt ≥97% parytetu, 0 critical bugs | RELEASE |

---

## Docelowy parytet po wdrożeniu

| Kategoria | Przed | Po |
|-----------|-------|-----|
| Core CRUD | 100% | 100% |
| Views | 100% | 100% |
| Fields | 92% | 100% |
| Formulas | 100% | 100% |
| Automations | 60% | 90% |
| Integrations | 30% | 70% |
| Collaboration | 80% | 95% |
| Mobile | 0% | 60% (PWA) |
| Ecosystem | 40% | 80% |
| **TOTAL** | **~92%** | **~97%** |

Pozostałe 3% to: natywna mobile app, pełna rejestracja Zapier/Make marketplace, data residency — wymagają osobnych projektów infrastrukturalnych.
