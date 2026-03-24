#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type Check = { name: string; pass: boolean };

function read(root: string, relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function includesAll(content: string, needles: string[]): boolean {
  return needles.every((needle) => content.includes(needle));
}

function main(): void {
  const root = process.cwd();
  const checks: Check[] = [];

  const communicationSyncService = read(
    root,
    'server/src/services/integrations/communicationSyncService.ts'
  );
  const integrationsRoutes = read(root, 'server/src/routes/integrations/integrations.routes.ts');
  const decisionController = read(root, 'server/src/controllers/DecisionController.ts');
  const executionController = read(root, 'server/src/controllers/ExecutionController.ts');
  const taskController = read(root, 'server/src/controllers/TaskController.ts');
  const executionControlRoutes = read(root, 'server/src/routes/executionControl.routes.ts');
  const integrationSettings = read(root, 'src/components/settings/IntegrationSettings.tsx');

  checks.push({
    name: 'M02 communication sync service supports project channel mappings and delivery logs',
    pass: includesAll(communicationSyncService, [
      'CommunicationEventType',
      'projectChannelMappings',
      'dispatchProjectCommunicationEvent',
      'integration_sync_log',
      'decision_required',
      'gate_pending',
      'task_due',
      'risk_alert',
      'blocker_detected',
    ]),
  });

  checks.push({
    name: 'M02 integrations routes expose manual communication dispatch for verification',
    pass: includesAll(integrationsRoutes, [
      "'/communications/dispatch'",
      'dispatchProjectCommunicationEvent({',
      'eventType, title, and body are required',
      'deliveries',
    ]),
  });

  checks.push({
    name: 'M02 decision creation dispatches decision-required notifications',
    pass: includesAll(decisionController, [
      "eventType: 'decision_required'",
      'Decision required:',
      'deepLink: `/decisions/${id}`',
    ]),
  });

  checks.push({
    name: 'M02 gate checks dispatch gate-pending notifications',
    pass: includesAll(executionController, [
      "eventType: 'gate_pending'",
      'Gate check failed',
      'Execution gate requires follow-up before status can advance.',
    ]),
  });

  checks.push({
    name: 'M02 task lifecycle dispatches due and blocker notifications',
    pass: includesAll(taskController, [
      "eventType: 'task_due'",
      "eventType: 'blocker_detected'",
      'Task due soon:',
      'Task blocked:',
    ]),
  });

  checks.push({
    name: 'M02 execution controls can dispatch detected risk alerts',
    pass: includesAll(executionControlRoutes, [
      "'/risk-signals/dispatch'",
      "eventType: 'risk_alert'",
      'criticalSignals',
      'deliveries: deliveries.flat()',
    ]),
  });

  checks.push({
    name: 'M02 settings UI supports project-to-channel mapping configuration',
    pass: includesAll(integrationSettings, [
      'Project channel mappings',
      'projectChannelMappings',
      'Add project mapping',
      'Optional project-specific webhook URL',
      'Default webhook URL',
    ]),
  });

  const failed = checks.filter((check) => !check.pass);

  console.log('\n[smoke-v3-communication-sync] Summary:');
  for (const check of checks) {
    console.log(` - ${check.pass ? 'OK' : 'FAIL'} ${check.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((item) => item.name).join(', ')}`);
  }

  console.log('\n[smoke-v3-communication-sync] Contract checks passed.');
}

try {
  main();
} catch (error) {
  console.error(
    '[smoke-v3-communication-sync] Failed:',
    (error as Error)?.message || error
  );
  process.exit(1);
}
