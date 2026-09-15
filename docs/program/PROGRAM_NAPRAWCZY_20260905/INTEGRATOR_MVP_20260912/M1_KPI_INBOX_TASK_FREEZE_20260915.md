# M1 — KPI deviation to Inbox action card and task freeze

**READY_FOR_INDEPENDENT_REVIEW.** Content commit `47642939fe` closes the live S1.3 path on exact base `dcbd6c052a`: a critical KPI measurement materializes the owner’s action card in Inbox, the canonical Create task action creates one idempotent My Work task, and both task APIs preserve the backlink to the card.

## Behavioral delta

- A critical KPI result creates one organization-scoped action card for the KPI and period; replay recovers the same card.
- Inbox materialization exposes the card to its owner. Create task produces one task with `source_type=action_card`, `source_id=<card id>`, owner, period, and English action text.
- `/api/tasks/:id` and `/api/my-work/personal-tasks/:id` return the action-card source, and the task detail renders that source.
- `scripts/dev/seed-kpi-deviation.mjs` is deterministic and additive. It validates an active English owner and organization, refuses a write without the explicit confirmation token, and separates `seed` from read-only `readback`.
- Notification delivery is best effort after the durable card insert. A notification schema/channel failure is logged and cannot make an already-written action card appear failed.

## Real PostgreSQL proof

Database identity: `127.0.0.1:6456/consultify_m1`. Seed run 1, seed run 2, and a separate readback returned the same card and task IDs with counts `1/1/1/1/1` for measurement, card, card Inbox item, task, and task Inbox item. Receipt: `evidence/m1-kpi-inbox-task/logs/seed-idempotency-receipt.json`.

Focused delta and importer suite: 7 files, 29/29 PASS with `--retry=0`. The fourth-Inbox-source sibling also passed 2/2 after its required two-user local fixture was provisioned and removed. Server TypeScript is 0. Frontend TypeScript is exactly the line ratchet, 177, with 0 errors in changed M1 files. No migration was added.

## Visual evidence

Four built-frontend captures show Inbox card and task in EN and PL. I inspected all four: labels switch locale, the seeded business content remains English as designed, and the task shows `Source / Źródło = Action card / Karta działania`. The captures are dark-theme. W76 asked for light-theme captures, so light-theme visual parity remains an explicit evidence gap rather than an asserted pass.

## Review boundary

Review content commit `47642939fe` and the subsequent freeze commit against `dcbd6c052a`. Independent review is not claimed: reviewer agents were blocked by the shared Codex usage limit. No deploy, protected-ref push, Railway change, migration, or staging write was performed.
