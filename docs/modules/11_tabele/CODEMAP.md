---
module_id: MODULE_TABLES
doc_kind: CODEMAP
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Codemap — Tabele (Table Studio)

## Route / AppView / Entry component

Routing jest mieszany (lane + surfaces), więc mapujemy przez “code anchors” z closeout.

- **Shell UI (lane)**: `src/components/AIChat/KimiWorkspace/tabeleShell/` (MELS shell + right rail)
- **Forms intake UI**: `src/components/MyWork/table/forms/`
- **Frontend flags**: `src/utils/tabele*Flag.ts`
- **API client**: `src/services/api/tablePlatform.api.ts`
- **Backend services (core)**: `server/src/services/tablePlatform/*` (AI editor, QA, source pack, conversions, intake)
- **Public JWT intake route**: `/api/table-platform/public/forms/jwt/:token`

## Implementation notes

Kontrakty Tables są ostro “security + audit”-driven: każda mutacja ma ledger; cross-tenant probes odmawiają (`TENANT_VIOLATION`).

