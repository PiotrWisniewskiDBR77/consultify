# Native forecast independent RED

Root authored `server/src/services/initiative/__tests__/executionBankNativeForecast.root-review.test.ts` in isolated native worktree at ca39f08b6e. The injected query fixtures implement the author's declared canonical-current and canonical-receipt row contracts; no database behavior is claimed.

E1B_NATIVE_FORECAST_ROOT_RED_V1.json:6 collected,0 passed,6 failed, terminal1. SHA256686d9e3aea12275e2b0674575800dffae666e649b7af32a16e86fbec62e6e521. Every case currently fails at the same explicit missing native projection assertion. This proves one missing native read capability, not six distinct defects.

Scenarios prepared for verification after implementation: exact direct response.after+durable identity/time without invented progress; malformed latest value cannot reuse older match; receipt version ahead of aggregate is a conflict; unchanged snapshot field is not newly observed; explicit clear retains provenance and differs from absent value; current forecast cannot be certified before its latest receipt. As agreed, changedFields is additive canonical receipt metadata, and explicit null uses UNKNOWN/VALUE_CLEARED with source, distinct from missing/no source.

Author implementing SliceA. Root retains independent test ownership. Existing module-backed acceptance stays intact and needs regression coverage. Fullnative real Gateway/JWT/PG and visible editor remain open.
