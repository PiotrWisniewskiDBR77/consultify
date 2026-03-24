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

  const jiraClient = read(root, 'server/src/services/integrations/jiraOrgClient.ts');
  const taskController = read(root, 'server/src/controllers/TaskController.ts');
  const integrationsRoutes = read(root, 'server/src/routes/integrations/integrations.routes.ts');
  const webhookRoutes = read(root, 'server/src/routes/integrations/webhooks.routes.ts');

  checks.push({
    name: 'M03 Jira client supports both create and update issue flows',
    pass: includesAll(jiraClient, [
      'createIssueFromTask',
      'updateIssueFromTask',
      '/rest/api/3/issue',
      "method: 'POST'",
      "method: 'PUT'",
    ]),
  });

  checks.push({
    name: 'M03 task controller triggers best-effort Jira sync on create and update',
    pass: includesAll(taskController, [
      'syncTaskToJiraIntegrations',
      'await syncTaskToJiraIntegrations({',
      'integration_sync_mappings',
      'jira_sync_failed',
      'retriable',
    ]),
  });

  checks.push({
    name: 'M03 integrations sync route backfills Jira mappings and sync log entries',
    pass: includesAll(integrationsRoutes, [
      "providerName === 'jira'",
      'createIssueFromTask({',
      'integration_sync_mappings',
      'integration_sync_log',
      'items_created',
      'items_failed',
    ]),
  });

  checks.push({
    name: 'M03 Jira webhook updates local task status through saved mappings',
    pass: includesAll(webhookRoutes, [
      "'/jira/:integrationId'",
      'integration_sync_mappings',
      'metadata LIKE',
      'mappedStatus',
      'UPDATE tasks SET status = ?',
      'last_external_update',
    ]),
  });

  const failed = checks.filter((check) => !check.pass);

  console.log('\n[smoke-v3-jira-sync] Summary:');
  for (const check of checks) {
    console.log(` - ${check.pass ? 'OK' : 'FAIL'} ${check.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((item) => item.name).join(', ')}`);
  }

  console.log('\n[smoke-v3-jira-sync] Contract checks passed.');
}

try {
  main();
} catch (error) {
  console.error('[smoke-v3-jira-sync] Failed:', (error as Error)?.message || error);
  process.exit(1);
}
