let v8RequestCount = 0;
let v8ErrorCount = 0;
let v8TotalLatencyMs = 0;
const V8_METRICS_MAX_RECORDED_LATENCY_MS = 86_400_000;

export function recordV8Request(durationMs: number, isError: boolean) {
  const safeDuration = Number.isFinite(durationMs)
    ? Math.max(0, Math.min(durationMs, V8_METRICS_MAX_RECORDED_LATENCY_MS))
    : 0;
  v8RequestCount++;
  v8TotalLatencyMs += safeDuration;
  if (isError) v8ErrorCount++;
}

export function resetV8Metrics() {
  v8RequestCount = 0;
  v8ErrorCount = 0;
  v8TotalLatencyMs = 0;
}

export function getV8MetricsSnapshot() {
  const avgLatency = v8RequestCount > 0 ? Math.round(v8TotalLatencyMs / v8RequestCount) : 0;
  return {
    requests: v8RequestCount,
    errors: v8ErrorCount,
    avgLatencyMs: avgLatency,
    uptime: process.uptime(),
  };
}
