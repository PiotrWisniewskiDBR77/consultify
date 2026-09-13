# C6 menu correction: real table behavior

The previous UI test substituted its own row-menu interpretation. It ignored a destructive entry containing only a note, whereas the real StandardTable converter creates a disabled Delete action for that entry.

Root reproduced the defect with the actual rowMenuToSections converter: one collected test failed because a disabled Delete button was present. The preceding syntax-error run is retained as a collection error, not behavioral RED. Artifacts: C6_REAL_MENU_CONVERTER_RED_V2.json and the original C6_REAL_MENU_CONVERTER_RED.json.

The production fix removes only the destructive property from the organization row menu. The existing policy explanation above the table and Export Data action are unchanged. The strengthened rendered test and route refusal tests pass 3/3 (C6_REAL_MENU_CONVERTER_GREEN.json). Formatting and diff checks pass.

Root also inspected the actual old built menu screenshot in codex6-scratch/C6_DELETE_OFF_BUILT/ui-red-v1/menu-open.png: disabled Delete is visible. That browser run later stopped at DOWNLOAD_RESPONSE_MISMATCH. The downloaded file contains JSON, but the captured response body is empty; this is not evidence of a corrupt downloaded file. The independent agent is checking the capture and downloaded content without discarding the failed run.

Fixed build finished successfully. Index SHA256: efb170c64f784f7f95454327e9d67d74dc27723cd7e75835b1c5470e0378a907. Actual built GREEN passed; fixture cleanup is pending. No backend change, deployment, or full C6/MVP acceptance is claimed.


Independent actual built GREEN is now captured in C6_DELETE_OFF_BUILT/ui-green-v2/result.json and menu-open.png. Root inspected the screenshot: no inline or menu Delete controls, no dialogs, real table and policy explanation visible. Export action performed GET200 and downloaded13052bytes matching content-length; parsed JSON identifies the exact fresh target organization. Browser response.body was unavailable (zero bytes), recorded explicitly; no byte-equality claim is made. Download manifest remains truthful partial: policy v9, complete:false, truncated:false, unresolved90. No page errors; unrelated system-health404 remains. This is light1440x900 scoped acceptance, not full UI quality or complete organization export. Agent is performing fresh-fixture cleanup/readback separately.
