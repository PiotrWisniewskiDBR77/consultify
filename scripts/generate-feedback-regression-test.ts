#!/usr/bin/env tsx
/**
 * generate-feedback-regression-test
 *
 * Pulls a feedback ticket from the API and scaffolds a regression test file
 * so that every Cursor-resolved bug leaves a tiny guard behind. The script is
 * intentionally conservative: it generates a *skeleton* with TODO markers
 * rather than a passing assertion, because we don't have enough semantic
 * context to auto-write the real expectation. A human (or Cursor) fills in
 * the blanks before opening the PR.
 *
 * Usage (from repo root):
 *
 *   # By explicit feedback id:
 *   tsx scripts/generate-feedback-regression-test.ts \
 *     --id <feedback-uuid> \
 *     --api https://api.staging.consultify.dbr77.com \
 *     --token "$SUPERADMIN_TOKEN"
 *
 *   # Or inferred from the current git branch `feedback/<8>`:
 *   tsx scripts/generate-feedback-regression-test.ts
 *
 *   # Options:
 *   --out-dir tests/regression   (default)
 *   --framework vitest|playwright (default: vitest)
 *   --dry-run
 *
 * Output: tests/regression/feedback-<short-id>.spec.ts
 *
 * Exits 1 on any failure (bad args, API errors, ambiguous branch, file exists
 * without --force).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { argv, cwd, exit } from 'node:process';

interface CliArgs {
  id?: string;
  api: string;
  token: string;
  outDir: string;
  framework: 'vitest' | 'playwright';
  dryRun: boolean;
  force: boolean;
}

function parseArgs(): CliArgs {
  const args = argv.slice(2);
  const out: CliArgs = {
    api: process.env.FEEDBACK_API_URL || process.env.API_URL || 'http://localhost:8080',
    token: process.env.FEEDBACK_API_TOKEN || process.env.SUPERADMIN_TOKEN || '',
    outDir: 'tests/regression',
    framework: 'vitest',
    dryRun: false,
    force: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    switch (a) {
      case '--id':
        out.id = next;
        i++;
        break;
      case '--api':
        out.api = next;
        i++;
        break;
      case '--token':
        out.token = next;
        i++;
        break;
      case '--out-dir':
        out.outDir = next;
        i++;
        break;
      case '--framework':
        if (next === 'vitest' || next === 'playwright') out.framework = next;
        i++;
        break;
      case '--dry-run':
        out.dryRun = true;
        break;
      case '--force':
        out.force = true;
        break;
      case '--help':
      case '-h':
        console.log(
          'Usage: tsx scripts/generate-feedback-regression-test.ts [--id UUID] [--api URL] [--token TOKEN] [--out-dir DIR] [--framework vitest|playwright] [--dry-run] [--force]'
        );
        exit(0);
    }
  }
  return out;
}

function getCurrentBranch(): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function inferFeedbackShortIdFromBranch(branch: string | null): string | null {
  if (!branch) return null;
  const m = branch.match(/^feedback\/([a-f0-9-]{6,})/i);
  return m ? m[1] : null;
}

async function resolveFullId(args: CliArgs): Promise<string> {
  if (args.id && args.id.length >= 8) return args.id;

  const branch = getCurrentBranch();
  const shortId = inferFeedbackShortIdFromBranch(branch);
  if (!shortId) {
    throw new Error(
      `Could not infer feedback id. Pass --id <uuid> or switch to a feedback/<short-id> branch.`
    );
  }

  // Call the feedback list endpoint and match by prefix. The list endpoint is
  // SuperAdmin-only, so we need a token here.
  if (!args.token) {
    throw new Error('Missing token: set --token or SUPERADMIN_TOKEN env var.');
  }
  const url = `${args.api.replace(/\/$/, '')}/api/feedback?limit=200`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${args.token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to list feedback: ${res.status} ${res.statusText}`);
  }
  const items = (await res.json()) as Array<{ id: string }>;
  const match = items.find((it) => it?.id?.toLowerCase().startsWith(shortId.toLowerCase()));
  if (!match) {
    throw new Error(`No feedback found for short id ${shortId}. Pass --id explicitly.`);
  }
  return match.id;
}

interface FeedbackDetail {
  id: string;
  title?: string;
  description?: string;
  severity?: string;
  feedback_type?: string;
  source_env?: string;
  metadata?: Record<string, unknown>;
}

async function fetchFeedback(args: CliArgs, id: string): Promise<FeedbackDetail> {
  if (!args.token) {
    throw new Error('Missing token: set --token or SUPERADMIN_TOKEN env var.');
  }
  const url = `${args.api.replace(/\/$/, '')}/api/feedback/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${args.token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch feedback: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as FeedbackDetail;
}

function renderVitestTemplate(detail: FeedbackDetail): string {
  const title = String(detail.title || 'feedback regression').replace(/`/g, "'");
  const shortId = detail.id.slice(0, 8);
  const cluster =
    ((detail.metadata as any)?.workflow?.cluster as string) ||
    ((detail.metadata as any)?.cluster as string) ||
    null;
  const routePath =
    ((detail.metadata as any)?.context?.routePath as string) ||
    ((detail.metadata as any)?.routePath as string) ||
    null;
  const severity = String(detail.severity || 'UNSPECIFIED').toUpperCase();
  const typeUpper = String(detail.feedback_type || 'BUG').toUpperCase();
  const reproSteps =
    ((detail.metadata as any)?.reproSteps as string) ||
    ((detail.metadata as any)?.steps as string) ||
    'TODO: document reproduction steps here.';

  return `/**
 * Regression guard for feedback ${detail.id}
 *
 * Title:     ${title}
 * Type:      ${typeUpper}
 * Severity:  ${severity}
 * Cluster:   ${cluster || '—'}
 * Route:     ${routePath || '—'}
 *
 * Reproduction (from reporter):
 * ${reproSteps.split('\n').map((l) => ` *   ${l}`).join('\n')}
 *
 * TODO — this is a SKELETON. Before merging the fix PR:
 *   1. Move the arrange/act/assert below into the closest existing test
 *      module if one already covers this area (search for keywords from the
 *      title first), and delete this skeleton file.
 *   2. Replace the \`expect(true).toBe(true)\` with the minimum assertion
 *      that would have failed against the broken build.
 *   3. Keep this test fast (<100ms) — do NOT hit the network.
 */

import { describe, expect, it } from 'vitest';

describe('feedback/${shortId} regression — ${title}', () => {
  it('reproduces and fails against the original broken state', () => {
    // TODO: arrange the minimal failing state reported in ${detail.id}
    // TODO: act
    // TODO: expect(...).toMatchTheFix()
    expect(true).toBe(true);
  });
});
`;
}

function renderPlaywrightTemplate(detail: FeedbackDetail): string {
  const title = String(detail.title || 'feedback regression').replace(/`/g, "'");
  const shortId = detail.id.slice(0, 8);
  const routePath =
    ((detail.metadata as any)?.context?.routePath as string) ||
    ((detail.metadata as any)?.routePath as string) ||
    '/';
  return `/**
 * Playwright regression guard for feedback ${detail.id}
 *
 * Title:  ${title}
 * Route:  ${routePath}
 *
 * TODO — SKELETON: replace the placeholder assertion with a real check that
 * would have failed against the broken build. Keep the selector stable
 * (prefer data-testid) so the test survives minor UI tweaks.
 */

import { expect, test } from '@playwright/test';

test('feedback/${shortId} regression — ${title}', async ({ page }) => {
  await page.goto('${routePath}');
  // TODO: assert the fix is present on the rendered view.
  await expect(page).toHaveURL(new RegExp('${routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')}'));
});
`;
}

async function main(): Promise<void> {
  const args = parseArgs();
  try {
    const fullId = await resolveFullId(args);
    const detail = await fetchFeedback(args, fullId);

    const content =
      args.framework === 'playwright'
        ? renderPlaywrightTemplate(detail)
        : renderVitestTemplate(detail);

    const shortId = detail.id.slice(0, 8);
    const filename = `feedback-${shortId}.${args.framework === 'playwright' ? 'e2e' : 'spec'}.ts`;
    const targetPath = resolve(cwd(), args.outDir, filename);

    if (args.dryRun) {
      console.log(`[dry-run] would write ${targetPath}`);
      console.log('---');
      console.log(content);
      return;
    }

    if (existsSync(targetPath) && !args.force) {
      throw new Error(`Refusing to overwrite ${targetPath} (pass --force to override).`);
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, content, 'utf8');
    console.log(`[ok] wrote regression skeleton: ${targetPath}`);
    console.log(
      `[next] fill in the TODOs, then:\n` +
        `      git add ${args.outDir}/${filename}\n` +
        `      npm test -- ${args.outDir}/${filename}`
    );
  } catch (err) {
    console.error(
      `[fail] ${err instanceof Error ? err.message : String(err)}`
    );
    exit(1);
  }
}

void main();
