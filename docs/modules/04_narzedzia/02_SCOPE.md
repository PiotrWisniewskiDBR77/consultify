---
module_id: MODULE_TOOLS
doc_kind: SCOPE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Scope — Narzędzia

## Purpose

Ustalić granice odpowiedzialności modułu `Narzędzia` oraz jego relacje z: `Czat`, `Wywiad`, `Inicjatywy`, `Outputs` i `Assessment`.

## In scope (Must)

- MUST: biblioteka narzędzi (Discovery Tools) + kategorie + uruchamianie sesji.
- MUST: prowadzenie sesji narzędziowej (ToolWorkspace) oraz rendering kroków/wyniku.
- MUST: generowanie inicjatyw jako propozycji wynikających z narzędzia (handoff do Initiatives flow).
- MUST: linkowanie do `Assessment` gdy narzędzie rekomenduje framework.

## Out of scope (Must Not)

- MUST NOT: końcowe zatwierdzanie i governance inicjatyw (należy do `Inicjatywy`).
- MUST NOT: działać jak “globalny czat” (to należy do `Czat`) — narzędzia mają metodę i strukturę.

## Should

- SHOULD: wspólny model obszaru Tools (v3) obejmujący consulting tools i licensed tools (assessments), bez dublowania UI.

## Acceptance Criteria

- [ ] Zakres nie dubluje `Czat` (ogólny chat), a jednocześnie dopuszcza “chat panel” jako część sesji narzędzia.
- [ ] Kontrakt jawnie opisuje relację do `Assessment` (osobny route vs podpowierzchnia).

## Related Sources

- `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
- `DRD/consultify/docs/modules/DISCOVERY_TOOLS_MODULE.md`
- `DRD/consultify/docs/product/TOOLS_CATALOG_V3.md`

