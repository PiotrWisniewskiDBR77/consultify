# IE01 native Milestones / Tasks split — independent bounded review

Date: 2026-09-13
Reviewer: Sol independent reviewer
Product worktree: `/Users/piotrwisniewski/Developer/codex-wt/codex-initiative-card-split-20260913`
Base HEAD: `69dbb5b746aa870f5e5d93e840906604557a5276`
Scope: five frozen product/test files plus exact seven-file test denominator; no product edits, DB, build, route, schema, migration, flag, commit, push, or deployment.

## Verdict

**HOLD.** The native runtime-v1 Tasks/Milestones split is behaviorally GREEN on its declared 28-test denominator and the missing historical RED was independently recovered on the clean base. Two actual-host compatibility/authority defects remain in `InitiativeDocumentView`:

1. Legacy records lose the existing combined Tasks + Milestones surface.
2. The new Milestones card exposes its create affordance when the document gate denies card edits.

Both defects are narrow at the two direct `TasksMilestonesSection` mounts. The section split itself, canonical 26-card/8-readiness denominators, task/AI isolation in Milestones mode, server-returned milestone identity, failed-create no-phantom behavior, and runtime-v1 actual-host navigation passed the frozen tests/source review.

## Finding 1 — introduced legacy compatibility regression

File: `src/components/Initiatives/InitiativeDocumentView.tsx:7876-7887`.

The pre-existing `tasks` case now always mounts `TasksMilestonesSection` with `presentation="tasks"`. The separate native `milestones` section is appended only for runtime-v1 records at lines 6004-6008. A legacy record bypasses `canonicalInitiativeSections`, retains its single Tasks/Milestones card, and therefore has no second Milestones card from which to reach milestones. The new forced Tasks presentation removes milestone rows/actions from that legacy card.

Actual-host reproduction uses the real `InitiativeDocumentView` with a legacy record, the real section builder/canvas and native task/milestone API-shaped rows. Expected the existing Tasks card to show both rows; the milestone row is absent.

Required behavior: the Tasks mount selects `presentation={isRuntimeOnlyRecord ? 'tasks' : 'combined'}`. Preserve the new separate Milestones owner only for runtime-v1 records.

## Finding 2 — introduced authority leak in the new Milestones mount

Files:

- `src/components/Initiatives/InitiativeDocumentView.tsx:7921-7929`
- `src/components/Initiatives/sections/TasksMilestonesSection.tsx:1090-1118`

The new direct Milestones mount does not pass `readonly`. The section treats undefined as editable and renders `Add milestone`; `canEditCards` already folds both gate capability and document Preview mode, but that value never reaches this mount.

Actual-host reproduction uses the real `InitiativeDocumentView` with `gate.capabilities.cards.canEditCards=false`. The mounted card still contains `Add milestone`.

Required behavior: pass `readonly={!canEditCards}` to the new Milestones mount. The neighboring direct Tasks mount has the same inherited omission and should receive the same prop while it is touched, without changing its server protocol.

## Independently recovered matched RED → GREEN

The checkpoint's original narrative RED had no preserved raw artifact and is therefore **EVIDENCE_MISSING** as historical evidence. I created a detached sparse scratch worktree from exact base `69dbb5b746aa870f5e5d93e840906604557a5276`, copied the exact latest two changed/new test blobs, and ran the same seven-file/28-test command used for GREEN.

Scratch worktree: `/Users/piotrwisniewski/Developer/codex-wt/codex-ie01-card-split-red-sol-20260913`

Exact copied test blobs:

- `TasksMilestonesSection.cardSplit.behavior.test.tsx`: `eb481efe866f2b35bf5a03021226d37e80f5b18d`
- `InitiativeDocumentView.canonicalNavigation.behavior.test.tsx`: `c828513cfbddf193adad3cc84169afb37f51546d`

Base result: **23/28 PASS, 5/28 FAIL, exit 1**. The five exact failures cover mounted legacy milestone leakage after Tasks switching, milestone-only still showing a task, tasks-only still showing milestone controls, adapter switching still retaining task content, and missing rendered server milestone identity.

Raw base RED:

- `IE01_CARD_SPLIT_SOL_BASE_RED.json` — SHA-256 `5d1026ff77d42799bb5f6f572c5a53ce475810e5e0fed5018c0919aa19496075`
- `IE01_CARD_SPLIT_SOL_BASE_RED.log` — SHA-256 `272bac7070f9c76913913124087bf21aae417ac7ee244ef73d014886326a1556`

Frozen WIP result on the identical command and 28 full names: **28/28 PASS, exit 0**.

Raw independent GREEN:

- `IE01_CARD_SPLIT_SOL_GREEN.json` — SHA-256 `54564bb5300eecf3b01ca3849c9df1dde7065f91e12d66322d25f2f35c17d2af`

## Additional actual-host probes

An additive test copy in the detached scratch worktree keeps the real `InitiativeDocumentView`, section builder, left navigation, canvas and Tasks/Milestones renderer; it mocks only the established data/child dependencies from the frozen host test.

Result: **3/5 PASS, 2/5 FAIL, exit 1**. The two failures are exactly the findings above.

- `IE01_CARD_SPLIT_SOL_HOST_PROBES.json` — SHA-256 `29697e04fe74cc1c3d6cc3b7e272fb419f1b2a60bc554d1576e3510afb88f0e9`
- `IE01_CARD_SPLIT_SOL_HOST_PROBES.log` — SHA-256 `6247e1f6c9a0f906eb68ac9a17cde395255178e84765183f4a79b0f7f1250d8c`

The earlier single capability probe is superseded by this combined two-finding probe.

## Frozen file identities reviewed

| File | Git blob | SHA-256 |
| --- | --- | --- |
| `src/components/Initiatives/InitiativeDocumentView.tsx` | `52c87ee206662f1cfb3496a01c588c5e2379738f` | `e8d573a6b2a96e0761ed500a6f5681610867953e8e2ca5f830ff136bbde63f56` |
| `src/components/Initiatives/canonicalInitiativeSections.tsx` | `a2ef846932918b0ad3992df8b48bdf443d0f294c` | `2964315f7e82f79631ce69cca271b7934e8d9ff666722faf01340ad350cce8d5` |
| `src/components/Initiatives/sections/TasksMilestonesSection.tsx` | `4998ad888fa6b4774c58b1689693f8d0d0cf3a1c` | `b1b6d8e8c1f2f122a96d63986ebbe4b16c32e1560045d1cb197e68445412b54c` |
| `tests/components/Initiatives/TasksMilestonesSection.cardSplit.behavior.test.tsx` | `eb481efe866f2b35bf5a03021226d37e80f5b18d` | `223a7d18799ee792a1d9e6af520f8230d79b642a5c4066f40431afff9778975b` |
| `tests/components/Initiatives/InitiativeDocumentView.canonicalNavigation.behavior.test.tsx` | `c828513cfbddf193adad3cc84169afb37f51546d` | `16b75fc317014240e885125dc4ee12ba9b1a9509230a6cd2163c1d6072ae38e0` |

## Accepted bounded behaviors

- The card registry remains exactly 26 unique business cards; Tasks and Milestones each occur once.
- Definition content/readiness remains the existing exact eight-card denominator.
- Runtime-v1 canonical adapter consumes distinct native `tasks` and `milestones` owners; neither leaks into workspace utilities.
- Milestones presentation does not run the task AI request, task toolbar trigger, task rows, or Task writes.
- Tasks presentation does not start the milestone reader or render milestone controls.
- Default `combined` still works when the component is mounted without a presentation prop; the host regression is that the legacy host no longer uses that default.
- Milestone creation appends the server-returned ID and rejected POST does not append a phantom row.
- The new runtime-v1 Milestones card mounts in the actual document host even when template section data has no dedicated milestone section.

## Retest needed for acceptance

Keep the exact 28 existing full names, add the two actual-host assertions from this review, and require **30/30 PASS** on the corrected frozen source. No broader IE01 acceptance is implied.
