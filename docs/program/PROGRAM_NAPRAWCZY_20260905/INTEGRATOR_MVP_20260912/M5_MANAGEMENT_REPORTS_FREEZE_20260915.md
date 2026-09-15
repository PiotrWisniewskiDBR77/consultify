# M5 — management reports freeze

**READY_FOR_INDEPENDENT_REVIEW.** Content commit `237a7f3baa` closes the measured management-report failures on exact base `dcbd6c052a`: `STEERING_COMMITTEE` and `RAID` now use canonical PostgreSQL columns and tables, all five report types return and persist successfully, and the Work report publishing contract is explicit.

## Behavioral delta

- Board decisions resolve the canonical owner fields and textual escalation level instead of querying missing `requested_by` and `decision_type` columns or comparing text to an integer.
- Steering milestones come from `initiative_milestones` joined through the initiative's project. Stage gates no longer query the absent `target_date` column; the API honestly returns no planned date on this schema.
- Direct `PUBLISH` remains forbidden. A report becomes `PUBLISHED` only through the delivery route after successful email delivery. A failed delivery returns governed `502 EMAIL_DELIVERY_FAILED` and leaves the report `APPROVED`.
- Existing tenant isolation tests now require strict `200` for owning-organization `STEERING_COMMITTEE` and `RAID` requests; the prior known-bug relaxation was removed.

## Evidence

Real PostgreSQL identity: `127.0.0.1:6454/consultify_m5`, cloned from the current local line schema. The new five-type acceptance test passed `5/5`, and the existing RED-4 regression passed `2/2`. Six existing RealPG files passed `73/73`: XLSX export and isolation, organization scope, portfolio progress, language, comment isolation, and project isolation. Five non-PG sibling files passed `14/14`, including direct publish, successful delivery, failed delivery, server flag, scheduling, XLSX dependency, and PPTX dependency.

Server TypeScript is `0`. Frontend TypeScript remains exactly the line ratchet at `177` compiler errors with `0` references to changed M5 files. No frontend file, migration, feature-flag default, Railway setting, deployment target, or protected ref was changed.

The first evidence rerun omitted `DB_TYPE=postgres MOCK_DB=false`, so it correctly exercised the mock adapter and failed. It was discarded and rerun with the required explicit local RealPG identity; only the successful, identity-bearing receipts are included in this freeze.

## Review boundary

Review content commit `237a7f3baa` and the subsequent freeze commit against `dcbd6c052a`. Independent review is not claimed because reviewer agents are blocked by the shared Codex usage limit. The CTO should independently verify the three repository query corrections and the publish/deliver state transition before integration.
