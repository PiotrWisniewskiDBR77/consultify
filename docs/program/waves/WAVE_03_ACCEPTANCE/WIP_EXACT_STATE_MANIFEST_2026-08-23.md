# Consultify — exact-state manifest WIP

Captured: 2026-08-23
Purpose: preserve and identify all observed working states before any further consolidation
Disposition: `READ_ONLY_INVENTORY / NO CLEANUP AUTHORIZED`

## Primary checkout

- Path: `/Users/piotrwisniewski/Developer/Consultify`
- Branch: `codex/wave3-16-module-acceptance-20260821`
- HEAD: `ca9ef20646584f4b41bd5732eda3eca993ba0b73`
- Tracked binary diff SHA-256: `3c396c235d3ecf8d45564ece3cbefbb8c2fa7470cdfa1b48ca580146a082e4db`
- State: dirty, intentionally preserved.

Tracked modifications:

- `src/components/Discovery/DiscoveryToolsHub.tsx`
- `src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInputExplorationPhase.tsx`

Untracked top-level packets:

| File                                                        | SHA-256                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `CHAT_TO_TOOLS_IMPLEMENTATION_RECONCILIATION_2026-08-23.md` | `da1618c38ac6ca6d8db46f44649ae4fa27bfc48110c312ef479275ff4e49d0c4` |
| `OWNER_NOTES_CHAT_TO_TOOLS_2026-08-23.md`                   | `555e8fb8a79e6f8e0728b7518726f5f90786f4110b1f423727f5aa88f54239c5` |
| `THREE_HOUR_CTO_HANDOFF_2026-08-23.md`                      | `b9254c4c6140d91c962096ce2936ba604ee89d35a86aa67c2700c26c0e53abc1` |
| `SWOTInputExplorationPhase.ownerFeedback.test.ts`           | `39ff694121479059247faa9326eb772ca339801e652dcd0e7d9f37ccc0d056b9` |

## Assessment owner-feedback packet

| File                                              | SHA-256                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `ASSESSMENT_WORKSHOP_PACKET.md`                   | `0e031d2bc4edd8d7fb3edd555de03d6f33661dc1514a7829c2fade9d7a6ef5c1` |
| `EVIDENCE_INDEX.md`                               | `1d49336559b465b639848bb86352f65ebe35788de13efb45a045b103e5bc3c25` |
| `OWNER_FEEDBACK_REGISTER.md`                      | `e42f51a903b430950bc3055970855e30729c0461274816f35133515dc3457f20` |
| `ASM-EVD-001_LIBRARY_CURRENT.png`                 | `0f21dc4b86904a69d0bb181d3fd52108b0fbc88b209a5f6ff32a9058d2f63022` |
| `ASM-EVD-002_LIBRARY_CATALOG_AND_START.png`       | `3676d5807cea2253c008f269f850abe34047e0b539abd778dcea216b8c838d11` |
| `ASM-EVD-003_FROZEN_SESSION_REJECTED.png`         | `85a4e41444dfbb9c228d3f81469f8a09170096382639e2c2a588714d0e89f9a0` |
| `ASM-EVD-004_PROCESSES_TABLE_APPROVED.png`        | `585fbd965a639a73a64e0d8c94d10abeab935f582e4d5371da700343b3a416de` |
| `ASM-EVD-005_PROCESS_PREVIEW_HEIGHT_REJECTED.png` | `5668ab7dfdb2dc1be05f0b40eebf6f71dede661dbc423350711478b4b87353b3` |
| `ASM-EVD-006_OUTPUTS_CURRENT_ERROR.png`           | `6998a33ef159835623daee469f5b93d0ba1481178186788eb9a82a7088e74f24` |
| `ASM-EVD-007_REPORTS_EMPTY.png`                   | `04e23c577075d539332d53f75e828fece94899eea021e931a202a1a4bd37508e` |
| `ASM-EVD-008_INITIATIVES_EMPTY.png`               | `190d18c91ec17eef2fcf6d7df9789111173ecc3d1a1f501a16dfdc6da147b24e` |
| `ASM-EVD-009_TOOL_SURFACE_MISSING.png`            | `5d8b43d9c5e9c35a5b5c947c93c632d65e2092581cd1922cb737dccfb74e385a` |
| `ASM-EVD-010_ACTIVE_WORKSPACE_OVERLOAD.png`       | `7f11fabf10296b6b9f44412766a596bc02deb045fae16133a3c95f4638636f2b` |
| `ASM-EVD-011_PRIOR_MATRIX_WORKSPACE.png`          | `a8b6788ddfb6ae4b3a034e5c0951d00ab1c90eb48351f7a788de2ba9938333f7` |
| `ASM-EVD-012_PRIOR_MATRIX_FULLSCREEN.png`         | `2d68859a16207ee24ebf72e809f0b604b611bbdc4e537369323094507016729a` |
| `ASM-EVD-013_PRIOR_MATRIX_SCROLLED.png`           | `5c89f22f8171983d3d08b9468890c9a3ab8aea9f390ac05827f47c0eb16c0b35` |
| `ASM-EVD-014_PRIOR_MATRIX_EDITING.png`            | `0dc818c78be8508f7bdbad6941f5caa2d7833ceb7dd07d8ce7477a8d8a819b38` |

## Other observed worktrees

| Path                                                             | HEAD           | Observed state                                                                                                                   |
| ---------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `/private/tmp/consultify-staging-exact-e6ca`                     | `e6ca206c0035` | dirty: `server/src/index.ts`; diff SHA-256 `7115a55dc4509f922d0adaba48325908434849eebffa5e6c2fff12a2eea12120`                    |
| `/private/tmp/consultify-swot-review-1fce2f0631`                 | `1fce2f0631af` | clean                                                                                                                            |
| `/private/tmp/consultify-visual-f9flsw`                          | `72a590b0b6d3` | clean                                                                                                                            |
| `/private/tmp/consultify-wave3-finance-candidate`                | `b834519c5bce` | large dirty Finance WIP; diff SHA-256 `e3d501c8061fc105d5cd1ae3cffa65f987e76f579366517713ad56c44bd1ac08`                         |
| `/Users/piotrwisniewski/.codex/worktrees/1ad1/Consultify`        | `ca9ef2064658` | completed agent task, dirty inherited/agent WIP; diff SHA-256 `5a1c0b58e4f37b74f2d09369289e4c3b29902e8e7c093ebba6f183570b0465b7` |
| `/Users/piotrwisniewski/Developer/Consultify-wave3-exact-83a6a4` | `b834519c5bce` | clean                                                                                                                            |

Two registered entries are not ordinary working directories:

- `/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git` — bare recovery vault, HEAD `b21affa8cd10`;
- `/Users/piotrwisniewski/.codex/worktrees/8262/Consultify` — registered entry at `9bb4a549012a`, but Git reports that the path is not a worktree.

## Safety conclusions

1. No worktree may be pruned or deleted from this inventory without a separate reconciliation of its diff and untracked files.
2. The dirty Finance candidate is independent material work and must not be folded into Wave 3 Assessment/Tools by directory-level copying.
3. The staging-exact checkout is not clean and therefore cannot be treated as an immutable deployment baseline.
4. The completed agent worktree is evidence and a comparison source only; the primary checkout remains the controlled integration surface.
5. This manifest fingerprints observed content but is not itself a commit, backup, release candidate or authorization to mutate any environment.

## Local runtime readback

Read-only verification on 2026-08-23 established:

- API PID `74822` listens on `4363` from the primary checkout;
- client PID `74844` listens on `4364` from the primary checkout;
- `GET /api/ready` returned `200`, build SHA `ca9ef20646584f4b41bd5732eda3eca993ba0b73`, database `ready`, SQL chain `ok`, `0` failed, skipped, pending or unexplained-drift migrations, and `682` migrations already current;
- the Assessment client route returned HTTP `200`;
- the API process has an established TCP connection to local port `34941`;
- port `34941` belongs to container `consultify-w3-recovered-fixtures-20260823` (`pgvector/pgvector:pg16`);
- direct read-only SQL returned database `postgres`, role `w3_recovered`, `pg_is_in_recovery() = false`.

The database does not expose a generic table named `schema_migrations`; the authoritative migration-chain result for this runtime is therefore the application readiness verifier above. These checks prove the current local topology and health only. They do not prove persistence of every module journey, Railway parity, server-side read-only enforcement, backup recovery or release readiness.

## Successor WIP snapshot after bounded Assessment remediation

Captured later on 2026-08-23, still on the same uncommitted HEAD:

- current tracked binary diff SHA-256: `f24a303ad5a9d10f5a85ad1cc1259f93d5d0b5e190507b2fa227d37edce0d5cd`;
- `AssessmentHub.tsx`: `d801ea8a892e3c7e7c99fdd18652dc7198655e7b83e8c825d802cce924a47fde`;
- `AssessmentLibraryTab.tsx`: `2040cafd98acf098a7c6c192e759f769fee53c0e75c7a64ec0f097456b5b94ea`;
- `AssessmentHub.previewHeight.ownerFeedback.test.tsx`: `2d1a6db7aaf90ed2028fd29511c8a6fc4b42fc35961370bdbb35952a089617d2`;
- `AssessmentLibraryTab.test.tsx`: `f9246e2a023cae6f7874dacd329fbad0f13f2cb156e8d935b43ab68046c37181`;
- Assessment owner register: `4a69ca9325c61c6ff2644d9a35522558e6871bd2bd7adea9a761c80ed1839a81`.

This successor adds only the owner-requested full-height Processes Preview and pure-Library boundary plus their tests/register evidence. Earlier hashes above remain the evidence of the preceding checkpoint, not the current aggregate state.

## Successor WIP snapshot after FLOW, NFR and decision-packet reconciliation

Captured later on 2026-08-23, still on branch
`codex/wave3-16-module-acceptance-20260821` and uncommitted HEAD
`ca9ef20646584f4b41bd5732eda3eca993ba0b73`:

- tracked binary diff SHA-256:
  `255db0dcbe410d5f86c0f2e7340795bb7c041a1460dd4a13b173bb6e73bfd9ce`;
- complete porcelain-state SHA-256:
  `4bbab9093f33a11ecca8e58a488b5928f044bc574c4bfe7e30945bede2f3a58d`;
- remaining-nine register:
  `d0c7fcaf7bc46adabc2972678b1b9b59d57de2be8af20c033a1a29dc3250da10`;
- NFR current-source reconciliation:
  `4de3d14d91e4e4a426afbd6d95e2c05150a9f45e551c235f326e8146dc63c194`;
- Settings deletion decision packet:
  `c0f1127b41fc979f900bd8c890afd3226c9a84586c190c70ff4a96d56bf7c627`;
- Partner economics decision packet:
  `45ce2e67c4bd07f43d14df68dbc5059a6b035f3842a92b74b23a7f7f0b35cea4`;
- Chat-to-Tools reconciliation:
  `4ea787e84aabffd46bcfea14058d388c28497fd0f6e98eb2954dac35f4884cbc`;
- three-hour CTO handoff:
  `622393e2be86df6eafcf0682d79c4378d36540650b1ce476d165131bf8fdbc23`.

This snapshot preserves the post-agent `274/274` focused result, the
byte-identical FLOW and NFR allowlist findings, and the two new fail-closed
decision packets. It is still an inventory fingerprint, not a clean candidate
SHA, commit, release bundle or permission to remove any retained worktree.
