#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type Check = { name: string; pass: boolean; details?: string };

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function has(content: string, needle: string): boolean {
  return content.includes(needle);
}

function main(): void {
  const root = process.cwd();
  const checks: Check[] = [];

  const migrationPath = path.join(root, 'server/migrations/575_interview_sendback_missing_items.sql');
  const controllerPath = path.join(root, 'server/src/controllers/InterviewController.ts');
  const workspacePath = path.join(root, 'src/components/Interview/InterviewWorkspace.tsx');
  const questionsPath = path.join(root, 'src/components/Interview/QuestionsList.tsx');
  const analyticsPath = path.join(root, 'src/services/funnelAnalytics.ts');

  checks.push({
    name: 'migration 575 exists',
    pass: fs.existsSync(migrationPath),
    details: migrationPath,
  });

  const controller = read(controllerPath);
  checks.push({
    name: 'D01 send-back requires reason',
    pass: has(controller, 'Send-back reason is required'),
  });
  checks.push({
    name: 'D01 persists missing_items_json',
    pass: has(controller, 'missing_items_json') && has(controller, 'missingItems'),
  });
  checks.push({
    name: 'D01 approve gate completeness >= 50%',
    pass: has(controller, 'Cannot approve: completeness is < 50%') && has(controller, 'completenessRatio < 0.5'),
  });

  const workspace = read(workspacePath);
  checks.push({
    name: 'D02 RuntimeModeSelector mounted in InterviewWorkspace',
    pass: has(workspace, '<RuntimeModeSelector') && has(workspace, 'recommendedMode="task_list"'),
  });
  checks.push({
    name: 'D02 runtime mode telemetry emitted',
    pass:
      has(workspace, "trackFunnelEvent('interview_runtime_mode_selected'") &&
      has(workspace, "trackFunnelEvent('interview_runtime_mode_changed'"),
  });

  const questions = read(questionsPath);
  checks.push({
    name: 'D02 runtime mode affects question rendering',
    pass:
      has(questions, "runtimeMode?: 'single_question' | 'task_list'") &&
      has(questions, "runtimeMode === 'single_question'"),
  });

  const analytics = read(analyticsPath);
  checks.push({
    name: 'analytics catalog includes D02 events',
    pass:
      has(analytics, "'interview_runtime_mode_selected'") &&
      has(analytics, "'interview_runtime_mode_changed'"),
  });

  const failed = checks.filter((c) => !c.pass);
  console.log('\n[smoke-interview-d01-d02] Summary:');
  for (const c of checks) {
    console.log(` - ${c.pass ? 'OK' : 'FAIL'} ${c.name}${c.details ? ` (${c.details})` : ''}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((f) => f.name).join(', ')}`);
  }

  console.log('\n[smoke-interview-d01-d02] Contract checks passed.');
}

try {
  main();
} catch (error) {
  console.error('[smoke-interview-d01-d02] Failed:', (error as Error)?.message || error);
  process.exit(1);
}

