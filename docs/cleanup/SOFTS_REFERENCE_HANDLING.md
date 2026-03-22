# Softs Reference Handling

## Purpose

Define how large benchmark and vendor-reference corpora such as `Softs/` should be handled without polluting canonical product documentation.

## Current Interpretation

- `Softs/` is an `external-reference` corpus.
- It is useful for pattern extraction, benchmark comparison, and evidence gathering.
- It is not the place where durable product decisions should live.

## Policy

1. Keep durable conclusions in tracked docs under `docs/product/`, `docs/strategy/`, or another canonical namespace.
2. Keep raw mirrors, vendor exports, screenshots, and bulky source material out of canonical doc trees.
3. Treat local `Softs/` content as operator-owned reference material unless a future repository strategy explicitly vendors it.
4. Preserve provenance in the destination doc:
   - what source class was used
   - which benchmark family it came from
   - what conclusion was adopted

## Recommended Future Shape

| Need | Recommended home |
| --- | --- |
| product conclusion | `docs/product/` |
| strategic benchmark synthesis | `docs/strategy/` |
| local raw corpus | local-only `Softs/` |
| compact manifest of source families | `docs/cleanup/` or a future benchmark manifest |

## Out Of Scope For This Cleanup Pass

- deleting `Softs/`
- committing large mirrored source trees
- rewriting old benchmark-derived docs
