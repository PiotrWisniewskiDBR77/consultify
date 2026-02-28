## Scope

Digest rozmów o **Tools**: Known Tools (free standards), consulting tools (strategic/operational/digital), Visual Tool Library, Universal Tool Wizard, Tool-linked Knowledge Base oraz tool “Process Automation” jako referencyjna hybryda (workspace + tabela + economics).

## Decisions (hard)

- **“Uczymy jak używać”**: Known Tools to standardy rynkowe, nie “nasze autorskie” — buduje wiarygodność.
- **Tools jako jeden mental model**: Library → Sessions → Outputs → Initiatives (Assessments jako kategoria Licensed).
- **Preview w bibliotece**: narzędzie ma opis + grafika + docelowo micro-video (krótki, edukacyjny).
- **Universal Tool Wizard**: jeden shell, konfigurowany per toolType (różne kroki/surface), ale wspólny kontrakt.
- **Jedna lista narzędzi (bez rozjazdu 31 vs 60)**: SSOT rozdziela **31 interactive toolTypes** od **biblioteki klasycznych template narzędzi (~60)** + definiuje ich rolę i `tool_class`.
- **Scaffolding outputów per tool**: potrzebne jest deterministyczne mapowanie “tool → szkic report/deck + draft initiatives” (żeby Outputs nie były losowe).

## Requirements (MUST / SHOULD)

- **MUST**: Tools hub ma kategorie i filtrowanie (strategic/operational/digital/licensed) + preview pane.
- **MUST**: Tool session kończy się “Outputs” (report/deck/draft initiatives) z metadanymi + traceability.
- **MUST**: “Process Automation” jako kanoniczny przykład hybrydy: flowchart w workspace zsynchronizowany z tabelą kroków + savings + CAPEX/OPEX + payback/ROI.
- **SHOULD**: Tool-linked KB (how-to, expected outcomes, examples) + assety (thumbnail/video) przypięte do toola.

## Open questions

- Standard UI dla narzędzi, które wymagają dużo treści: “jedna powierzchnia” vs split view (workspace + table + commentary).
- Minimalny zestaw assetów na go-live (thumbnail MUST, video SHOULD?).

## SSOT impact (files to update / keep aligned)

- `docs/product/TOOLS_CATALOG_V3.md`
- `docs/product/CONSULTING_TOOLS_V3.md`
- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md`
- `docs/product/CONSULTING_TEMPLATES_LIBRARY_V3.md`
- `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`
- `docs/product/VIDEO_ENABLEMENT_V3.md`
- `docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md`

## Backlog extraction (mapowanie na V3)

- **V3-E01** — Tools: unified model + routing/tabs
- **V3-E02** — Tools hub outputs jako artefakty (Reports/Presentations/Initiatives)
- **V3-E03** — Tool Wizard Standard (non-licensed tools runtime)
- **V3-E04** — One task per consulting tool (spec+assets+help)
- **V3-E05** — Process Automation tool (hybrid workspace+table wizard)
- **V3-E07** — Known Tools content completeness audit + fill plan

## Notes (źródła rozmów)

- Cursor transcript: `518c688e-48f6-41f0-909a-629f129253f2` (Known Tools module, Visual Tool Library Interface, Tool-linked KB, Process Automation).
- Cursor transcript: `51727cc5-5281-4767-89a9-ab0941b035a9` (audit kompletności narzędzi, ujednolicenie SSOT 31 vs 60, template library + gaps/scaffolding).

