---
module_id: MODULE_ORGANIZATION
doc_kind: META
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# META — Organizacja (Organization Context)

## Purpose

Metadane kontraktu dla Organization Context Engine jako warstwy pamięci organizacji.

## Identity

- **Sidebar label**: Organizacja
- **Folder**: `16_organizacja`
- **Module id**: `MODULE_ORGANIZATION`

## Canonicality

- **Contract status**: draft (w trakcie migracji z istniejących SoT)
- **Primary SSOT map**: `SSOT.md`

## Doctrine

- “Uploaded materials” nie są pasywnym storage.
- Kanoniczny lifecycle: `raw asset -> extraction -> normalized knowledge package -> indexed chunks -> governed retrieval -> cited AI output -> lineage ledger`.
- AI nie używa raw plików — używa permission-filtered chunków.

## Open questions (max 3)

1. Gdzie w UI jest kanoniczna administracja engine (statusy, quota, retry, policy blocks): Admin panel czy Settings?
2. Jaki jest docelowy routing modułu Organizacja w sidebarze (czy w ogóle istnieje)?
3. Które workflow’y AI mogą używać `approved_org_context` i jak to jest komunikowane userowi?

