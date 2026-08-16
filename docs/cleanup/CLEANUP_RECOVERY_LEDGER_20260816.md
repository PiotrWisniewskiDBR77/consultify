# Consultify cleanup recovery ledger — 2026-08-16

## Status vocabulary

- `INTEGRATED_PENDING_VERIFICATION` — present in candidate, acceptance gates open
- `INTEGRATE_SELECTIVELY` — valuable source package; replay allowlisted commits
- `BLOCKED` — no integration until the stated decision or reconstruction
- `SUPERSEDED` — branch-level merge prohibited; preserve evidence or selected files
- `QUARANTINE_EVIDENCE` — retain unchanged until recovery is proven
- `PRUNE_LATER` — deletion only after a manifest and recoverability proof

## Package ledger

| Package | Source SHA | Decision | Blocking evidence / next action |
| --- | --- | --- | --- |
| Baseline demo | `e45904dc7940f259b9cf017c283264d5c166c9ab` | canonical baseline | Never infer production readiness from this role. |
| Assessment | `031772082b7d4925e11986016079d02adeb17382` | `INTEGRATED_PENDING_VERIFICATION` | Five-surface production-route mount passes in Chromium against fresh PostgreSQL. Library-to-session, registry unification and full golden journey remain open. |
| Assessment clean handoff | `0f0bce1c9954681ef8e01618529f10614d9de951` | `INTEGRATE_SELECTIVELY` | Diverged from demo; use as source for later fixes/evidence, not branch merge. |
| Tools | source `b8d5747e53936ec130bc80c43e868e71f1fa2b60`; candidate `4cd5d54317` | `INTEGRATED_PENDING_VERIFICATION` | 49 patch-unique non-merge commits replayed. Static/type/discovery pass. Fresh strict PostgreSQL applies 703/703 then 0; full realDB denominator passes 12/12 files, 100/100 tests after schema-parity repair. Browser E2E and initiative-quality acceptance remain missing. `RUNTIME_ACTIVE=0` remains literal. |
| Audits | source `1927914dddad0e2932bcd5238ff6eb611859e4cf`; candidate `ff2d3dfd8e` | `INTEGRATED_PENDING_VERIFICATION` | 34 patch-unique non-merge commits replayed. Fresh isolated realDB passes 32/32 files and 259/259 tests. Five-surface production-route mount passes in Chromium using an explicit staging-only flag override. Full audit golden journey and owner flag decision remain open; default stays OFF. |
| Case / Agent | `adf77cb833ec8b79e138d2ece96e7f5aafbe2ec0` | `ALREADY_PRESENT / KEEP_EVIDENCE` | All 782 source files exist; dedicated 110 services, 39 routes, 19 UI files and 19 migrations are byte-identical. Replay allowlist is empty. Run fresh Case gates; do not replay 120 stale/noisy commits. |
| Artifact Studio | `64715cdd37515b865e68d969eab71cdd7e2b60b3` | `ALREADY_PRESENT / KEEP_EVIDENCE` | Tree proof supersedes noisy patch-id: 44/48 source-touched paths are byte-identical and four are newer on candidate. Replay allowlist is empty. Source-derived focused suite passes 15/15 files, 145/145 assertions; realDB/browser/human gates remain. |
| Finance | `c78086057d38f57c5351c6254d41f02fd50246b6` | `ALREADY_PRESENT / EVOLVED / RUNTIME_NOT_VERIFIED` | No replay: dedicated source surfaces are present and six differences are later candidate evolution. Prove one governed runtime owner across compatibility/V8 routes, OFF/ON flag behavior, version identity, fresh-DB lifecycle and the Results projection seam. |
| Results | `5afefe8bb82fc1791c7f72c8c64a8205abd87f00` | `ALREADY_PRESENT / EVIDENCE_PARTIALLY_QUARANTINED / BLOCKED_DATA_AND_MOUNT` | No replay: dedicated runtime is present; 954 missing source paths are QA screenshots only and 23 shared paths evolved later. Owner/access, default-OFF mount, deterministic role fixtures, Finance projection ownership and fresh SHA-bound browser evidence remain open. |
| UX recovery | local `c67726e98bcde5a9b129d09885bfb5104896bbf4`; remote `c6878103b4d43563bc1adbf6f885990340dc52e4` | remote `ALREADY_PRESENT / EVOLVED`; local `SUPERSEDED / SCOPE_CLEANUP_ONLY` | Remote is candidate ancestry; six-file allowlist has 4 identical, 2 evolved, 0 missing. Do not replay local revert: it would remove active focus-governance files. |
| UI45 | `64856e790afd0a66547d993fba13769878669c62` | `SUPERSEDED` | Preserve evidence and reconstruct only current-canon files. |
| CEPD | source `99b1fcf7d67fe30bb15e089cfbf5650ce54a9ea1`; recovered hunks from `732e460ed27fd3dc70d99623625e08b5f47a1548` | `INTEGRATED_SELECTIVE / VERIFICATION_REQUIRED` | No CEPD path is missing. Only integer PostgreSQL evidence ingestion and a 12-second AI-review timeout were absent and are now applied surgically. Focused Interview route/security tests pass 61/61 and type-check passes; fresh-PG write/readback and forced-timeout browser proof remain. |
| Ideas / My Work transformation | `4b634dc21ee476eab97f09b8a41ec2c8c10111dd` | `ALREADY_PRESENT / EVIDENCE_QUARANTINED` | 461 source paths are identical and 12 evolved later. All 363 source-only paths are historical QA screenshots; runtime replay allowlist is empty. |
| My Work Core | `a0741afbef96f9821e6db6f8b52579e8a3b71474` | `ALREADY_PRESENT / SUPERSEDED` | Candidate contains the extended `m02p03` lifecycle migration and current idempotency behavior. The old Radar default-ON helper is intentionally superseded by literal `RADAR_ENABLED=false`; replay allowlist is empty. |
| Initiatives + Execution | `bba792eabc133696ecdc4adcaf810e3642f0337c`; later evidence `599f50932dfd8de63db96b4557fcad08ffb02a2f` | `ALREADY_PRESENT / EVOLVED / VERIFICATION_REQUIRED` | No dedicated source-only code, migration or test path is missing. Candidate preserves later lifecycle, closure, capability, execution-spine and KPI-impact controls. Replay allowlist is empty; fresh runtime gates remain. |
| M06 Execution | `4256348c963ac2cde9b3ecb40a5df852d03a5ec7` | `SUPERSEDED_IMPLEMENTATION / KEEP_HISTORICAL_EVIDENCE` | Dedicated implementation is represented by the evolved candidate. Do not replay. |
| Chat / Teresa | `023b818ac6354dbbd5ac48b0514279e0c73ea8d3` | `ALREADY_PRESENT / EVOLVED_SAFER` | Three governed-handoff paths are exact; `WorkCanvasDocumentPanel` retains the handoff and adds user-mediated concurrent-save recovery. Replay allowlist is empty. |
| Broad helper tip | `111868e07ab0fec15b4db7604b0cd400a93e3192` | `SUPERSEDED_BY_EVOLVED_CANDIDATE / EVIDENCE_ONLY` | Zero missing runtime/test path. Eight source-only files are historical Ideas PNGs; do not replay the mixed 75-path tip. |
| Auth sweep | `d07c483dc7ee76a940c154e3d038b4d476641738` | `ALREADY_PRESENT_EXACT` | All four scoped skills-gap authentication paths are byte-identical. Replay allowlist is empty. |
| SAML / automation security | `6e9657f562e89cc13136cc548b198ffc1662a5cd` | `ALREADY_PRESENT / SECURITY_EVOLVED` | Three scoped paths are exact. Candidate SSO retains fail-closed signature verification and adds stronger encryption-at-rest evolution; automation remains fail-closed without a sandbox. Replay allowlist is empty. |
| Frozen main worktree | `869f9c322c61f01030c2900ea9c79ff046707f00` plus local state | `QUARANTINE_EVIDENCE` | Never reset, clean, stash, or merge as a unit. |

## Worktree and branch policy

- All 352 registered worktrees remain protected during module recovery.
- Three formally prunable entries with missing gitdirs remain `PRUNE_LATER`
  until their branch and tip SHA are preserved in the final quarantine manifest.
- Branches sharing identical tip SHAs are deduplication candidates, not proof
  that their worktrees are clean or disposable.
- No local or remote branch ref is deleted before its patch identity is mapped
  to the accepted candidate or to a recovery bundle.

## Executed stale-worktree retirement

The following three registrations pointed to already-missing temporary
directories. Their recovery pointers were verified before pruning the stale
registration; the branch refs and commit objects remain intact.

| Missing worktree path | Preserved branch | Preserved tip | Disposition |
| --- | --- | --- | --- |
| `/private/tmp/claude-501/-Users-piotrwisniewski-Library-Mobile-Documents-com-apple-CloudDocs-Documents-Antygracity-DRD-consultify/36376f43-9305-403d-84dd-af2d35aa4554/wt-mail` | `fix/email-obserwowalnosc-2026-08-10` | `9f71294f13b8fb528c9fbb28a886c157889e090c` | `PRUNE_REGISTRATION_ONLY` |
| `/private/tmp/consultify-artifact-qa-292bafd4` | `codex/artifact-studio-remediation-20260812` | `b79fc79554a5780614823f1d860d0f6301a67efe` | `PRUNE_REGISTRATION_ONLY` |
| `/private/tmp/consultify-cepd-fix.qD53l6` | `codex/cepd-interview-prod-fix-20260814` | `99b1fcf7d67fe30bb15e089cfbf5650ce54a9ea1` | `PRUNE_REGISTRATION_ONLY` |

This operation does not classify the preserved branches as disposable and does
not authorize deleting their refs.

## Generated worktree disposition

The deterministic manifest in
`evidence/WORKTREE_DISPOSITION_20260816.{md,json}` inspected every registered
worktree, including ordinary status and ignored paths. The first accepted
manifest at `1ca9d0c06b509dcf6ede144770fb3520ae6d3e7a` found:

- 1 canonical candidate;
- 1 frozen source quarantine;
- 137 dirty worktrees retained in quarantine;
- 178 worktrees with ignored evidence or unmerged state retained for review;
- 32 clean worktrees whose commits are represented by the candidate and whose
  only ignored content is reproducible (`node_modules`, build output, caches or
  test reports), eligible for checkout retirement while preserving branch refs.

All 32 eligible checkouts were then retired by the fail-closed verifier
`scripts/cleanup/retire-represented-worktrees.mjs`. Before every removal it
rechecked the exact path, HEAD, ordinary status, ignored allowlist and candidate
ancestry. No branch ref was deleted. The post-action manifest at
`b7d6bc3c43b30b84281573b4a15bc5ab5e2fda56` contains 317 worktrees: 1
canonical, 1 frozen source, 137 dirty quarantines and 178 ignored-evidence or
unmerged quarantines; zero further checkout is prune-ready.

The current generated manifest, observed at candidate `4bf0c299abcc3aee49936438f53e4e35cc382486`,
contains 317 worktrees: 1 canonical, 1 frozen source, 137 dirty quarantines and
178 ignored-evidence quarantines. Zero checkout is prune-ready. The generated
decision is path-specific. It never authorizes deleting a branch ref, and it
must be regenerated after any worktree or candidate change.

## Generated local-branch disposition

`evidence/BRANCH_DISPOSITION_20260816.{md,json}` deterministically accounts for
every local branch ref at candidate `4bf0c299abcc3aee49936438f53e4e35cc382486`:

- 1270 local refs covering 1071 unique tip SHAs;
- 560 refs whose commits are ancestors of the candidate;
- 82 unrepresented refs sharing duplicate tips;
- 628 unrepresented single-tip refs;
- 649 unique unrepresented tips retained in quarantine.

The last two classes are an explicit `QUARANTINE_BACKLOG`: preserved and
excluded from canonical execution, but not semantically reviewed, disposable,
prune-ready, or authorized for deletion. Named high-value package families are
resolved separately in the package ledger. Unknown-but-contained history is
therefore not an unknown integration input and does not block repository cleanup
closure; it remains recoverable historical backlog outside the completion plan.

## Planned recovery order

1. Assessment verification and missing entry/source-of-truth resolution
2. Tools browser verification and initiative-quality gate
3. Audits browser verification
4. Case and Artifact verification (no replay)
5. Results and Finance runtime owner/data/mount verification (no replay)
6. CEPD fresh-PG and timeout verification (two hunks already recovered)
7. UX verification only (no reconstruction/replay)
8. Worktree and branch deduplication
