# Table Platform — Status Rozwoju

**Data:** 2026-03-15  
**Branch:** `feat/v3-mywork-ai-templates-assets`  
**Testy:** 321/321 pass (27 test files, 0 regresji)

---

## 1. Podsumowanie

Consultify Table Platform to moduł Airtable-like + Power BI-like zbudowany jako metadata-first platforma tabel. Umożliwia tworzenie, edycję i analizę danych tabelarycznych z poziomu czatu (NL), toolbara i API.

**Kluczowa zmiana (2026-03-15):** Wszystkie wcześniej zbudowane komponenty zostały podłączone do UI. Czat główny (`UnifiedChatPanel`) rozpoznaje intencje tabelowe i tworzy tabele. `ChatToSchemaPanel` dostępny z toolbara. Widok Chart dodany do ViewRouter.

---

## 2. Architektura

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND                              │
│                                                          │
│  UnifiedChatPanel ──→ tableIntentDetector                │
│       │                    │                             │
│       ▼                    ▼                             │
│  ChatTableProposalCard   generateSchemaProposal()        │
│                                                          │
│  IdeaTableTool                                           │
│   ├── ChatToSchemaPanel (AI Schema button + Ctrl+Shift+S)│
│   ├── AITableAssistant (legacy + new backend)            │
│   ├── ViewRouter (grid/kanban/calendar/chart/gantt/...)  │
│   ├── PresenceIndicators (realtime avatars)              │
│   ├── InterfaceDesigner (drag-drop page builder)         │
│   ├── ConnectorWizard + ConnectorList                    │
│   ├── FilterBuilder (40 operators)                       │
│   ├── AuditTrailPanel + ActivityFeed + SnapshotManager   │
│   └── FormBuilder + PublicFormView                       │
│                                                          │
│  Hooks: useTablePlatformBridge, useTableRealtime,        │
│         useSchemaProposal, useConnectors, useOfflineAware│
└──────────────────────┬──────────────────────────────────┘
                       │ REST API + Socket.IO
┌──────────────────────▼──────────────────────────────────┐
│                    BACKEND                               │
│                                                          │
│  table-platform.routes.ts (~120+ endpoints)              │
│                                                          │
│  Services (30):                                          │
│   ├── MetadataService (bases/tables/fields/views CRUD)   │
│   ├── RecordsService (CRUD + batch + validation)         │
│   ├── ViewQueryEngine (40 filter operators, pagination)  │
│   ├── RelationService (links, lookup, rollup, count)     │
│   ├── ChatToSchemaService (LLM pipeline)                 │
│   │    └── IntentParser → SchemaGrounder →                │
│   │       ProposalGenerator → MutationExecutor           │
│   ├── AuditService (history, snapshots, activity feed)   │
│   ├── FormService (forms + public submissions)           │
│   ├── FormulaEngine + DependencyGraph                    │
│   ├── AttachmentService (upload/download/signed URLs)    │
│   ├── CsvImportService                                   │
│   ├── ExportService (CSV/XLSX)                           │
│   ├── PermissionsService + FieldPermissionService        │
│   ├── AutomationService + ScheduledAutomationExecutor    │
│   ├── WebhookDispatcherService                           │
│   ├── InterfaceService (9 endpoints)                     │
│   ├── GovernedModelService (KPI, dimensions, trust)      │
│   ├── RealtimeService (Socket.IO presence + cell sync)   │
│   ├── ProjectionService (graph compatibility)            │
│   ├── MigrationService (legacy → platform)               │
│   ├── SSOService + SCIMService + ServiceAccountService   │
│   ├── ExtensionService (iframe sandbox + SDK)            │
│   └── AuditRetentionJob + ErrorHandling                  │
│                                                          │
│  Data Collection:                                        │
│   ├── ConnectorFramework (6 connectors)                  │
│   ├── SchemaMappingEngine                                │
│   ├── SyncScheduler                                      │
│   └── SchemaDriftDetector                                │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                  POSTGRESQL (Railway)                     │
│                                                          │
│  Migrations 700-713:                                     │
│   700: Foundation (bases, tables, fields, views, records)│
│   701: Performance indexes                               │
│   702: Schema versions                                   │
│   703: Connectors + provenance                           │
│   704: Forms                                             │
│   705: Webhook buffer                                    │
│   706: Field permissions                                 │
│   707: Audit retention                                   │
│   708: Automations                                       │
│   709: Outbound webhooks                                 │
│   710: Interfaces                                        │
│   711: SSO/SCIM                                          │
│   712: Extensions                                        │
│   713: Governed models (KPI, dimensions, trust)          │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Co działa (podłączone do UI)

| Funkcja | Komponent | Status |
|---------|-----------|--------|
| Czat buduje tabele | UnifiedChatPanel + tableIntentDetector + ChatTableProposalCard | ✅ Live |
| AI Schema z toolbara | ChatToSchemaPanel (przycisk + Ctrl+Shift+S) | ✅ Live |
| AI Table Assistant (nowy backend) | AITableAssistant z usePlatform branch | ✅ Live |
| Grid view | IdeaTableTool + PlatformCellRenderer + CellEditor | ✅ Live |
| Kanban view | ViewRouter → KanbanView | ✅ Live |
| Calendar view | ViewRouter → CalendarView | ✅ Live |
| Gallery view | ViewRouter → GalleryView | ✅ Live |
| Timeline view | ViewRouter → TimelineView | ✅ Live |
| Gantt view | ViewRouter → GanttView | ✅ Live |
| Form view | ViewRouter → FormView | ✅ Live |
| **Chart view** | ViewRouter → ChartBlock + ChartConfigPanel | ✅ **Nowe** |
| View switcher | ViewSwitcher + ViewConfigPanel | ✅ Live |
| Filtrowanie (40 operatorów) | FilterBuilder | ✅ Live |
| Linked records | LinkedRecordPicker + LinkedRecordDisplay | ✅ Live |
| Record expand modal | RecordExpandModal | ✅ Live |
| Formula editor | FormulaEditor | ✅ Live |
| Audit trail + activity feed | AuditTrailPanel + ActivityFeed | ✅ Live |
| Snapshots | SnapshotManager | ✅ Live |
| Data connectors (6 typów) | ConnectorWizard + ConnectorList | ✅ Live |
| Provenance badge + trust | ProvenanceBadge (z ShieldCheck) | ✅ Live |
| **Realtime presence** | useTableRealtime + PresenceIndicators | ✅ **Nowe** |
| **Interface Designer** | InterfaceDesigner (z toolbara) | ✅ **Nowe** |
| Form builder | FormBuilder + PublicFormView | ✅ Live |
| CSV import | CsvImportService | ✅ Live |
| Export (CSV/XLSX) | ExportService | ✅ Live |
| Automations builder | AutomationBuilder + CronBuilder | ✅ Live |
| Offline queue | OfflineQueue + OfflineIndicator | ✅ Live |
| Extensions | ExtensionHost + ExtensionMarketplace | ✅ Live |

---

## 4. Co zostaje do zrobienia

### Priorytet 1 — Następna sesja
| # | Temat | Opis |
|---|-------|------|
| P1.1 | **Testy live na Railway** | Uruchomić migracje 700-713, utworzyć demo tabele, przetestować CRUD |
| P1.2 | **E2E testy Playwright** | Uruchomić 3 istniejące spec files na live app |
| P1.3 | **Deployment staging** | Push na Railway, weryfikacja API |

### Priorytet 2 — Osobny moduł
| # | Temat | Opis |
|---|-------|------|
| P2.1 | **WS-G Distribution** | Dystrybucja artefaktów (raporty, prezentacje, tabele, mapy, notatki) — osobny moduł |

### Priorytet 3 — Nice-to-have
| # | Temat | Opis |
|---|-------|------|
| P3.1 | Governed Models UI | Frontend dla KPI definitions, dimensions, trust management |
| P3.2 | Connectors live test | Przetestować Google Sheets, Airtable, Jira connectors z prawdziwymi danymi |
| P3.3 | Realtime test | Test z 2+ użytkownikami jednocześnie |
| P3.4 | Performance profiling | Testy wydajności z >1000 rekordów |

---

## 5. Metryki kodu

| Metryka | Wartość |
|---------|---------|
| Backend services | 30 |
| API endpoints | ~120+ |
| Frontend components (table/) | 76 |
| SQL migrations | 14 (700-713) |
| Unit tests | 321 passing |
| Test files | 27 |
| E2E test specs | 3 |
| Connectors | 6 (CSV, Google Sheets, Airtable, PostgreSQL, Jira, Webhook) |
| View types | 8 (grid, kanban, calendar, gallery, timeline, gantt, form, chart) |
| Filter operators | 40 |
| Field types | 22 |
| Chat intents | 11 (EN+PL) |

---

## 6. Commity z tej sesji

```
ddb9b32 feat(table-platform): complete final wiring — chat builds tables, charts, realtime, governed models
050ef26 fix(finance): statement import improvements and audit updates
31e60b1 test(table-platform): add smoke tests, E2E tests, and governed model tests
```
