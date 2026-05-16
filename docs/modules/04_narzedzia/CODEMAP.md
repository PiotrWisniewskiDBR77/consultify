---
module_id: MODULE_TOOLS
doc_kind: CODEMAP
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Codemap — Narzędzia

## Routes (as-is)

Źródło: `DRD/consultify/docs/modules/DISCOVERY_TOOLS_MODULE.md`.

- Hub: `/discovery-tools` → `src/views/discovery-tools/DiscoveryToolsView.tsx`
- Kategorie:
  - `/discovery-tools/strategic`
  - `/discovery-tools/operational`
  - `/discovery-tools/digital`
  - `/discovery-tools/process-automation`

## Key components (as-is)

- `src/components/DiscoveryTools/ToolWorkspace.tsx` (orchestracja sesji + AI integracja)
- `src/components/DiscoveryTools/ToolDocumentView.tsx` (kanoniczny “tool document view”)
- `src/components/DiscoveryTools/ToolCanvas.tsx` (step rendering)
- Store: `src/store/useToolStore` (ToolSession + step defs)
- AI hook: `src/hooks/discovery/useToolAI`

## Downstream handoff (as-is)

- `createInitiative` → `InitiativeGeneratorWizard` (inicjatywy)


