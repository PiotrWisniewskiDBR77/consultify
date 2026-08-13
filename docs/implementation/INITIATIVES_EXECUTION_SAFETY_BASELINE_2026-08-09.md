# Initiatives + Execution — isolated implementation safety baseline

Status: active implementation control
Created: 2026-08-09
Owner: Codex `/root`

## Isolation

- source worktree: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify`
- source branch: `codex/sync-demo-20260729`
- source baseline SHA: `635fd2d48d5a396c45bcb43b7f363535403ecf93`
- source dirty entries at isolation: `323`
- implementation worktree: `/Users/piotrwisniewski/Developer/consultify-initiatives-execution-20260809`
- implementation branch: `codex/initiatives-execution-20260809`
- implementation starting SHA: `635fd2d48d5a396c45bcb43b7f363535403ecf93`
- implementation starting status: clean

## Safety rules

1. Never reset, clean, stash, stage, commit or rewrite the source worktree.
2. Never bulk-copy source dirty files into this worktree.
3. Treat every source modification as foreign until ownership, semantic fit and exact diff are reviewed.
4. Port only allowlisted hunks with recorded source path and rationale.
5. Preserve `UNKNOWN`, `BLOCKED`, `PARTIAL`, `EVIDENCE_MISSING` and `PRESENT_NOT_ACCEPTED` literally.
6. No migration, write path or feature enablement without rollback and realDB evidence.
7. No merge/push/deploy without separate authorization.

## Canon source snapshot

The owner-approved canon currently exists as untracked documentation in the source worktree. It is referenced read-only until a controlled import package is prepared.

| File | SHA-256 |
| --- | --- |
| `INITIATIVES_EXECUTION_FUNCTIONS_CANON.md` | `363eb53f059a50bd39080524d415aa9a0b0952dbfcb37d6e75f17469fd3baf9e` |
| `00_INDEX_AND_AUTHORITY.md` | `919c027ce9efc4a8cc34cc99dfc58fabf344e60d4c19be543454cbe1b08d347c` |
| `01_PROCESS_GOVERNANCE_AND_GATES.md` | `692b86224ce76acf804591515dce7ff58efa08738785d9cc27539ce9d9f8459b` |
| `02_FUNCTIONAL_CONTRACTS.md` | `ab9a6dbaf8febcd9a51f42170bad43928e15415f03136b6e04f03adb381e36ae` |
| `03_UI_UX_AND_INTERACTION_SPEC.md` | `7a9d6c0b24a7fbb616ae420beee0bdccd065946c6edd45ab3f61f59bf76bfe64` |
| `04_SURFACE_DESCRIPTORS.md` | `f48f735e43becae81174e08e6367f2fad17c218b5c0ee5dd93f8cb76324b929e` |
| `05_DOMAIN_DATA_API_EVENTS.md` | `9099703ba724727ca1ee3553a1a5ded8a906d6b223e506c74e336153d58be642` |
| `06_RUNTIME_MIGRATION_REUSE_AND_TESTS.md` | `428998c196e78cacb29e6b58744e085ce0a1727fc1a306f7b4dcdb517214b88e` |
| `07_IMPLEMENTATION_SEQUENCE_AND_DOD.md` | `30b458e51db6fb7f71a309b0ddf616ca1b46df1445b49ea49123ef3fc0a1d324` |
| `08_ACCEPTANCE_SCENARIOS.md` | `f732e525d636d18c7e2f88006963c62a1bfc98cbad4b1ebf0e5c74dbd58350ad` |
| `09_GLOSSARY_DECISIONS_AND_TRACEABILITY.md` | `89da486ba7fa7b0c17a16efe61a27ec90be35be9c47f7a2d05dfbc5cbbc19cd2` |
| `10_OWNER_DECISION_PACK.md` | `23589b1d2fb968738993a76ca6238dea1d35393ffb89a34df6ccd179cf8b3519` |
| `11_INITIATIVE_CARD_SYSTEM.md` | `2a3b9a3fd0e4ec6b57f05d4a517ce4678159a7799a13668dac2bd70fa7f7b8a2` |
| `12_TASK_DECISION_MY_WORK_INTEGRATION.md` | `2e198c0ff3427774fe0cb9e53dc481e18cb0e018a209d46ab45a0ce44cd6df6f` |

## First implementation gate

Before the first runtime edit:

- compare committed baseline with source dirty versions of Initiatives, Execution, My Work and shared table components;
- establish a file/hunk ownership and reuse ledger;
- import and checksum-verify the canon through a controlled package;
- select the smallest Slice 0 contract/test allowlist;
- keep all user-facing feature flags off.
