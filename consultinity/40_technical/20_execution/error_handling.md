# Error Handling & Resilience Specification

**Last Updated:** 1 January 2026  
**Focus:** Enterprise Reliability & Error Dictionary

This document defines the error handling and resilience patterns required to maintain the stability of the Consultinity platform under enterprise workloads.

---

## 1. Resilience Patterns

### Fail-Open Policy
In the **AI Pipeline**, critical security and quota checks are managed via "Safe Wrappers". If a non-blocking service (e.g., Audit Logging or Learning System) fails, the pipeline MUST continue the request execution and log a "Resilience Warning".
- **Reasoning**: User productivity takes precedence over non-critical metadata capture.
- **Implementation**: See `safeCheckQuota()` and `safeCheckRateLimit()` in `AIPipeline.js`.

### Automatic Provider Fallback
The `LLMService` implements a 3-layer fallback system:
1. **Primary**: High-tier models (e.g., GPT-4o, Claude 3.5 Sonnet).
2. **Secondary**: Balanced models (e.g., GPT-4o-mini).
3. **Tertiary**: High-speed/Low-cost models (e.g., Llama 3 via Groq).
*If a provider returns an HTTP 5xx or Timeouts, the system must switch to the next tier within 500ms.*

---

## 2. Error Code Dictionary

Standardized error codes emitted by the API to ensure deterministic frontend recovery.

| Code | HTTP | Description | Recovery Strategy |
| :--- | :--- | :--- | :--- |
| `AI_QUOTA_EXHAUSTED` | 403 | Organization has exhausted its token/budget limit. | Disable AI features; prompt for upgrade. |
| `AI_RATE_LIMIT_EXCEEDED` | 429 | User/Org exceeded requests per minute. | Wait for `resetAt` timestamp provided in payload. |
| `AUTH_INVALID_TOKEN` | 401 | Token is expired or malformed. | Redirect to login. |
| `GOV_INVALID_TRANSITION` | 400 | `StatusMachine` blocked a state change. | Display the `reason` field in a Toast. |
| `GOV_MISSING_REASON` | 400 | Blocked status requested without `blockedReason`. | Focus the reason input field. |
| `DATA_VALIDATION_ERROR` | 422 | Payload does not match DTO registry. | Log to developer console; show user input errors. |

---

## 3. Global Exception Handling
- **Backend**: All routes must be wrapped in a `try/catch` block or a global async error handler middleware.
- **Audit**: Every `5xx` error must be logged to the `system_logs` with a full stack trace and the active `organizationId`.
- **User Experience**: Never expose raw system errors (stack traces) to the end-user. Use the Error Code Dictionary for mapping to localized messages.
