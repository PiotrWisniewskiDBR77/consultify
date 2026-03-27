# T3 Charter - Notes Adjuncts

Date: 2026-03-26
Lane: `Notes` adjuncts
Taxonomy: `T3`
Tranche: `Tranche 3`
Status: `done`

## Why now

`Multiplayer / collaboration` is now accepted as the previous active bounded lane. `Notes` adjuncts are the
next highest-value parked candidate because the notebook core lane is already staging-proven on governed V8
runtime, while visible notebook adjunct workflows still mix that governed core with legacy-only side-lanes.

## Goal

Promote one bounded notes adjunct parity slice that reduces mixed truth across:

- governed notebook core runtime and visible notebook adjunct workflows
- notebook AI side-lanes that still bypass the governed V8 notebook namespace
- bounded V8-first notes continuity without reopening the already-accepted notebook core lane

## In scope

1. notebook adjunct workflow consistency on one bounded surface at a time
2. split-brain map for notebook adjunct frontend surfaces, runtime contracts, and evidence
3. one bounded notes adjunct packet at a time
4. tracker/program/evidence updates after each packet

## Explicitly out of scope

1. reopening notebook core CRUD/status parity already proven in `evidence/97-v8-notes-runtime-core-lane-proof.md`
2. broad notebook upload / convert / attachment redesign in one packet
3. broad My Work notebook architecture rewrite
4. broader cross-tool conversion parity beyond one bounded adjunct seam

## Initial bounded packet

Packet 1:

- add governed V8-first parity for notebook AI proposal list/create/resolve continuity
- move the active `NotebookContent` proposal review surface off legacy `/api/notebook/*/ai-proposals` routes
- keep upload / convert breadth and any already-governed classify behavior outside this packet

Why this first:

- `evidence/97-v8-notes-runtime-core-lane-proof.md` explicitly identifies notebook AI proposals as an active residual on the live notebook surface
- the proposal panel is already visible in `NotebookContent`, so this is a real user-facing adjunct seam
- it is smaller and cleaner than upload/convert breadth while still reducing a true mixed-runtime path

Recorded in:

- `evidence/168-v81-notes-adjuncts-split-brain-map.md`

## Packet 1

Completed:

- add governed V8-first parity for notebook AI proposal list/create/resolve continuity
- move the active `NotebookContent` proposal review surface off legacy `/api/notebook/*/ai-proposals` routes
- keep upload / convert breadth and any already-governed classify behavior outside this packet

Recorded in:

- `evidence/169-v81-notes-ai-proposals-v8-seam.md`

## Packet 2

Completed:

- add one governed V8-first notebook convert seam on the active notebook surface
- route notebook convert through the governed V8 notebook namespace before any bounded legacy fallback
- keep broader upload / attachment breadth outside this packet unless it proves inseparable from convert continuity

Recorded in:

- `evidence/170-v81-notes-convert-v8-seam.md`

## Next bounded candidate

1. no further packet inside the current bounded `T3` lane
2. any next notebook work now belongs to broader upload / attachment adjunct parity, not the accepted AI proposal + convert slice

## Acceptance decision

`Notes` adjuncts are accepted as bounded `T3` complete.

Why acceptance is justified:

1. the governed notebook core runtime was already established and staging-proven before this adjunct lane was promoted
2. the visible notebook AI proposal strip now follows a governed V8-first seam
3. the visible notebook convert workflow now follows a governed V8-first seam
4. the remaining upload / attachment breadth was explicitly kept outside this bounded lane and is now treated as broader parity work

Recorded in:

- `evidence/171-v81-notes-adjuncts-t3-acceptance.md`
