#!/usr/bin/env npx tsx

import { spawnSync } from 'node:child_process';

type Step = {
  name: string;
  command: string;
  args: string[];
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const requiredEnv = [
  'E2E_OWNER_EMAIL',
  'E2E_OWNER_PASSWORD',
  'E2E_API_URL',
  'E2E_BASE_URL',
] as const;

function runStep(step: Step): number {
  process.stdout.write(
    `\n${colors.cyan}${colors.bold}▶ ${step.name}${colors.reset}\n` +
      `${colors.yellow}$ ${step.command} ${step.args.join(' ')}${colors.reset}\n`
  );
  const result = spawnSync(step.command, step.args, {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });
  return result.status ?? 1;
}

function assertEnv(): void {
  const missing = requiredEnv.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

function runCurl(url: string): number {
  const result = spawnSync('curl', ['-sSf', url], {
    stdio: 'ignore',
    shell: false,
    env: process.env,
  });
  return result.status ?? 1;
}

function main(): void {
  try {
    assertEnv();
  } catch (error) {
    process.stderr.write(`${colors.red}${String(error)}${colors.reset}\n`);
    process.exit(1);
  }

  const apiUrl = process.env.E2E_API_URL as string;
  const baseUrl = process.env.E2E_BASE_URL as string;
  const apiHealth = `${apiUrl.replace(/\/$/, '')}/api/health/ping`;
  const uiHealth = `${baseUrl.replace(/\/$/, '')}/`;

  process.stdout.write(
    `${colors.bold}${colors.cyan}Canvas GO Hardening Gate${colors.reset}\n` +
      `API: ${apiUrl}\n` +
      `UI:  ${baseUrl}\n`
  );

  if (runCurl(apiHealth) !== 0) {
    process.stderr.write(`${colors.red}API health check failed: ${apiHealth}${colors.reset}\n`);
    process.exit(1);
  }
  if (runCurl(uiHealth) !== 0) {
    process.stderr.write(`${colors.red}UI health check failed: ${uiHealth}${colors.reset}\n`);
    process.exit(1);
  }

  const commonEnv = [
    `E2E_USE_WEB_SERVER=false`,
    `E2E_APP_URL=${baseUrl}`,
  ];
  const envPrefix = commonEnv.join(' ');
  const playwright = 'npx';

  const steps: Step[] = [
    {
      name: 'Canvas Core Flow',
      command: 'sh',
      args: [
        '-c',
        `${envPrefix} ${playwright} playwright test --config playwright.config.ts tests/e2e/smoke/work-canvas-core-flow.spec.ts --project=chromium --workers=1 --reporter=list`,
      ],
    },
    {
      name: 'Canvas Split + Deeplink + Preflight + Editor Flow',
      command: 'sh',
      args: [
        '-c',
        `${envPrefix} ${playwright} playwright test --config playwright.config.ts tests/e2e/smoke/work-canvas-split.spec.ts tests/e2e/smoke/work-canvas-deeplink.spec.ts tests/e2e/smoke/work-canvas-manual-preflight.spec.ts tests/e2e/smoke/work-canvas-editor-flow.spec.ts --project=chromium --workers=1 --reporter=list`,
      ],
    },
  ];

  for (const step of steps) {
    const status = runStep(step);
    if (status !== 0) {
      process.stderr.write(
        `\n${colors.red}${colors.bold}Canvas GO hardening failed at step: ${step.name}${colors.reset}\n`
      );
      process.exit(status);
    }
  }

  process.stdout.write(
    `\n${colors.green}${colors.bold}Canvas GO hardening gate: PASS${colors.reset}\n`
  );
}

main();
