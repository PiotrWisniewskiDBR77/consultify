# T4 Charter - Edukacja

Date: 2026-03-26
Lane: `Edukacja`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

`Edukacja` was previously deferred as a standalone branch outside `Help / Knowledge Base`. After explicit unlock, the
smallest honest starting point is not a new standalone academy shell, but one bounded education seam delivered through
the already-authorized `Help / Knowledge Base` bridge.

## Goal

Promote one bounded edukacja slice that reduces mixed truth across:

1. public docs / KB read continuity
2. fallback behavior for public educational article surfaces
3. the documented `Edukacja via Help / Knowledge Base` bridge

## In scope

1. one bounded edukacja packet at a time
2. split-brain map for frontend surfaces, runtime contracts, and evidence
3. one canonical fallback/read-contract fix on the active docs education surface
4. tracker/program/evidence updates after each packet

## Explicitly out of scope

1. standalone `Edukacja` sidebar/module branch
2. new LMS / academy engine
3. partner certification depth
4. broad `Landing` education redesign
5. `Mobile`

## Initial bounded packet

Packet 1:

- align `useDocs` fallback behavior with a real mounted KB endpoint
- remove the dead `/api/knowledge-base/*` fallback assumption from the public docs education surface
- add bounded regression for the mounted KB fallback path

Why this first:

- it respects the documented rule that `Edukacja` currently flows through `Help / Knowledge Base`
- it closes a real runtime/client seam on an active educational surface
- it avoids inventing a new top-level education product branch before product scope is rechartered

Recorded in:

- `evidence/194-v81-edukacja-split-brain-map.md`

## Packet 1

Completed:

- replace dead `/api/knowledge-base/*` fallbacks in `useDocs` with mounted `/api/kb/*` fallbacks
- keep the public V8 KB bridge as primary and the V8 client as the second hop
- add bounded regression for categories/articles fallback continuity

Recorded in:

- `evidence/195-v81-edukacja-kb-fallback-seam.md`

## Packet 2

Completed:

- canonicalize KB entry authority to `/docs` for `AppView.KNOWLEDGE_BASE`
- reduce legacy `/knowledge` to a compatibility redirect shim
- add bounded regression for route authority and redirect continuity

Recorded in:

- `evidence/196-v81-edukacja-entry-authority-seam.md`

## Acceptance position

This lane is ready for bounded `T4` acceptance because the active KB-backed edukacja surface now has:

1. coherent docs fallback continuity on mounted KB paths
2. one canonical public education entry at `/docs`
3. legacy `/knowledge` reduced to compatibility behavior instead of a competing authority surface

Recorded in:

- `evidence/197-v81-edukacja-t4-acceptance.md`

## Next bounded candidate

1. none inside the currently accepted bounded lane
2. keep standalone `Edukacja` branch expansion out of scope unless explicitly rechartered beyond the KB bridge
