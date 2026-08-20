# Wave 01 — critical recovery and duplicate triage

Status: `CRITICAL_SCOPE_CLASSIFIED`

## Decisions

| Domain | Candidate | Relation to Wave baseline | Classification | Decision |
|---|---|---|---|---|
| Finance Statement | `f5c6a7f16f95a6b800afb19b08832d2c6930514c` | divergent; 41 files, +4678/-854 | `UNIQUE_REUSABLE + CONFLICTING_SCHEMA` | do not merge wholesale; repair schema contract in its bounded source packet, requalify exact-six, then port reviewed commits |
| Finance stop-loss evidence | `9290b2ac7e` | ancestor | `EVIDENCE_ONLY / ALREADY_IN_CANON` | retain; do not treat as product acceptance |
| SWOT bounded checkpoint | base `8e5c694ec6`, five dirty paths in protected worktree | divergent historical packet; broad branch diff is 37 files | `UNKNOWN_DIRTY` for five paths, surrounding branch largely `CONFLICTING_DUPLICATE` | preserve; review only the five dirty paths against current canon; no whole-branch merge |
| Results legacy cutover | `5f5c5e507a64b262ec9585b2469ba6277b0b6939` | ancestor | `ALREADY_IN_CANON / POLICY_GAP` | no code recovery; Wave 02 needs decisions/successors for five null-successor writers |
| Transform flow | `c50c4895f11012ea4326fd9879521716f100a5d8` | ancestor | `ALREADY_IN_CANON / RUNTIME_EVIDENCE_GAP` | no code recovery by default; build real owner/runtime lineage proof first |
| Chat NFR | `8c1cf4f010259b10bd069f312684f2f9fec815c8` | ancestor, later fail-closed UI changes requalified | `ALREADY_IN_CANON` | promote repository task; retain provider window as release gate |
| Idea Teresa registry | current canon | mounted bounded registry | `ALREADY_IN_CANON` | reuse as adapter for global manifest; do not duplicate |
| Dynamic SWOT Teresa kernel | current canon plus protected SWOT checkpoint | 23 declared, 6 implemented handlers | `UNIQUE_REUSABLE + INCOMPLETE` | preserve lifecycle; classify missing handlers, no parallel second kernel |

## Key duplicate findings

- Finance has both a current period-aware unique index and a resurrected legacy type-only index. This is a direct schema-contract duplicate and the confirmed cause of Statement failure.
- Teresa capabilities are fragmented across Idea manifest, Dynamic SWOT kernel, Chat tool definitions and module-local registries. A new independent registry would create a fourth/fifth source of truth; Wave 02 must federate existing registries.
- Results and Transform source SHAs are already ancestors of the current branch. Searching their old branches for a “missing implementation” would repeat integrated work; remaining gaps are semantic disposition and runtime acceptance.
- The SWOT branch contains a broad historical divergence, while the active handoff names only five dirty paths. Only those five paths are eligible for comparison; the remaining branch diff is not a merge packet.

## Protected/unknown remainder

Non-critical dirty worktrees remain preserved. They are intentionally outside Wave 01 deep review unless a Wave 02 packet references their domain. This prevents the 1000+ divergent branch population from becoming an unbounded archaeology project.

## Fan-in rule

No whole-branch merge is authorized. A recovered item must name the exact commit/path, demonstrate a missing current behavior with a failing test and pass shared typecheck/build after port. Otherwise it remains preserved or is classified as superseded/evidence-only.
