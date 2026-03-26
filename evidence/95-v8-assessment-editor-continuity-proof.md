## V8 Assessment Editor Continuity Proof

Date: 2026-03-26
Surface: `https://stage.consultinity.ai/assessment/drd/assess-adma-maturity-01`
Deployment: `508519b9-1115-4423-900d-63e2007c370a` (`SUCCESS`)

### Deploy unblock

The earlier staging blocker was a Railway upload snapshot timeout, not an app regression.

Observed verbose deploy truth before the fix:

- upload snapshot size was `61577099` bytes
- Railway timed out during `Uploading...`
- failed deploys surfaced as `Failed to create code snapshot`

Targeted deploy unblock applied in this wave:

- narrowed deploy ignore to exclude the tracked non-critical asset `public/videos/en.mp4`

Observed verbose deploy truth after the fix:

- upload snapshot size dropped to `34816792` bytes
- Railway proceeded into the normal `DOCKERFILE` build path
- deployment `508519b9-1115-4423-900d-63e2007c370a` finished `SUCCESS`

### Live editor open proof

Fresh browser navigation opened the real assessment editor surface:

- URL settled to `/assessment/drd/assess-adma-maturity-01?axis=1&area=1A&level=1`
- visible editor chrome included:
  - `Back to Assessment`
  - `ADMA — Digital Maturity Assessment`
  - `Exit`
  - DRD area/level navigation controls

Runtime logs during the same editor-open flow recorded:

- `GET /api/v8/assessment/assess-adma-maturity-01`
- `GET /api/assessment-workflow-v2/assess-adma-maturity-01/my-role`
- `GET /api/assessment-workflow-v2/assess-adma-maturity-01/user-state`
- `GET /api/assessment-workflow-v2/assess-adma-maturity-01/assignments`

### Live editor write proof

A manual save was triggered from the open editor via keyboard shortcut (`Ctrl+S`).

Observed network requests from the live browser tab:

- `PUT /api/v8/assessment/assess-adma-maturity-01` -> `200`
- `PUT /api/assessment-workflow-v2/assess-adma-maturity-01/user-state` -> `200`

### Operational conclusion

Core assessment editor read/write continuity is now proven on the bounded V8 lane:

- core detail read -> bounded V8
- core save write -> bounded V8

The editor is still not fully V8-only end-to-end because ancillary runtime lanes remain on legacy:

- `my-role`
- `user-state`
- `assignments`

This note only closed the core detail/save seam. It is now superseded for the ancillary side-lane question by `evidence/96-v8-assessment-editor-ancillary-cutover-proof.md`, which captures the later staging deploy where `my-role`, `user-state`, and `assignments` were also observed on bounded V8.
