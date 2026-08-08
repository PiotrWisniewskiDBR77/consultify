# Residual scope disposition — 2026-08-08

Candidate SHA: `da6e409e2b262dddf1b5d347a5bdde593d86cb7a`

Every item below is explicitly resolved or deferred; none is silently dropped,
and none is claimed as repaired in `REPAIR_STATUS.reconciled.csv` /
`ATOMIC_PACKAGE_MAP.reconciled.csv` unless the evidence in this document or
`EXACT_SHA_VISUAL_MATRIX_2026-08-08.md` actually supports it.

## Protected domains — 149 atoms, `BLOCKED_OWNERSHIP`, untouched by design

| Package | Domain | Atoms | Decision |
|---|---|---|---|
| R16 | Finance (T40–T43) | 7 | Not attempted. Protected. Owner: Piotr — needs explicit unlock decision before any P0 registry work starts. |
| R17 | My Work / Calendar (T04) | 8 | Not attempted. Protected. Same owner/unlock path as R16. |
| R20 | My Work (T01–T08) | 58 | Not attempted. Protected. Largest blocked package; unlock is a program-level decision, not a per-atom one. |
| R21 | Interview (T09–T14) | 48 | Not attempted. Protected. |
| R27 | Finance (T39–T43 tail) | 23 | Not attempted. Protected, same as R16. |
| R19 | Cross-module responsive overflow (T03,T06,T11,T16,T24) | 5 | Not attempted — entangled with the protected domains above plus un-isolated R02/R04 diffs; cannot be cleanly separated without first resolving R20/R21 ownership. |

**Decision:** none of these are part of this non-production RC. They require Piotr to explicitly authorize touching Finance/MyWork/Interview ownership before any future package can start — this is the single largest lever in the whole 322-atom backlog (149/322, 46%) but it is a scope decision, not a technical blocker.

## R02 — Interview, deferred by design (not protected-blanket, a specific exclusion)

`PARTIAL/DEFERRED_INTERVIEW` stands as previously decided: the shared Menu 1/2/3
migration's `InterviewHub.tsx` hunk was intentionally excluded from the isolated
candidate to avoid taking ownership of protected Interview concurrent work,
even though the diff itself was independently verified safe. **Decision:**
stays deferred; not a blocker for this RC since the excluded file remains
byte-identical to base HEAD in the candidate (verified at commit time).

## R14 — 3 genuinely open atoms, three different reasons

| Atom | Disposition | Reason | Decision needed from |
|---|---|---|---|
| T31-TABLE-T13 | `BLOCKED_PRODUCT` | Overlaps T32 Summary's column scope; building it without a decision risks duplicating or conflicting with T32. | Piotr/product — which surface owns this column |
| T33-TABLE-T13 | `OPEN_CONFIRMED` | R14's own report called this "stale/unverified" against current source; genuinely not investigated this session. | Next implementer — needs a fresh preflight, no decision blocker |
| T33-TABLE-T14 | `BLOCKED_ROUTING` | A shared `setSearchParams({...}, {replace:true})` call prevents browser tab history; this is an architecture-level fix touching shared routing code, not a T33-local change. | Piotr/architecture — whether to change the shared routing call's `replace` behavior program-wide |

**Decision:** T31-TABLE-T13 and T33-TABLE-T14 are the two closest things to
"irreducible product decisions" in the whole backlog; T33-TABLE-T13 is
ordinary unfinished work, not a blocker.

## R26 — superseded, not blocked

Retired as a registry-owning package (R15 already closed T36–T38 18/18 with a
complete, independently-verified diff; R26's own claimed files never produced
anything beyond that). Its 3 real, unrelated P1 atoms (T36/T37/T38
`MENU_1_2_3-M05`, navigation-tab counter removal) remain `OPEN_CONFIRMED` —
ordinary future P1 polish, not part of this RC, no decision required.

## R22/R23/R24/R25/R28 — real, ordinary open scope (89 atoms across these + R26)

The large `OPEN_CONFIRMED` bucket (89 atoms) is P1/P2 polish and a handful of
unaddressed P0s (R23's 5 Menu atoms for T23/T24) that this session's parser
found no concrete file/test evidence for. **Decision:** none of these block
the RC — they are isolated (each lives in its own component/test files, no
shared-file entanglement with the accepted candidate), cause no regression
(nothing in the accepted 115+3 files depends on them), and the reconciled
tracker does not claim them as repaired. They are simply the next queue for
whichever worker picks this program back up.

## Gate 4 visual gaps (see EXACT_SHA_VISUAL_MATRIX_2026-08-08.md)

Two specific claims from the predecessor's handoff could not be independently
reproduced this session (Outputs "All N" status chip; Initiatives populated
row + preview + kebab). **Decision:** not classified as a confirmed
regression — plausible harness-mock causes were identified but not proven —
and not silently accepted as passing either. Downgraded the two affected
atoms (T22-PREVIEW-P01, T22-KEBAB-K01) to `VISUAL_PENDING`. This needs a
short, dedicated follow-up session to isolate root cause before either
atom can honestly move to `VISUAL_PASS_EXACT_SHA`.

## Summary: what actually remains for Piotr

Of everything above, exactly two items are genuine product/architecture
decisions rather than ordinary unfinished work or a scope choice already
made:

1. **T31-TABLE-T13 vs T32** — which surface owns this column.
2. **T33-TABLE-T14's shared routing `replace:true`** — whether to change
   shared tab-routing behavior program-wide to support history.

Everything else in this document is either already decided (protected
domains stay untouched pending a separate unlock decision), ordinary open
work (no decision needed, just implementation), or an honestly-flagged
verification gap (needs re-checking, not a decision).
