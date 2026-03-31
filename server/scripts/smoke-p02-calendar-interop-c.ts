/**
 * P02 Calendar Interop static smoke — file existence and code patterns
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dirname || __dirname, '../..');

const checks: Array<{ label: string; pass: boolean }> = [];

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

function fileContains(rel: string, pattern: string): boolean {
  if (!fileExists(rel)) return false;
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8').includes(pattern);
}

// Service
checks.push({ label: 'calendarInteropService.ts exists', pass: fileExists('server/src/services/v8/calendarInteropService.ts') });
checks.push({ label: 'Service exports CalendarSource type', pass: fileContains('server/src/services/v8/calendarInteropService.ts', 'CalendarSource') });
checks.push({ label: 'Service exports CalendarItem type', pass: fileContains('server/src/services/v8/calendarInteropService.ts', 'CalendarItem') });
checks.push({ label: 'Service exports RecurrenceModel', pass: fileContains('server/src/services/v8/calendarInteropService.ts', 'RecurrenceModel') });
checks.push({ label: 'Service exports SyncCheckpoint', pass: fileContains('server/src/services/v8/calendarInteropService.ts', 'SyncCheckpoint') });
checks.push({ label: 'Service has computeEffectiveMode', pass: fileContains('server/src/services/v8/calendarInteropService.ts', 'computeEffectiveMode') });
checks.push({ label: 'Service has mapProviderError', pass: fileContains('server/src/services/v8/calendarInteropService.ts', 'mapProviderError') });
checks.push({ label: 'Service has conditionalWriteItem', pass: fileContains('server/src/services/v8/calendarInteropService.ts', 'conditionalWriteItem') });
checks.push({ label: 'Service has performIncrementalSync', pass: fileContains('server/src/services/v8/calendarInteropService.ts', 'performIncrementalSync') });

// Canon
checks.push({ label: 'calendarInteropCanon.ts exists', pass: fileExists('server/src/services/v8/calendarInteropCanon.ts') });
checks.push({ label: 'Canon has P02_DECLARED_PROVIDERS', pass: fileContains('server/src/services/v8/calendarInteropCanon.ts', 'P02_DECLARED_PROVIDERS') });
checks.push({ label: 'Canon has P02_ACCEPTANCE_CHECKLIST', pass: fileContains('server/src/services/v8/calendarInteropCanon.ts', 'P02_ACCEPTANCE_CHECKLIST') });
checks.push({ label: 'Canon has P02_ERROR_POSTURE', pass: fileContains('server/src/services/v8/calendarInteropCanon.ts', 'P02_ERROR_POSTURE') });

// Routes
checks.push({ label: 'calendar.routes.ts exists', pass: fileExists('server/src/routes/v8/calendar.routes.ts') });
checks.push({ label: 'Routes mounted in v8/index.ts', pass: fileContains('server/src/routes/v8/index.ts', "'/calendar'") });

// Migration
checks.push({ label: 'Migration exists', pass: fileExists('server/migrations/20260331_v8_calendar_interop_p02b.sql') });
checks.push({ label: 'Migration has v8_calendar_sources', pass: fileContains('server/migrations/20260331_v8_calendar_interop_p02b.sql', 'v8_calendar_sources') });
checks.push({ label: 'Migration has v8_calendar_items', pass: fileContains('server/migrations/20260331_v8_calendar_interop_p02b.sql', 'v8_calendar_items') });

// Contract test
checks.push({ label: 'Contract test exists', pass: fileExists('tests/integration/p02-calendar-interop.contract.test.ts') });

// Evidence patterns
checks.push({ label: 'Service has 3 providers (google/microsoft/caldav)', pass: fileContains('server/src/services/v8/calendarInteropService.ts', "'google', 'microsoft', 'caldav'") });
checks.push({ label: 'Service has 5 lifecycle states', pass: fileContains('server/src/services/v8/calendarInteropService.ts', "'connected', 'degraded', 'requires_action', 'blocked', 'recoverable'") });
checks.push({ label: 'Service has 5 sync states', pass: fileContains('server/src/services/v8/calendarInteropService.ts', "'in_sync', 'pending', 'conflict', 'blocked', 'stale'") });

const passed = checks.filter((c) => c.pass).length;
const total = checks.length;

console.log(`\n=== P02 Calendar Interop Smoke (${passed}/${total}) ===\n`);
checks.forEach((c) => console.log(`  ${c.pass ? '✅' : '❌'} ${c.label}`));
console.log(`\n${passed === total ? '🟢 ALL PASSED' : '🔴 SOME FAILED'}\n`);

if (passed !== total) process.exit(1);
