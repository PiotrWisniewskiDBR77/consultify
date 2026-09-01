# Batch 241–269 — staging integration manifest (2026-09-01)

## Control decision

- Candidate branch: `codex/m03-admin-batch241-269-integration-20260901`.
- Exact base: `github-backup/codex/m03-admin-20260824@7a733cb63da2911983afdf58c6a9531e34bf2c3c`.
- This file is an integration report under the already permitted `docs/program/waves/WAVE_03_ACCEPTANCE/codex` evidence area. It is not a new architecture or source-control SSOT and does not supersede `CANONICAL_16_MODULE_SOURCE_CONTROL_MAP_2026-08-24.md`.
- The duties descend from `df7f13056fa24995be07f64b0e8c877b3faeab45`; the required staging base is a later descendant. Selection was therefore commit/path-by-path. No duty branch was merged wholesale.
- Remote verification was performed after `fetch github-backup --prune`; every SHA below is the exact fetched `github-backup` tip. Pushes were made only to `github-backup`. No `origin`, Railway, deploy or release write occurred.
- Statuses such as `PARTIAL`, `STOP`, `NOT_PROVEN`, `EVIDENCE_MISSING` and owner-review gates remain binding exactly as recorded in the imported duty reports. Presence in this candidate is not acceptance or completion proof.

## Source and disposition map — denominator 28

| Duty | Exact remote source | SHA | Disposition | Integrated scope |
|---:|---|---|---|---|
| 241 | `codex/day241-inicjatywy-20260901` | `1a344473398408d1bb795e6e25d92c514f972e89` | `DOC_EVIDENCE_ONLY` | report + additive Initiatives acceptance entry |
| 242 | `codex/day242-uprawnienia-20260901` | `6a717891e23ef8cf4a3d8c8e7bb16cebec787c2d` | `APPLY_NOW` | three bounded tenant/authz fixes, three RealPG contracts, report, additive audit entry |
| 243 | `codex/day243-podglad-20260901` | `6daf6eef59b8996cc088ff8b20f14e804943271e` | `APPLY_NOW` | preview protocol, click-then-shoot tool/test, harness-chrome exclusion, report |
| 244 | `codex/day244-organizacja-ustawienia-20260901` | `ebe1d06a8457048c1ab84a7ee9f83d34decaac98` | `DOC_EVIDENCE_ONLY` | report + additive Organization and Settings acceptance entries |
| 246 | `codex/day246-domiar-audytu-20260901` | `15700ae53e1d3e10b9e678031b716789af6c01b0` | `DOC_EVIDENCE_ONLY` | report + additive permissions-family audit entry |
| 247 | `codex/day247-probka-naprawione-20260901-clean` | `95d28ed3b20f9c81164e82060441b7a6df83a0da` | `DOC_EVIDENCE_ONLY` | clean report + additive permissions-family audit entry |
| 248 | `codex/day248-martwe-bliznaki-20260901` | `434fff2d5f5ac712ab3a27a00fe397e7b307f3ee` | `HOLD_REVIEW` | report only |
| 249 | `codex/day249-sygnatura-bez-ochrony-20260901` | `b5970d92e366b2c215095b71b62e671e68931f6c` | `DOC_EVIDENCE_ONLY` | report + additive signature finding |
| 250 | `codex/day250-ai-ustawienia-rodzina-20260901` | `597cd34f4211b86455bc84dd1254dd61acdad5c4` | `APPLY_NOW` | effective AI-settings normalization, RealPG contract, report, additive evidence entry |
| 251 | `codex/day251-audyty-postep-20260901` | `9e7df862ea6c216a1a00c16f090b59bf7b442dba` | `DOC_EVIDENCE_ONLY` | report + additive corrections in four existing ledgers |
| 252 | `codex/day252-rozjazdy-przemiatanie-20260901` | `085ded54800b4ba5b0c62e226c7fb87f2ee81b7a` | `DOC_EVIDENCE_ONLY` | report + additive name-divergence sweep entry |
| 253 | `codex/day253-falszywe-zapisy-20260901` | `e77c826005e3ff32515f3bcba5c186d8e2e9a1de` | `APPLY_NOW` | Interview awaited-persistence fix and contract, report, additive control-rule entry |
| 254 | `codex/day254-sprzecznosci-rejestru-20260901` | `dbb57b38a71117083f59bd1690b3ec51d24886c9` | `APPLY_NOW` | bounded migration/route registry corrections, report, additive migration finding |
| 255 | `codex/day255-nazwy-agenta-20260901` | `424ebd7e5a0ab0d7ad024a3a12ec48f9fd85c1fd` | `APPLY_NOW` | truthful presentation-agent edits, three focused tests, report |
| 256 | `codex/day256-bramki-formatow-20260901` | `911c128f0f0f2b3a73580670dae8871a6997ae94` | `APPLY_NOW` | PPTX source-traceability gates and focused tests, report |
| 257 | `codex/day257-synteza-zrodel-20260901-clean` | `8215234edd5800d2ac03b4919ffbe3fa0701ba14` | `APPLY_NOW` | clean conclusion text-source grounding and focused test, report |
| 258 | `codex/day258-ai-rodzina-20260901` | `df4b4b2fcd3cbf913f79a288441e562e7be5ca54` | `DOC_EVIDENCE_ONLY` | report + additive AI proposal/approval family register |
| 259 | `codex/day259-trzy-pliki-20260901` | `b35d3da4f34d3e3f2b25de51a45f4765c943f971` | `STOP_NO_PRODUCT` | STOP report only; missing model-key gate remains unresolved |
| 260 | `codex/day260-czat-akcje-20260901` | `16b4e651820b63b24fcfb8d1eff974c56befa7c8` | `DOC_EVIDENCE_ONLY` | report + additive Chat acceptance entry |
| 261 | `codex/day261-mojapraca-kontrakty-20260901` | `b4f628dd0f437b259a4be157276a88d6d2c8aefb` | `DOC_EVIDENCE_ONLY` | report + additive My Work acceptance entry |
| 262 | `codex/day262-spotkania-bramka3-20260901` | `ccfbbfb8657e0baa3b88f238dbf7be224169f83f` | `DOC_EVIDENCE_ONLY` | report + additive Meetings acceptance entry |
| 263 | `codex/day263-partner-retest-20260901` | `e3337db99a021e88616ac3910aba4dd1c2a23f20` | `DOC_EVIDENCE_ONLY` | report + additive Partner acceptance entry; test code excluded by disposition |
| 264 | `codex/day264-wyniki-mianownik-20260901` | `ab00a593d9b0e5b35d9693771d92804bac7edc41` | `DOC_EVIDENCE_ONLY` | report + additive Results denominator entry |
| 265 | `codex/day265-finanse-zrzuty-20260901` | `2eba97278ec0a8f3b2bd31977e5851cfe4a4c6a1` | `HOLD_REVIEW` | report/status only |
| 266 | `codex/day266-wyniki-zrzuty-20260901` | `26a74823df42fa6ef56851074a6432b3a2519177` | `HOLD_REVIEW` | report/status only |
| 267 | `codex/day267-materialy-zrzuty-20260901` | `18f5537b694ab613aa8971674fb34d6e4553e21a` | `APPLY_NOW` | Materials evidence harness, verdict tool/test and report |
| 268 | `codex/day268-czat-praca-zrzuty-20260901` | `6eb28aa43d12575529d5c90fb86cf10f9050240f` | `HOLD_REVIEW` | report/status only |
| 269 | `codex/day269-audyty-narzedzia-zrzuty-20260901` | `24bcd28db8c39ed8c133b7e022c3bf99797a635d` | `STOP_NO_PRODUCT` | STOP report only; harness shape remains blocking |

Count check: `9 APPLY_NOW + 13 DOC_EVIDENCE_ONLY + 4 HOLD_REVIEW + 2 STOP_NO_PRODUCT = 28`.

## Explicit exclusions

- No wholesale duty branch merge or whole-tree copy.
- Contaminated `codex/day247-probka-naprawione-20260901@8f0eb9ba...` and `codex/day257-synteza-zrodel-20260901@ff6ce8f9...` were not used; only the exact clean SHAs named above were sources.
- Day 248 destructive deletion of 38 server route files was excluded.
- Day 265 Finance harness/product changes were excluded.
- Day 266 Results harness/product changes were excluded.
- Day 268 Chat/My Work harness/product changes were excluded.
- Day 259 product/model execution was excluded because the duty stopped at its model-key gate.
- Day 269 harness/product changes were excluded because the duty stopped on the invalid harness shape.
- Day 263's added executable RealPG retest was excluded because the disposition permits only its report and additive acceptance entry.
- Shared ledgers were merged as additive patches. The independent Day 242, 246 and clean 247 appendices in `AUDYT_RODZINY_TRAS_UPRAWNIENIA.md`, and Day 251/252 appendices in `ROZJAZD_NAZW_POL_20260901.md`, were retained together rather than choosing one branch's EOF.
- `dev-render/main.tsx` was changed only by the authorized Day 267 Materials harness atom. No Day 266, 268 or 269 harness registration was imported.
- No status was promoted to owner acceptance, release readiness, deployment readiness or complete end-to-end proof by this integration.

## Verification record

- `git diff --check` was executed after every completed integration atom and before each integration commit.
- Pre-commit artifact/crimson and density ratchets passed on committed paths.
- Focused tests used `--retry=0`. Final unique denominator: `9` test files, `22` tests, all passing after the environment was corrected:
  - Interview false-save contract: `2/2`;
  - Day 255 presentation-agent contracts: `5/5`;
  - Day 256 PPTX/source-traceability contracts: `4/4` with explicit `DB_TYPE=postgres` (the first invocation without that required environment produced `2` honest failures asserting `sqlite`; the corrected no-retry invocation passed `4/4`);
  - clean Day 257 grounding contract: `2/2`;
  - click-then-shoot native Node contract: `5/5`;
  - Day 267 Materials harness/verdict contract: `4/4`.
- The Day 242 and Day 250 RealPG contracts were not replayed during integration because no integration database/ports were licensed and resource substitution is prohibited. Their branch evidence is preserved, while fresh integration replay remains `NOT_PROVEN`.
- Final SHA is the commit containing this verification update; it is also verified against the `github-backup` remote after push.
