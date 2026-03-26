## V8 Assessment Retry Lane Proof

Date: 2026-03-26
Surface: `https://stage.consultinity.ai/assessment?ts=1774602300`
Deployment: `54c10c4a-afa4-408e-84a9-6af88edab880` (`SUCCESS`)

### What was verified

- Fresh staging deploy cut over successfully before the browser retest.
- Fresh live browser load of `/assessment` still rendered the operator-facing error state:
  - `Retry`
  - `Running Your First Assessment`
  - `Too many requests, please try again later.`
- The active network wave stayed on the governed V8 lane and did not fall back to legacy assessment endpoints.

### Network truth

Observed request sequence on the live `/assessment` surface:

- `GET /api/v8/assessment?limit=200&offset=0` -> `429`
- `GET /api/v8/assessment?limit=200&offset=0` -> `429`
- `GET /api/v8/assessment?limit=200&offset=0` -> `429`

Observed in the same fresh-tab capture:

- no `GET /api/assessment-workflow-v2`
- no `GET /api/assessments`
- no `GET /api/assessment/:id`

### Operational conclusion

The bounded assessment bridge is now the active list runtime lane on staging, and transient retry stays on governed V8 instead of dropping back into legacy split-brain reads.

The remaining blocker is no longer route split-brain. The remaining blocker is staging volatility / rate limiting on the live assessment landing, which still prevents closure-grade operator continuity.
