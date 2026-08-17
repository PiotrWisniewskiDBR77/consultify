# UI-G4 final evidence handoff

Status: `AUTOMATED_G4_PASS_EXACT_SHA / HUMAN_ACCEPTANCE_PENDING`

- Reconciliation base: `086219464dd61d6134d057705d5a19d118a806e4`
- Tested UI candidate: `836bfd633af7a689e7a3fb06971cbd8fe57bafe7`
- Final artifact commit in reconciliation ancestry: `cab3c6d62e0d233c14ba9c0f7bdddb57658326cc`
- Runtime: mounted application, signed authentication, `E2E_MODE=false`, real PostgreSQL, no request interception

## Automated G4 result

| Gate | Result |
|---|---:|
| Authority-owned UI tasks | 15/15 |
| Primary and secondary cells | 206/206 |
| Screenshot references present | 214/214 (`missing=0`) |
| Unique screenshot SHA-256 contents | 212 |
| axe critical / serious | 0 / 0 |
| Unnamed interactive controls | 0 |
| Settled visible focus | 15/15 surfaces, 599 controls, invisible=0 |
| Horizontal overflow | 0 |
| Deep-link / reload / cold reopen | 15/15 / 15/15 / 15/15 |
| Migration repeat / dry-run drift | 0 / 0 |
| Teardown descendants / occupied harness ports | 0 / 0 |

The result is bound to the tested candidate, not rewritten as each task's
`productSha`. The 15 canonical task records preserve their original product
identity, verdict, backend, persona and state evidence. This reconciliation only
adds an exact-SHA automated-browser result and links to the committed result and
screenshot artifacts.

The final results retain 98 console errors explicitly: 78 HTTP 403 responses and
20 HTTP 404 responses, with zero other console errors. They are not hidden by the
automated PASS. Their exact per-surface records remain in the linked
`G4_SWEEP_RESULT.json` files.

## Historical evidence

The earlier `40e1a89bdd` and `2dedb7` runs remain provenance and diagnostic
history only. Their focus and contrast failures are not current-candidate claims
and must not override the final exact-candidate result above.

## Human gate still open

Automated G4 does not sign off VoiceOver, visual/brand acceptance or the seven
target personas. Piotr's executable checklist is
[`OWNER_UAT_VOICEOVER_RUNBOOK.md`](./OWNER_UAT_VOICEOVER_RUNBOOK.md). Every
persona must be run on the final candidate and signed `PASS`; no signature has
been entered on Piotr's behalf.

## Audit catalog gap

The 15-task UI authority contains no Audit UI task. A non-authority proposal is
recorded at
[`AUD-UI-CANON-001/PROPOSAL_EVIDENCE.json`](./AUD-UI-CANON-001/PROPOSAL_EVIDENCE.json).
It is `NOT_VERIFIED`, does not allocate a task, and does not change the 82-task
denominator.

## Authorization boundary

This packet proves the automated UI gate only. It does not grant release GO,
deployment authorization, owner acceptance, or permission to change the
82-task authority.
