# Fix: Aplikacja nie może się zatrzymać po 3 godzinach

**Data:** 2026-01-26  
**Problem:** Aplikacja nie może się zatrzymać (graceful shutdown)

## 🔍 Przyczyna Problemu

Aplikacja nie mogła się zatrzymać, ponieważ podczas shutdown nie były zamykane:

1. **BullMQ Queue (`aiQueue`)** - pozostawało otwarte połączenie Redis
2. **setInterval** - health check interval nie był czyszczony
3. **Database Connection Pool** - nie był zamykany podczas shutdown

## ✅ Rozwiązanie

### 1. Naprawiono Shutdown Handlers w `server/src/index.ts`

**Przed:**
```typescript
process.on('SIGTERM', () => {
  logger.info('[Shutdown] Received SIGTERM, closing server...');
  server.close(() => process.exit(0));
});
```

**Po:**
```typescript
const gracefulShutdown = async (signal: string) => {
  logger.info(`[Shutdown] Received ${signal}, initiating graceful shutdown...`);
  
  server.close(async () => {
    // 1. Clear health check interval
    const healthCheckInterval = (global as any).__HEALTH_CHECK_INTERVAL__;
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
    }

    // 2. Close BullMQ queue
    const aiQueueModule = await import('./queues/aiQueue.js');
    const aiQueue = aiQueueModule.default;
    if (aiQueue && typeof aiQueue.close === 'function') {
      await aiQueue.close();
    }

    // 3. Shutdown database connection pool
    await shutdownConnectionPool();

    // 4. Use ShutdownManager for registered cleanups
    await shutdownManager.shutdown(signal);

    process.exit(0);
  });
};
```

### 2. Dodano przechowywanie referencji do setInterval

**Przed:**
```typescript
setInterval(async () => { ... }, 5 * 60 * 1000);
```

**Po:**
```typescript
const healthCheckInterval = setInterval(async () => { ... }, 5 * 60 * 1000);
(global as any).__HEALTH_CHECK_INTERVAL__ = healthCheckInterval;
```

## 📋 Co zostało naprawione

1. ✅ **BullMQ Queue** - zamykane podczas shutdown
2. ✅ **setInterval** - czyszczony podczas shutdown
3. ✅ **Database Connection Pool** - zamykany podczas shutdown
4. ✅ **ShutdownManager** - używany do graceful shutdown
5. ✅ **Timeout** - 15 sekund timeout na forced shutdown

## 🧪 Testowanie

Aplikacja powinna teraz:
- ✅ Zatrzymywać się poprawnie po SIGTERM/SIGINT
- ✅ Zamykać wszystkie połączenia (Redis, Database)
- ✅ Czyścić wszystkie timery/interwały
- ✅ Kończyć proces w ciągu 15 sekund

---

**Ostatnia aktualizacja:** 2026-01-26
