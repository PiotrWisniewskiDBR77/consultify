## V8 Assessment Editor Ancillary Cutover Proof

Date: 2026-03-26
Surface: `https://stage.consultinity.ai/assessment/drd/assess-adma-maturity-01`
Deployment: `1a4891ca-5144-4bd9-9f67-7b74dacd48c5` (`SUCCESS`)

### Deploy result

The ancillary side-lane cutover was deployed to the staging `consultify` service through the normal Railway `DOCKERFILE` path.

Observed final deploy truth:

- service: `consultify`
- environment: `staging`
- deployment `1a4891ca-5144-4bd9-9f67-7b74dacd48c5` finished `SUCCESS`
- prior deployment `508519b9-1115-4423-900d-63e2007c370a` was replaced (`REMOVED`)

### Live editor open proof

Fresh browser navigation opened the real editor surface:

- URL settled to `/assessment/drd/assess-adma-maturity-01?axis=1&area=1A&level=1`
- visible editor chrome included `Back to Assessment`, `ADMA — Digital Maturity Assessment`, `Exit`, and DRD navigation controls

Fresh browser network capture from the same editor-open flow recorded:

- `GET /api/v8/assessment/assess-adma-maturity-01/user-state` -> `200`
- `GET /api/v8/assessment/assess-adma-maturity-01/assignments` -> `200`

Fresh staging runtime logs from the same window recorded:

- `GET /api/v8/assessment/assess-adma-maturity-01/my-role`
- `GET /api/v8/assessment/assess-adma-maturity-01`
- `GET /api/v8/assessment/assess-adma-maturity-01/user-state`
- `GET /api/v8/assessment/assess-adma-maturity-01/assignments`

No matching legacy editor ancillary requests were observed in the same runtime window:

- no `assessment-workflow-v2/assess-adma-maturity-01/my-role`
- no `assessment-workflow-v2/assess-adma-maturity-01/user-state`
- no `assessment-workflow-v2/assess-adma-maturity-01/assignments`

### Live save retest

A manual save retest from the live editor still targeted the bounded V8 core route:

- `PUT /api/v8/assessment/assess-adma-maturity-01`

The save retest hit transient staging rate-limit noise (`429`) during this proof window, so this note is not the source of truth for a clean `200` save confirmation. Clean bounded core save continuity remains captured earlier in `evidence/95-v8-assessment-editor-continuity-proof.md`.

### Operational conclusion

The residual `C-04` ancillary seam is now closed on staging.

The assessment editor open/session collaboration lane is now V8-backed end to end for the previously residual calls:

- `my-role`
- `user-state`
- `assignments`

The remaining save retest noise was staging rate limiting, not a reappearance of legacy `assessment-workflow-v2` sourcing. The bounded editor is therefore no longer yellow because of legacy ancillary side-lanes.
