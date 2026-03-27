# V8.1 Evidence - Edukacja Split-Brain Map

Date: 2026-03-26
Lane: `Edukacja`
Taxonomy: `T4`
Status: `active`

## Why this lane is promoted now

`Edukacja` was explicitly deferred as a standalone branch outside `Help / Knowledge Base`. After explicit unlock, the
lane needs a bounded starting point that still respects the documented bridge through KB/help instead of inventing a
new academy product branch.

## Canonical scope boundary

The strongest closure/program docs already constrain this lane:

- `Edukacja` counts through `Help / Knowledge Base`
- standalone `Edukacja` outside KB remained deferred until explicit unlock

So the first packet should tighten one real KB/help seam, not open a fourth education runtime.

## Surface truth before promotion

There are multiple education/help-style surfaces:

1. `/docs/*`
   - API-backed through `useDocs`
2. `/knowledge`
   - static bundled module help
3. `/tools` and `/resources`
   - education/showcase style public-facing content
4. partner academy / certifications
   - separate partner runtime

The smallest active seam sits in `/docs/*`:

- `src/hooks/useDocs.ts` prefers `/api/public/kb-v8/*`
- then tries V8 KB client calls
- then falls back to `/api/knowledge-base/*`

That last fallback path is not the mounted KB path used elsewhere in product runtime, creating dead fallback truth in
the active docs education surface.

## Bounded first packet

Packet 1 is narrowed to:

1. remove the dead `/api/knowledge-base/*` fallback from `useDocs`
2. align docs fallback continuity to mounted `/api/kb/*`
3. add bounded regression proving the public docs education surface still resolves when public and V8 KB bridges fail

## Explicitly not this packet

- new standalone `Edukacja` routing/module
- LMS/academy creation
- partner certifications
- broad `/knowledge` vs `/docs` convergence
- landing/mobile education expansion

## Why this is the right first slice

This is the smallest real edukacja cut because it improves an already-live KB-backed educational surface, stays inside
the documented KB bridge, and removes one concrete runtime/client lie without broadening product scope.
