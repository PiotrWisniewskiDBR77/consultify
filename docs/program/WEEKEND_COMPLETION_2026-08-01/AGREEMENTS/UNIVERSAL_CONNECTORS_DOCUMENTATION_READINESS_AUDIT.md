---
doc_kind: DOCUMENTATION_READINESS_AUDIT
status: PASS_DOC_NOT_RUNTIME
last_updated: 2026-07-31
---

# Universal Connectors — audyt kompletności dokumentacji

## 1. Werdykt

Dokumentacja architektury zewnętrznych połączeń jest kompletna do rozpisania realizacji. Nie oznacza to gotowego runtime. MCP IRIS i MCP Marketplace pozostają udokumentowanym targetem z placeholderami w UI; uniwersalny flow `Connect once → use everywhere` wymaga implementacji i golden-flow acceptance.

Werdykt: `PASS_DOC / NOT_READY_RUNTIME`.

## 2. Pokrycie

| Obszar | Kanoniczny dokument | Pokrycie | Status |
| --- | --- | --- | --- |
| prosty model produktu | `UNIVERSAL_CONNECTOR_PLATFORM_MCP_LIKE_STANDARD.md` | connect, scopes, bindings, use everywhere | PASS |
| control plane/API | `docs/product/CONNECTOR_CONTROL_PLANE_AND_API_CONTRACT_V8.md` | catalog, connections, runtime/support/webhooks | PASS |
| domain model/storage | `CONNECTOR_BACKEND_DOMAIN_MODEL_V8.md`, `CONNECTOR_DB_SCHEMA_AND_MIGRATION_CONTRACT_V8.md` | durable identities, schema/migrations | PASS |
| OAuth/reauth/revoke | `CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md` | owners, scopes, refresh, recovery | PASS |
| sync/conflicts | `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md` | directions, authority, conflicts | PASS |
| events/schema evolution | `CONNECTOR_EVENT_CONTRACTS_AND_SCHEMA_EVOLUTION_V8.md`, `CONNECTOR_EVENT_CATALOG_V8.md` | envelopes, compatibility, catalog | PASS |
| MCP trust | `MCP_AND_REMOTE_TOOL_TRUST_MODEL_V8.md` | trust classes, allowlist, approvals | PASS |
| enterprise search | `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` | ACL, scope, freshness, citations | PASS |
| operator/support | `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md`, runbooks | diagnostics/recovery | PASS |
| Calendar binding | `CALENDAR_SYNCHRONIZATION_AND_INTEROPERABILITY_CONTRACT.md` | Google/Microsoft/CalDAV/ICS | PASS DOC |
| Inbox binding | `INBOX_SOURCES_SYNCHRONIZATION_AND_ROUTING_CONTRACT.md` | ingestion, routing, dedup, commands | PASS DOC |
| Settings ownership | `docs/modules/18_ustawienia/05_DATA_AND_INTEGRATIONS.md` | settings boundary exists | PASS DOC, UI package later |
| Marketplace/IRIS | modules 14/15 | target and trust boundaries | PASS DOC / PLACEHOLDER runtime |

## 3. Nadrzędna zgodność

Istniejące kontrakty i nowy standard są zgodne w kluczowych punktach:

- jeden control plane i wspólny connection lifecycle;
- minimalne scopes i jawny owner credential;
- brak tokenów w modułach konsumenckich;
- capability-driven execution;
- rozdzielone read, sync i mutation;
- proposal/approval dla znaczących działań;
- ACL przed retrieval;
- freshness, health, degraded i recovery;
- idempotency, conflict i read-back;
- Marketplace kataloguje/instaluje, IRIS/runtime wykonuje dopuszczone wywołania.

## 4. Rozstrzygnięte potencjalne sprzeczności

1. `Native API connector` i `remote MCP` nie są konkurencyjnymi architekturami. Oba publikują wspólny manifest capability i przechodzą przez ten sam gateway/UI.
2. `MCP Marketplace` nie wykonuje narzędzi; odpowiada za katalog/admission/install metadata. Runtime/control plane wykonuje call.
3. `MCP IRIS` jest konkretnym providerem/serwerem, nie równoległym systemem integracji.
4. ICS jest jednokierunkowym feedem, nie pełną synchronizacją.
5. Connect na poziomie Settings nie oznacza automatycznej zgody na wszystkie moduły; wymagane są per-module bindings.
6. Teresa korzysta z connector resources/tools, ale nie jest właścicielem credentiali ani automatycznej zgody.

## 5. Braki realizacyjne, nie dokumentacyjne

- jeden produkcyjny katalog i flow Connect;
- capability manifest discovery dla native i remote MCP;
- spójny resolver/binding per module;
- step-up authorization dla write scopes;
- admission UI dla remote MCP;
- referencyjny golden flow Google Workspace i Microsoft 365;
- lifecycle propagowany równocześnie do Calendar, Inbox i Teresa;
- disconnect/revoke/retention E2E;
- Marketplace i IRIS poza placeholderem;
- compatibility tests dla nowego konektora bez zmian w modułach.

## 6. Bramka przed budową

Każdy task implementacyjny musi wskazać:

- capability ID i manifest field;
- control-plane/API owner;
- module binding;
- scopes i approval class;
- source-of-truth i direction;
- idempotency/conflict/read-back;
- health/recovery;
- audit i acceptance flow.

Task niespełniający tej checklisty wraca do doprecyzowania.

## 7. DoD platformy

Dokumentacja pozostaje `PASS_DOC`. Runtime uzyska `READY`, dopiero gdy GF-X1–GF-X10 ze standardu uniwersalnych konektorów przejdą na świeżej bazie, dla co najmniej Google Workspace, Microsoft 365 oraz jednego dopuszczonego remote MCP servera.
