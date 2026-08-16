# Repository Cleanup Governance

## Goal

Reduce repository noise without deleting canonical material or making historical trees ambiguous.

## Protected Set

Treat the following as protected unless the user explicitly requests deeper restructuring:

- `docs/product/DOCUMENTATION_REGISTRY.md`
- `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- `docs/ui-standards/README.md`
- `docs/ui-standards/FROZEN_LAYOUTS.md`
- `docs/strategy/README.md`
- `README.md`

## Cleanup Categories

| Category | Meaning | Default action |
| --- | --- | --- |
| `canonical` | Current source of truth used for implementation or governance | Keep, label clearly, strengthen indexes |
| `active-working` | Current working material not yet elevated to SSOT | Keep in place, point to owner, avoid duplicate forks |
| `historical` | Older but still useful context or evidence | Keep with explicit historical label or stub index |
| `snapshot-duplicate` | Finder/iCloud/local numbered copies like `* 2.md` or `* 3.md` | Delete locally if canonical equivalent exists and there is no unique diff signal |
| `external-reference` | Vendor mirrors, benchmarks, local corpora, imported evidence | Keep outside canonical doc flow, manage separately |
| `local-only-garbage` | Logs, temp exports, local backups, accidental copies | Delete or keep ignored only |

## Allowed Actions

| Category | Allowed | Avoid |
| --- | --- | --- |
| `canonical` | index updates, cross-links, ownership notes | delete, silent move, rename without redirects |
| `active-working` | clarify status, move into planned namespace | treating as SSOT without index support |
| `historical` | keep, relabel, retire into tracked historical path | deleting just because it is old |
| `snapshot-duplicate` | local delete, local quarantine, ledger entry | promoting duplicate files into tracked canon |
| `external-reference` | separate handling plan, provenance notes, local-only storage | mixing raw mirrors into product SSOT paths |
| `local-only-garbage` | delete, ignore via `.gitignore` | checking into git |

## Archive And Quarantine Policy

Use two different mechanisms:

1. **Tracked retirement path**
   Use a tracked path such as `docs/cleanup/retired/` or a domain-local `historical/` folder when the repository should preserve a visible record.
2. **Local quarantine**
   Use ignored local folders like `_quarantine/` only for non-tracked local clutter.

Do **not** use a tracked `archive/` or `quarantine/` path as the primary repo-visible retirement mechanism, because those names are intentionally ignored by `.gitignore`.

Branch/worktree quarantine is a control disposition, not necessarily a physical
move. A preserved ref or registered worktree may remain in place when its exact
path, HEAD and status are manifested and it is excluded from canonical
execution. `QUARANTINE_BACKLOG` never means reviewed, represented, disposable,
prune-ready, or authorized for deletion.

## Delete Rules

Before deleting or retiring a file, verify:

1. it is not a protected document
2. it is not the only file named by a local index or registry
3. a non-suffixed or better-canonical replacement exists
4. the file is not carrying unique content that has not been preserved elsewhere

## Whitespace Gate

Use `scripts/cleanup/check-candidate-whitespace.sh` for the recovery candidate.
It applies `git diff --check` to code and ordinary documentation while excluding
only named raw-evidence corpora (`docs/qa`, readiness evidence, regression
transcripts and generated handoff test TSVs). Those captures preserve external
HTTP/SQL/tool bytes; normalizing them would alter evidence. Adding a new exclude
pattern requires a governance change and must never be used to hide source-code
whitespace failures.

## Version-Stack Rules

- `V8` documents may supersede older docs, but older docs remain historical until an index says otherwise.
- Mixed stacks such as `V3`, `V5`, `V6`, `V8` must be resolved by indexes first, not by blind deletion.
- Numbered suffix copies are never authoritative.

## Parallel Tree Rules

- `docs/` is the long-term canonical documentation tree.
- `wdrozenia/` is a tracked historical implementation tree until selectively migrated.
- `Consulitinity przegląd/` is tracked audit evidence and review history.
- `Softs/` is external reference material and must be handled by separate policy.
