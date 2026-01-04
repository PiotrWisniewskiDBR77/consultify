# Monitoring Dashboard Documentation

**Version:** 1.0.0  
**Last Updated:** 2026-01-04

## Overview

This document describes the monitoring dashboard and metrics available in the Consultify Enterprise SaaS platform. The monitoring system provides real-time insights into system performance, health, and reliability.

## Metrics Endpoints

### Prometheus Metrics

**Endpoint:** `GET /api/metrics`

Returns Prometheus-formatted metrics for scraping by Prometheus server.

**Content-Type:** `text/plain; version=0.0.4; charset=utf-8`

**Example:**
```bash
curl http://localhost:3005/api/metrics
```

### Performance Metrics

**Endpoint:** `GET /api/performance/metrics`

Returns JSON-formatted performance metrics including P95/P99 latency and throughput.

**Response Format:**
```json
{
  "timestamp": "2026-01-04T12:00:00.000Z",
  "latency": {
    "http": { "p50": 0, "p95": 0, "p99": 0, "avg": 0 },
    "db": { "p50": 0, "p95": 0, "p99": 0, "avg": 0 },
    "llm": { "p50": 0, "p95": 0, "p99": 0, "avg": 0 }
  },
  "throughput": {
    "http": 0,
    "db": 0,
    "llm": 0
  },
  "errors": {
    "rate": 0,
    "total": 0
  }
}
```

## Available Metrics

### HTTP Metrics

- **http_requests_total** - Total number of HTTP requests
  - Labels: `method`, `route`, `status_code`
  
- **http_request_duration_seconds** - Duration of HTTP requests
  - Labels: `method`, `route`, `status_code`
  - Buckets: 0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1, 2, 5, 10, 30, 60

- **http_requests_per_second** - HTTP requests per second (calculated over rolling window)

### Database Metrics

- **db_queries_total** - Total number of database queries
  - Labels: `query_type`, `database_type`

- **db_query_duration_seconds** - Duration of database queries
  - Labels: `query_type`, `database_type`
  - Buckets: 0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1, 2, 5

- **db_queries_per_second** - Database queries per second

- **db_connections_active** - Number of active database connections
  - Labels: `database_type`

### Redis Metrics

- **redis_operations_total** - Total number of Redis operations
  - Labels: `operation_type`

- **redis_operation_duration_seconds** - Duration of Redis operations
  - Labels: `operation_type`

- **redis_connected** - Redis connection status (1 = connected, 0 = disconnected)

### LLM Metrics

- **llm_calls_total** - Total number of LLM API calls
  - Labels: `provider`, `model`, `status`

- **llm_call_duration_seconds** - Duration of LLM API calls
  - Labels: `provider`, `model`
  - Buckets: 0.1, 0.5, 1, 2, 5, 10, 15, 20, 25, 30, 45, 60, 90, 120

- **llm_requests_per_second** - LLM requests per second

### Application Metrics

- **active_connections** - Number of active connections

- **memory_usage_bytes** - Memory usage in bytes
  - Labels: `type` (heapUsed, heapTotal, external, rss)

- **errors_total** - Total number of errors
  - Labels: `error_type`, `component`

- **active_users** - Number of active users

- **api_requests_by_org_total** - Total API requests by organization
  - Labels: `organization_id`

## Interpreting Metrics

### P95/P99 Latency

**P95 (95th percentile):** 95% of requests complete within this time.  
**P99 (99th percentile):** 99% of requests complete within this time.

**Interpretation:**
- **P95 < 500ms:** Excellent performance
- **P95 < 1000ms:** Good performance
- **P95 > 2000ms:** Performance degradation - investigate

**Example Prometheus Query:**
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### Throughput

**Requests per second (req/s):** Number of requests processed per second.

**Interpretation:**
- Monitor for sudden drops (potential issues)
- Monitor for sustained high throughput (may need scaling)

**Example Prometheus Query:**
```promql
rate(http_requests_total[1m])
```

### Error Rate

**Error Rate:** Percentage of requests that result in errors.

**Alert Thresholds:**
- **< 1%:** Normal
- **1-5%:** Warning - investigate
- **> 5%:** Critical - immediate action required

**Example Prometheus Query:**
```promql
rate(errors_total[5m]) / rate(http_requests_total[5m]) * 100
```

## Alert Thresholds

### Performance Baselines

| Metric | Baseline | Warning | Critical |
|--------|----------|---------|----------|
| HTTP P95 Latency | < 500ms | 500-1000ms | > 1000ms |
| HTTP P99 Latency | < 1000ms | 1000-2000ms | > 2000ms |
| DB Query P95 | < 100ms | 100-500ms | > 500ms |
| LLM Call P95 | < 5s | 5-10s | > 10s |
| Error Rate | < 1% | 1-5% | > 5% |
| Memory Usage | < 80% | 80-90% | > 90% |

### Health Check Endpoints

**GET /api/health** - Basic health check
- Returns: `{ status: 'ok', database: 'connected', redis: 'connected' }`

**GET /api/health/ready** - Readiness probe (Kubernetes)
- Returns: `{ database: true, redis: true, metrics: true }`
- Status 200 if ready, 503 if not ready

**GET /live** - Liveness probe (Kubernetes)
- Returns: `'live'`
- Status 200 if process is running

## Dashboard Setup

### Prometheus Configuration

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'consultify'
    scrape_interval: 15s
    metrics_path: '/api/metrics'
    static_configs:
      - targets: ['localhost:3005']
```

### Grafana Dashboard

Import the following panels:

1. **HTTP Request Rate**
   - Query: `rate(http_requests_total[5m])`
   - Visualization: Graph

2. **HTTP Latency (P95/P99)**
   - Query: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
   - Visualization: Graph

3. **Error Rate**
   - Query: `rate(errors_total[5m]) / rate(http_requests_total[5m]) * 100`
   - Visualization: Graph

4. **Memory Usage**
   - Query: `memory_usage_bytes{type="heapUsed"}`
   - Visualization: Graph

5. **Database Query Duration**
   - Query: `histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))`
   - Visualization: Graph

## Troubleshooting

### High Latency

1. Check database query performance
2. Check Redis connectivity
3. Check external API response times
4. Review recent deployments

### High Error Rate

1. Check application logs
2. Review Sentry for error details
3. Check database connection pool
4. Verify external service availability

### Memory Leaks

1. Monitor `memory_usage_bytes` trend
2. Run memory leak detection tests
3. Review memory cleanup jobs
4. Check for unclosed connections

## Best Practices

1. **Monitor P95/P99 regularly** - These percentiles reveal performance issues that averages hide
2. **Set up alerts** - Configure alerts for critical thresholds
3. **Review dashboards daily** - Proactive monitoring prevents issues
4. **Track trends** - Look for gradual degradation over time
5. **Correlate metrics** - Combine multiple metrics to understand system behavior

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Dashboard Examples](https://grafana.com/grafana/dashboards/)
- Performance Baselines: See `docs/PERFORMANCE_COMPARISON.md`

