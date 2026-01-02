# Resilience & Recovery Rules

**Last Updated:** 1 January 2026  
**Standard:** IBM-Grade System Stability v1.1

This document specifies the mandatory resilience patterns and automated recovery flows required to maintain the stability of the Consultinity platform under operational stress.

---

## 1. The "Ghost Hunting" Protocol (Stabilization)
In complex AI-first systems, non-deterministic failures ("Ghosts") must be neutralized through structured stabilization.

### Closure-Safe Execution
- **Rule**: All async services must use explicit dependency injection or `Object.assign` to prevent closure-based memory leaks.
- **Verification**: Tests must mock providers at the class level, not the module level.

### State Reconciliation
- **Pattern**: If an initiative status remains in `PROCESSING` for > 300 seconds, the `StatusWatcher` must trigger a reconciliation event.
- **Recovery**: Reset to `DRAFT` or `FAILED` based on the AI Pipeline trace.

---

## 2. Automated Recovery Flows

### AI Pipeline Circuit Breakers
| Failure Mode | Recovery Action |
| :--- | :--- |
| **Provider Timeout** | Immediate fallback to the next tier in the `FallbackChain`. |
| **PMODomain Conflict** | Revert to the last stable state and emit a `Signalizator` alert. |
| **Context Overload** | Trim the `enhancedContextBuilder` window and retry once. |

### Database Resilience
- **Shadow Writes**: All critical status changes are written to a shadow `history_log` before updating the primary table.
- **Auto-Repair**: On startup, the system verifies `organization_context` integrity and auto-migrates missing foundational records (e.g., default axes).

---

## 3. The "Fail-Open" Policy
For non-critical features, the system must degrade gracefully:
1. **Insight Generation**: If AI is offline, display "Insights temporarily unavailable" instead of crashing.
2. **Visual Charts**: Render static placeholder if dynamic data is corrupted.
3. **Audit Logging**: If the Audit service fails, buffer events in-memory for 10 minutes before dropping.

---

## 4. Operational Guardrails
- **Max Request Lifetime**: 60 seconds (Client-side), 300 seconds (Backend-side).
- **Concurrency Limit**: 10 simultaneous AI requests per organization (Tier 1).
