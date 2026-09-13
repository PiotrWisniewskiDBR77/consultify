# ApiError nested envelope — independent bounded acceptance

Source PASS and independent4/4 tests PASS, zero skip/failure; API_ERROR_INDEPENDENT.json/log and source hashes retained. Exact same four fullNames as external original-source RED2FAIL/2PASS verified programmatically. Reviewer did not modify source or use DB/API.

Only constructor message selection changes from String(envelope.message/error) to existing normalizeApiErrorMessage(payload,fallbackMessage). Shared normalizer already handles nested message/error, unrecognized objects, validation text and registered known-code translation. Existing errorCode priority (errorCode→code→rule), correlationId, status and original data assignments remain unchanged. Actual Api.getTenantAdminAuditLogs call proves nested500 remains typed ApiError with readable message plus status/code/correlation/data, not object coercion. Plain lifecycle rule and explicit errorCode regression cases remain green.

No new source blocker found in this narrow change. Existing normalizer chooses known-code display strings independently of machine-code precedence; this patch intentionally reuses that existing contract, not a broad error-protocol redesign. Built audit rendering on new bundle remains a separate pending gate; current served dist still represents old691982.
