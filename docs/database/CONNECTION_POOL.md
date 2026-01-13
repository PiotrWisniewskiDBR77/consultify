# Connection Pool Integration Guide

## Quick Start

### 1. Enable Connection Pooling

Add to `.env`:

```bash
# Connection Pool Configuration
DISABLE_CONNECTION_POOL=false
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT=30000
DB_QUERY_TIMEOUT=60000
DB_HEALTH_CHECK_INTERVAL=30000
```

### 2. Initialize in Server Startup

Add to `server/src/index.ts` (after database initialization):

```typescript
import { initializeConnectionPool } from './database/index.js';

// After database initialization
await initializeConnectionPool();
logger.info('✅ Connection pool initialized');
```

### 3. Register Health Routes

Add to `server/src/index.ts` (with other routes):

```typescript
import healthRoutes from './routes/health.routes.js';

app.use('/api/health', healthRoutes);
```

### 4. Graceful Shutdown

Add to server shutdown handler:

```typescript
import { shutdownConnectionPool } from './database/index.js';

process.on('SIGTERM', async () => {
  await shutdownConnectionPool();
  // ... other cleanup
});
```

## Usage

### Health Check Endpoints

```bash
# Database health
curl http://localhost:3005/api/health/database

# Connection pool status
curl http://localhost:3005/api/health/connections
```

### Using Connection Pool

```typescript
import { getConnectionPool } from './database/index.js';

const pool = getConnectionPool();
if (pool) {
  const result = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
}
```

## Features

### ✅ Connection Pooling

- Min 2, Max 10 connections
- Automatic connection reuse
- Efficient resource management

### ✅ Auto-Reconnection

- Exponential backoff: 100ms → 10s
- Max 5 retry attempts
- Automatic recovery

### ✅ Circuit Breaker

- Opens after 5 consecutive failures
- Auto-closes after 1 minute
- Prevents cascade failures

### ✅ Health Monitoring

- Heartbeat checks every 30s
- Automatic unhealthy connection replacement
- Metrics collection (uptime, response time)

### ✅ Timeouts

- Connection timeout: 30s
- Query timeout: 60s
- Prevents hanging queries

## Monitoring

### Metrics Available

```json
{
  "pool": {
    "total": 5,
    "active": 2,
    "idle": 3,
    "waiting": 0,
    "healthy": 5,
    "unhealthy": 0
  },
  "metrics": {
    "uptime": "99.50%",
    "averageResponseTime": "12.34ms",
    "consecutiveFailures": 0,
    "totalChecks": 120,
    "totalFailures": 1
  }
}
```

### Events

Connection pool emits events:

- `connection-created` - New connection added
- `connection-released` - Connection returned to pool
- `health-check-complete` - Periodic health check done
- `circuit-breaker-open` - Too many failures
- `circuit-breaker-closed` - Recovered

## Troubleshooting

### Pool Exhausted

If you see "Pool exhausted, waiting for connection...":

- Increase `DB_POOL_MAX`
- Check for connection leaks
- Review long-running queries

### Circuit Breaker Open

If circuit breaker opens:

- Check database connectivity
- Review recent errors
- Wait 1 minute for auto-recovery

### Disable Pooling

If issues occur:

```bash
DISABLE_CONNECTION_POOL=true
```

This reverts to singleton pattern.

## Performance Impact

**Before (Singleton)**:

- 1 connection
- No retry logic
- Manual reconnection
- No health checks

**After (Pool)**:

- 2-10 connections
- Exponential backoff retry
- Auto-reconnection
- Proactive health monitoring
- Circuit breaker protection

**Expected Improvements**:

- ✅ Zero disconnections under load
- ✅ 5s max recovery time
- ✅ Better concurrency handling
- ✅ Proactive failure detection
