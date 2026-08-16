# Chat stream reliability runbook

## Runtime contract

- The SSE route emits headers and an initial event immediately, then a heartbeat every 15 seconds.
- A provider attempt is bounded to 60 seconds. The streaming provider layer performs at most one retry before the model-fallback loop advances.
- Client disconnect aborts the provider signal, stops iteration, marks the trace aborted and persists any accumulated partial response.
- Provider startup failure, iterator failure and empty output end with explicit SSE error codes; they must never be reported as success.
- Completed streams delete their partial-response checkpoint. A restarted process can read a saved partial response through the tenant-scoped partial-response endpoint.

## Operational signals

Use the Chat trace and application logs together. Correlate by `X-Stream-Session-Id`, trace ID, organization and conversation. Watch for:

- `Client disconnected` and trace status `aborted`;
- `Stream failed` / `Iterator error`, `RATE_LIMIT`, `STREAM_ERROR` or `EMPTY_STREAM`;
- provider/model and startup latency in the `pipeline_metadata` trace event;
- partial-response save failures;
- streaming usage-log or budget-record failures.

Do not log prompts, response bodies, tokens or provider credentials in operational alerts.

## Triage and recovery

1. Confirm whether the failure happened before provider startup, during iteration or after client disconnect.
2. Check circuit state and configured fallback availability. Do not change provider selection policy during incident response.
3. For disconnects, verify the trace is `aborted` and a non-empty partial response is tenant-scoped and recoverable.
4. For `RATE_LIMIT`, allow the bounded retry/fallback contract to finish; do not add unbounded route retries.
5. For `EMPTY_STREAM`, preserve the explicit failure and trace metadata. Never synthesize a successful answer.
6. After recovery, run the focused cancellation/retry suite and the mounted SSE runtime gate documented in task evidence.

## Measurable local gates

- Deterministic mounted SSE completes in under 2,000 ms and includes `[DONE]` plus a trust bundle.
- Cancellation signal reaches the provider invocation.
- A transient provider startup failure recovers on exactly the second attempt; no third attempt is allowed in that provider call.
- Fresh PostgreSQL Chat handoff tests prove retry/idempotency, tenant isolation, cold readback and zero fixture residue.
