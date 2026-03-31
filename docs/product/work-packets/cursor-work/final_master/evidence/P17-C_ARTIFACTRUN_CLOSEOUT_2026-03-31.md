# P17-C — ArtifactRun closeout (2026-03-31)

Packet: **P17-C**  
Depends on:
- **P17-B delivered**: `8335c275e3`
- **Verification baseline in this session**: `98bf75bf8a`

## 1) Automated verification

Command:

```bash
npx vitest run \
  tests/integration/routes/artifact-runs.routes.sqlite.integration.test.ts \
  tests/integration/routes/artifact-runs.routes.preflight-and-failure.sqlite.integration.test.ts \
  tests/components/AIChat/V8ArtifactRunControl.test.tsx
```

Result: **PASS** on 2026-03-31
- Test files: **3/3 passed**
- Tests: **12/12 passed**

## 2) What this closeout verified

- Ask -> plan -> approve -> materialize -> retry remains green on the governed ArtifactRun spine.
- Validation/preflight is still exposed as a distinct stage.
- Failure packaging remains explicit and retry/rerun preserves lineage.
- Failed attempts do not create ghost artifacts.
- Chat control still exposes the bounded document, presentation, and sheet runtime lanes.

## 3) Rollback posture

- Disabling approve/run leaves plan/readback posture intact.
- The bounded rollback does not require destructive cleanup of historical runs or artifacts.

## 4) Known limits

- This closeout verifies the bounded ArtifactRun lifecycle through automated integration and UI tests rather than a separate staging screencast.
