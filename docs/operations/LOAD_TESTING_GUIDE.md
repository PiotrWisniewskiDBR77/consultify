# Load Testing Guide

**Version:** 1.0.0  
**Last Updated:** 2026-01-04

## Overview

This guide explains how to run load tests for the Consultinity Enterprise SaaS platform using k6. Load testing helps verify that the system can handle expected traffic loads and identify performance bottlenecks.

## Prerequisites

### Install k6

**macOS:**

```bash
brew install k6
```

**Linux:**

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows:**

```bash
choco install k6
```

### Verify Installation

```bash
k6 version
```

## Test Scripts

### Basic Load Test

**File:** `tests/performance/load-test.js`

**Usage:**

```bash
k6 run tests/performance/load-test.js
```

**Configuration:**

- Stages: 10 → 50 → 100 users
- Duration: ~5 minutes
- Thresholds: P95 < 500ms, error rate < 1%

### High-Scale Load Test (1000+ Users)

**File:** `tests/performance/load-test-1000.js`

**Usage:**

```bash
k6 run tests/performance/load-test-1000.js
k6 run --vus 1000 --duration 10m tests/performance/load-test-1000.js
```

**Configuration:**

- Stages: 100 → 500 → 1000 → 1500 users
- Duration: ~15 minutes
- Thresholds: P95 < 1000ms, error rate < 2%

**Environment Variables:**

- `BASE_URL` - API base URL (default: http://localhost:3005)
- `K6_VUS` - Number of virtual users (default: 1000)
- `K6_DURATION` - Test duration (default: 5m)

### Stress Test

**File:** `tests/performance/stress-test.js`

**Usage:**

```bash
k6 run tests/performance/stress-test.js
```

**Configuration:**

- Sudden traffic spikes: 10 → 1000 → 2000 → 5000 users
- Tests system behavior under extreme load
- Thresholds: More lenient (P95 < 3000ms, error rate < 5%)

### Endurance Test

**File:** `tests/performance/endurance-test.js`

**Usage:**

```bash
k6 run --duration 1h tests/performance/endurance-test.js
k6 run --duration 24h tests/performance/endurance-test.js
```

**Configuration:**

- Sustained load: 100 users for extended period
- Tests for memory leaks and stability
- Thresholds: Strict (P95 < 1000ms, error rate < 1%)

**Environment Variables:**

- `ENDURANCE_DURATION` - Test duration (default: 1h)

## Running Tests

### Basic Test

```bash
npm run test:load
```

### High-Scale Test

```bash
k6 run tests/performance/load-test-1000.js
```

### Stress Test

```bash
k6 run tests/performance/stress-test.js
```

### Endurance Test

```bash
npm run test:memory-leak
# or
k6 run --duration 1h tests/performance/endurance-test.js
```

## Customizing Tests

### Adjust Virtual Users

```bash
k6 run --vus 500 --duration 5m tests/performance/load-test.js
```

### Adjust Duration

```bash
k6 run --duration 30m tests/performance/load-test.js
```

### Set Base URL

```bash
BASE_URL=https://api.consultinity.com k6 run tests/performance/load-test.js
```

### Run with Custom Stages

Create a custom test file or modify existing one:

```javascript
export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 0 },
  ],
};
```

## Interpreting Results

### Key Metrics

1. **http_req_duration** - Request duration
   - `avg` - Average response time
   - `p(95)` - 95th percentile
   - `p(99)` - 99th percentile
   - `max` - Maximum response time

2. **http_reqs** - Total requests
   - `count` - Total number of requests
   - `rate` - Requests per second

3. **http_req_failed** - Failed requests
   - `rate` - Error rate (0-1)
   - `count` - Total errors

4. **vus** - Virtual users
   - `value` - Current virtual users
   - `max` - Maximum virtual users

### Success Criteria

**Basic Load Test:**

- P95 latency < 500ms ✅
- Error rate < 1% ✅
- All thresholds passed ✅

**High-Scale Test:**

- P95 latency < 1000ms ✅
- Error rate < 2% ✅
- System remains stable ✅

**Stress Test:**

- System handles spikes ✅
- Recovery after spike ✅
- No crashes ✅

**Endurance Test:**

- No memory leaks ✅
- Stable error rate ✅
- Consistent performance ✅

### Common Issues

#### High Latency

**Symptoms:**

- P95 > 1000ms
- P99 > 2000ms

**Possible Causes:**

- Database connection pool exhausted
- Slow database queries
- External API delays
- Insufficient resources

**Solutions:**

- Increase database connection pool
- Optimize slow queries
- Add caching
- Scale horizontally

#### High Error Rate

**Symptoms:**

- Error rate > 5%
- Many 500 errors

**Possible Causes:**

- Database connection failures
- Memory exhaustion
- Unhandled exceptions
- Rate limiting too aggressive

**Solutions:**

- Check database connectivity
- Monitor memory usage
- Review error logs
- Adjust rate limits

#### Memory Leaks

**Symptoms:**

- Memory usage increases over time
- Performance degrades over time

**Solutions:**

- Run memory leak detection tests
- Review memory cleanup jobs
- Check for unclosed connections

## Performance Benchmarks

### Expected Performance

| Endpoint          | P95 Latency | P99 Latency | Throughput  |
| ----------------- | ----------- | ----------- | ----------- |
| `/api/health`     | < 50ms      | < 100ms     | 1000+ req/s |
| `/api/auth/login` | < 500ms     | < 1000ms    | 100+ req/s  |
| `/api/projects`   | < 200ms     | < 500ms     | 500+ req/s  |
| `/api/ai/chat`    | < 5000ms    | < 10000ms   | 10+ req/s   |

### Load Capacity

- **100 concurrent users:** Baseline performance
- **500 concurrent users:** Good performance
- **1000 concurrent users:** Acceptable performance (may see degradation)
- **1500+ concurrent users:** Requires horizontal scaling

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Test

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      - name: Run load test
        run: k6 run tests/performance/load-test.js
        env:
          BASE_URL: ${{ secrets.TEST_API_URL }}
```

## Best Practices

1. **Start Small** - Begin with low user counts and gradually increase
2. **Monitor Resources** - Watch CPU, memory, and database during tests
3. **Run Regularly** - Schedule load tests as part of CI/CD
4. **Compare Results** - Track performance over time
5. **Test Realistic Scenarios** - Simulate actual user behavior
6. **Test in Staging** - Don't run aggressive tests against production

## Troubleshooting

### k6 Installation Issues

**macOS:**

```bash
brew update
brew upgrade k6
```

**Linux:**

```bash
sudo apt-get update
sudo apt-get install --reinstall k6
```

### Test Failures

1. **Check server is running:**

   ```bash
   curl http://localhost:3005/api/health
   ```

2. **Check network connectivity:**

   ```bash
   ping localhost
   ```

3. **Review k6 logs:**

   ```bash
   k6 run --verbose tests/performance/load-test.js
   ```

4. **Check server logs:**
   Review application logs for errors during test execution

## Results Storage

Test results are automatically saved to:

- `tests/performance/results/load-test-1000-summary.json`
- `tests/performance/results/stress-test-summary.json`
- `tests/performance/results/endurance-test-summary.json`

## References

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://k6.io/docs/examples/)
- Performance Baselines: See `docs/PERFORMANCE_COMPARISON.md`
