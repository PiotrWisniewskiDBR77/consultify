# Tool Knowledge Bank (authoring rules)

This folder contains **Tool Knowledge Packs** — curated, compact, pre-arranged knowledge about consulting tools, designed for:

- assessment UIs (questions, evidence prompts, examples),
- tool-scoped RAG retrieval,
- initiative/roadmap proposal generation (propose→accept).

Canonical SSOT:

- `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`
- `docs/product/TOOLS_SSOT_SOURCES_V3.md`

---

## Folder structure

Packs live under:

- `knowledge/tool-kb/<tool_slug>/<pack_type>/v<major>/...`

Where:

- `tool_slug`: `drd`, `siri`, `adma`, `balanced_scorecard`, etc.
- `pack_type`: `qbank`, `methodology`, `initiatives`, `benchmarks`
- `v<major>`: e.g. `v1`

---

## Pack rules (MUST)

- **Compact**: prefer structured bullets over long paragraphs.
- **Chunk-friendly**: write in sections that can be embedded and retrieved.
- **Stable ids**: every section should have an id-like heading or marker.
- **Evidence-first**: include what evidence is required and common mistakes.
- **Provenance**: always list canonical sources (PDFs/docs) for each pack.
- **No client data**: project-specific notes do not belong here.

---

## Templates

Use:

- `knowledge/tool-kb/_templates/tool-pack.v1.md`

