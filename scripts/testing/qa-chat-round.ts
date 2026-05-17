#!/usr/bin/env npx tsx
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

type Status = 'PASS' | 'BLOCKED_P0' | 'BLOCKED_P1' | 'PASS_WITH_P2' | 'INCONCLUSIVE';

type Evidence = {
  ui: string[];
  sources: string[];
  network: string[];
};

type AreaResult = {
  areaId: string;
  title: string;
  status: Status;
  observations: string;
  evidence: Evidence;
  defectIds: string[];
};

type RoundReport = {
  metadata: {
    roundId: string;
    env: string;
    tester: string;
    account: string;
    buildId: string;
    startedAt: string;
    finishedAt: string | null;
  };
  areas: AreaResult[];
  defects: Array<{
    id: string;
    severity: 'P0' | 'P1' | 'P2' | 'P3';
    title: string;
    status: 'OPEN' | 'CLOSED';
    owner: string;
    eta: string;
  }>;
  globalDecision: 'GO' | 'GO_WITH_RISK' | 'NO-GO' | null;
  notes: string;
};

const ALLOWED_STATUSES: Status[] = [
  'PASS',
  'BLOCKED_P0',
  'BLOCKED_P1',
  'PASS_WITH_P2',
  'INCONCLUSIVE',
];

const CHAT_AREAS: Array<{ areaId: string; title: string; requiresSources: boolean }> = [
  { areaId: 'A', title: 'Core chat response quality', requiresSources: true },
  { areaId: 'B', title: 'Deep Thinking and Show Reasoning', requiresSources: true },
  { areaId: 'C', title: 'Attachments and truthful degradation', requiresSources: false },
  { areaId: 'D', title: 'Web research integrity', requiresSources: true },
  { areaId: 'E', title: 'History, folders, rename, refresh', requiresSources: false },
  { areaId: 'F', title: 'Product assistant usefulness', requiresSources: false },
  { areaId: 'G', title: 'Follow-up context chain', requiresSources: false },
  { areaId: 'H', title: 'Trust/Sources panel UX hardening', requiresSources: true },
  { areaId: 'I', title: 'Teresa proposals/governed action flow', requiresSources: false },
  { areaId: 'J', title: 'Route and refresh resilience', requiresSources: false },
];

const PRECHECK_COMMANDS = [
  'npm run lint',
  'npm run type-check',
  'npx vitest run "src/components/AIChat/__tests__/TrustBadge.test.tsx"',
  'npx vitest run "tests/components/AIChat/MessageRenderer.policy.test.tsx"',
  'npm run test:aios:wave-1',
];

function argValue(name: string): string | null {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function nowIso(): string {
  return new Date().toISOString();
}

function createRoundId(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `ROUND-CHAT-${y}-${m}-${day}-${hh}${mm}`;
}

function runCommand(command: string): void {
  console.log(`\n[qa-chat-round] $ ${command}`);
  const out = spawnSync('sh', ['-c', command], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });
  if ((out.status ?? 1) !== 0) {
    throw new Error(`Command failed: ${command}`);
  }
}

function ensureDir(target: string): void {
  fs.mkdirSync(target, { recursive: true });
}

function writeJson(file: string, data: unknown): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function createTemplateReport(
  roundId: string,
  env: string,
  tester: string,
  account: string
): RoundReport {
  return {
    metadata: {
      roundId,
      env,
      tester,
      account,
      buildId: 'PENDING_DEPLOY_ID',
      startedAt: nowIso(),
      finishedAt: null,
    },
    areas: CHAT_AREAS.map((a) => ({
      areaId: a.areaId,
      title: a.title,
      status: 'INCONCLUSIVE',
      observations: '',
      evidence: { ui: [], sources: [], network: [] },
      defectIds: [],
    })),
    defects: [],
    globalDecision: null,
    notes: '',
  };
}

function templateMd(round: RoundReport): string {
  const rows = round.areas
    .map((a) => `| ${a.areaId}. ${a.title} | ${a.status} | ${a.observations || ''} |  |  |  |`)
    .join('\n');
  return `# ${round.metadata.roundId}

Environment: \`${round.metadata.env}\`  
Tester: \`${round.metadata.tester}\`  
Account: \`${round.metadata.account}\`  
Build ID: \`${round.metadata.buildId}\`

## Areas

| Area | Status | Observations | UI evidence | Sources evidence | Network evidence |
| --- | --- | --- | --- | --- | --- |
${rows}

## Defects

| Defect ID | Severity | Title | Status | Owner | ETA |
| --- | --- | --- | --- | --- | --- |

## Global

- Suggested decision: \`GO / GO_WITH_RISK / NO-GO\`
- Notes:
`;
}

function validateReport(report: RoundReport): { errors: string[]; warnings: string[]; suggested: string } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const byId = new Map(report.areas.map((a) => [a.areaId, a]));
  for (const def of CHAT_AREAS) {
    const area = byId.get(def.areaId);
    if (!area) {
      errors.push(`Missing area ${def.areaId}`);
      continue;
    }
    if (!ALLOWED_STATUSES.includes(area.status)) {
      errors.push(`Area ${def.areaId} has invalid status: ${String(area.status)}`);
    }
    const status = area.status;
    const passLike = status === 'PASS' || status === 'PASS_WITH_P2';
    if (passLike) {
      if (!area.evidence.ui?.length) errors.push(`Area ${def.areaId} missing UI evidence`);
      if (!area.evidence.network?.length) errors.push(`Area ${def.areaId} missing Network evidence`);
      if (def.requiresSources && !area.evidence.sources?.length) {
        errors.push(`Area ${def.areaId} missing Sources evidence`);
      }
    }
    if (!area.observations || area.observations.trim().length < 8) {
      warnings.push(`Area ${def.areaId} observations are very short`);
    }
  }

  const p0 = report.areas.filter((a) => a.status === 'BLOCKED_P0').length;
  const p1 = report.areas.filter((a) => a.status === 'BLOCKED_P1').length;
  const suggested = p0 > 0 || p1 >= 2 ? 'NO-GO' : p1 === 1 ? 'GO_WITH_RISK' : 'GO';

  if (report.globalDecision && report.globalDecision !== suggested) {
    warnings.push(`Global decision differs from suggested policy result (${suggested})`);
  }
  return { errors, warnings, suggested };
}

function runInit(): void {
  const roundId = argValue('--round-id') || createRoundId();
  const env = argValue('--env') || 'https://demo.consultify.ai';
  const tester = argValue('--tester') || 'QA Tester';
  const account = argValue('--account') || 'piotr.wisniewski@dbr77.com';
  const skipPreflight = hasFlag('--skip-preflight');

  if (!skipPreflight) {
    console.log('[qa-chat-round] Running chat preflight...');
    for (const cmd of PRECHECK_COMMANDS) runCommand(cmd);
    console.log('[qa-chat-round] Preflight passed.');
  } else {
    console.log('[qa-chat-round] Preflight skipped (--skip-preflight).');
  }

  const targetDir = path.join(process.cwd(), 'test-results', 'manual-rounds', roundId);
  ensureDir(targetDir);
  const jsonPath = path.join(targetDir, 'report.template.json');
  const mdPath = path.join(targetDir, 'report.template.md');
  const report = createTemplateReport(roundId, env, tester, account);
  writeJson(jsonPath, report);
  fs.writeFileSync(mdPath, templateMd(report), 'utf8');

  console.log('\n[qa-chat-round] Round initialized.');
  console.log(`[qa-chat-round] JSON template: ${jsonPath}`);
  console.log(`[qa-chat-round] Markdown template: ${mdPath}`);
  console.log(
    '[qa-chat-round] Next: fill report.template.json with statuses/evidence and run validate.'
  );
}

function runValidate(): void {
  const file =
    argValue('--file') ||
    path.join(process.cwd(), 'test-results', 'manual-rounds', argValue('--round-id') || '', 'report.template.json');
  if (!file || !fs.existsSync(file)) {
    throw new Error('Provide an existing report file via --file <path> or --round-id <id>.');
  }

  const report = readJson<RoundReport>(file);
  const validation = validateReport(report);
  const output = {
    validatedAt: nowIso(),
    file,
    suggestedDecision: validation.suggested,
    errors: validation.errors,
    warnings: validation.warnings,
  };
  const outPath = file.replace(/\.json$/i, '.validation.json');
  writeJson(outPath, output);

  console.log(`\n[qa-chat-round] Suggested decision: ${validation.suggested}`);
  if (validation.warnings.length) {
    console.log('[qa-chat-round] Warnings:');
    for (const w of validation.warnings) console.log(` - ${w}`);
  }
  if (validation.errors.length) {
    console.log('[qa-chat-round] Errors:');
    for (const e of validation.errors) console.log(` - ${e}`);
    console.log(`[qa-chat-round] Validation file: ${outPath}`);
    process.exit(1);
  }

  console.log('[qa-chat-round] Validation passed.');
  console.log(`[qa-chat-round] Validation file: ${outPath}`);
}

function runHelp(): void {
  console.log(`Usage:
  npx tsx scripts/testing/qa-chat-round.ts init [--round-id ID] [--env URL] [--tester NAME] [--account MAIL] [--skip-preflight]
  npx tsx scripts/testing/qa-chat-round.ts validate --file <path-to-report.template.json>
  npx tsx scripts/testing/qa-chat-round.ts close --file <path-to-report.template.json>
`);
}

function toDecision(report: RoundReport): 'GO' | 'GO_WITH_RISK' | 'NO-GO' {
  const p0 = report.areas.filter((a) => a.status === 'BLOCKED_P0').length;
  const p1 = report.areas.filter((a) => a.status === 'BLOCKED_P1').length;
  if (p0 > 0 || p1 >= 2) return 'NO-GO';
  if (p1 === 1) return 'GO_WITH_RISK';
  return 'GO';
}

function closeMarkdown(report: RoundReport, suggested: string): string {
  const rows = report.areas
    .map(
      (a) =>
        `| ${a.areaId}. ${a.title} | ${a.status} | ${(a.observations || '').replace(/\n/g, ' ')} | ${a.defectIds.join(', ') || '-'} |`
    )
    .join('\n');
  const defectRows = report.defects.length
    ? report.defects
        .map(
          (d) =>
            `| ${d.id} | ${d.severity} | ${d.title} | ${d.status} | ${d.owner} | ${d.eta} |`
        )
        .join('\n')
    : '| - | - | No open defects recorded | - | - | - |';

  const openP0P1 = report.defects.filter(
    (d) => d.status !== 'CLOSED' && (d.severity === 'P0' || d.severity === 'P1')
  );

  return `# Chat Round Closure — ${report.metadata.roundId}

Environment: \`${report.metadata.env}\`  
Tester: \`${report.metadata.tester}\`  
Account: \`${report.metadata.account}\`  
Build ID: \`${report.metadata.buildId}\`  
Started: \`${report.metadata.startedAt}\`  
Finished: \`${report.metadata.finishedAt || 'N/A'}\`

## Scenario outcome

| Area | Result | Key observation | Defect IDs |
| --- | --- | --- | --- |
${rows}

## Defects

| Defect ID | Severity | Title | Status | Owner | ETA |
| --- | --- | --- | --- | --- | --- |
${defectRows}

## Decision

- Suggested by policy: \`${suggested}\`
- Reported global decision: \`${report.globalDecision ?? 'N/A'}\`
- Open P0/P1 defects: **${openP0P1.length}**

## Notes

${report.notes || '-'}
`;
}

function runClose(): void {
  const file =
    argValue('--file') ||
    path.join(
      process.cwd(),
      'test-results',
      'manual-rounds',
      argValue('--round-id') || '',
      'report.template.json'
    );
  if (!file || !fs.existsSync(file)) {
    throw new Error('Provide an existing report file via --file <path> or --round-id <id>.');
  }

  const report = readJson<RoundReport>(file);
  const validation = validateReport(report);
  if (validation.errors.length) {
    throw new Error(
      `Cannot close round. Validation errors: ${validation.errors.join(' | ')}`
    );
  }

  const suggested = toDecision(report);
  const ts = new Date();
  const y = ts.getFullYear();
  const m = String(ts.getMonth() + 1).padStart(2, '0');
  const d = String(ts.getDate()).padStart(2, '0');
  const hh = String(ts.getHours()).padStart(2, '0');
  const mm = String(ts.getMinutes()).padStart(2, '0');
  const filename = `CHAT_ROUND_CLOSURE_${y}-${m}-${d}_${hh}${mm}.md`;
  const outDir = path.join(process.cwd(), 'docs', 'testing', 'reports');
  ensureDir(outDir);
  const outPath = path.join(outDir, filename);
  fs.writeFileSync(outPath, closeMarkdown(report, suggested), 'utf8');

  const markerPath = file.replace(/\.json$/i, '.closure.json');
  writeJson(markerPath, {
    closedAt: nowIso(),
    sourceReport: file,
    closureReport: outPath,
    suggestedDecision: suggested,
    reportedDecision: report.globalDecision,
  });

  console.log(`[qa-chat-round] Closure report generated: ${outPath}`);
  console.log(`[qa-chat-round] Closure marker: ${markerPath}`);
}

function main(): void {
  const command = process.argv[2];
  if (!command || command === '--help' || command === '-h') {
    runHelp();
    return;
  }
  if (command === 'init') {
    runInit();
    return;
  }
  if (command === 'validate') {
    runValidate();
    return;
  }
  if (command === 'close') {
    runClose();
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error('[qa-chat-round] Failed:', (error as Error).message);
  process.exit(1);
}

