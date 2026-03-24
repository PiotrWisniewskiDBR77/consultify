# Maintainer Hygiene Checklist

Use this checklist before adding new docs or retaining working material in the repo.

## Before Adding A New Document

- confirm the canonical namespace: `docs/product/`, `docs/ui-standards/`, `docs/strategy/`, or `docs/plans/`
- avoid creating numbered copies such as `* 2.md`, `* 3.md`
- decide whether the document is `canonical`, `active-working`, or `historical`
- update the nearest index or registry in the same change

## If The Document Is Historical

- keep it in a clearly historical namespace or add an explicit note in the local index
- do not present it as the current source of truth
- add a pointer to the canonical replacement when one exists

## If The Material Is A Raw Export

- prefer `docs/plans/` for tracked planning exports that still matter
- keep bulky raw corpora out of canonical trees
- do not duplicate the same export in multiple namespaces

## If You Need Temporary Local Safety

- use ignored local folders such as `_quarantine/`
- do not check local backups, logs, screenshots, or Finder/iCloud duplicates into git

## Minimum Definition Of Done For New Documentation

1. one obvious canonical path
2. nearest index updated
3. historical predecessors labeled
4. no suffixed duplicate copies left behind
