# Source reachability inventory

Generated from `7bf4d27cd751afb2d6c24d195891be5aa54c433b` at 2026-08-15T04:01:13.733Z.

This is a conservative inventory. `ORPHAN_CANDIDATE` means manual review is required; it never authorizes deletion.

## Counts

| Classification | Files |
|---|---:|
| BUILD_SUPPORT | 12 |
| ORPHAN_CANDIDATE | 1246 |
| RUNTIME_REACHABLE | 5045 |
| SUPPORT_ONLY | 526 |
| Unresolved local imports (all analyzed sources) | 120 |
| Unresolved local imports (runtime reachable) | 0 |

## Runtime roots

- frontend: `src/index.tsx`
- backend: `server/src/index.ts`
- newAppFrontend: `apps/new-app/frontend/src/index.tsx`
- newAppBackend: `apps/new-app/backend/src/index.ts`

Detailed, machine-readable classifications are in `source-reachability.json`.

## Limitations

- ORPHAN_CANDIDATE is never deletion authority; dynamic registries, filesystem loading and runtime strings require manual review.
- SUPPORT_ONLY means reachable from tests or scripts but not from a configured runtime entrypoint.
- Only configured source roots are classified; migrations, assets and documentation are inventoried separately.
