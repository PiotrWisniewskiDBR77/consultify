#!/usr/bin/env tsx
/**
 * feedback-link-pr
 *
 * Reads the current git branch (or a branch passed via CLI), extracts the
 * short feedback id (branches created by the Cursor brief follow the
 * `feedback/<8-char-id>` convention) and PATCHes the feedback workflow with:
 *   - `branch`                (current branch)
 *   - `prUrl`                 (if GITHUB_PR_URL or `--pr <url>` is provided)
 *   - `deployStatus`          (if --deploy-status is provided)
 *   - `owner = "cursor"`      (unless --owner is provided)
 *   - `source = "cursor"`
 *   - `lastUpdatedAt`         (auto)
 *
 * Example usage (run from the repo root):
 *
 *   # After opening a PR locally — one-liner for the Cursor session:
 *   tsx scripts/feedback-link-pr.ts \
 *     --api https://api.staging.consultify.dbr77.com \
 *     --token "$SUPERADMIN_TOKEN" \
 *     --pr https://github.com/DBR77/consultify/pull/123
 *
 *   # Mark as deployed to staging:
 *   tsx scripts/feedback-link-pr.ts --deploy-status staging
 *
 * The script exits 0 on success, 1 on any failure (invalid branch, API error,
 * missing credentials). It prints the response body for auditability.
 */

import { execFileSync } from 'node:child_process';
import { argv, exit } from 'node:process';

interface CliArgs {
  api: string;
  token: string;
  branch?: string;
  prUrl?: string;
  owner?: string;
  deployStatus?: string;
  note?: string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = argv.slice(2);
  const out: CliArgs = {
    api: process.env.FEEDBACK_API_URL || process.env.API_URL || 'http://localhost:8080',
    token: process.env.FEEDBACK_API_TOKEN || process.env.SUPERADMIN_TOKEN || '',
    dryRun: false,
  };
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    const next = args[i + 1];
    switch (key) {
      case '--api':
        out.api = next;
        i++;
        break;
      case '--token':
        out.token = next;
        i++;
        break;
      case '--branch':
        out.branch = next;
        i++;
        break;
      case '--pr':
      case '--pr-url':
        out.prUrl = next;
        i++;
        break;
      case '--owner':
        out.owner = next;
        i++;
        break;
      case '--deploy-status':
        out.deployStatus = next;
        i++;
        break;
      case '--note':
        out.note = next;
        i++;
        break;
      case '--dry-run':
        out.dryRun = true;
        break;
      case '-h':
      case '--help':
        printHelp();
        exit(0);
        break;
      default:
        if (key && !key.startsWith('--')) {
          // ignore positional
        }
    }
  }
  if (!out.prUrl && process.env.GITHUB_PR_URL) out.prUrl = process.env.GITHUB_PR_URL;
  return out;
}

function printHelp(): void {
  process.stdout.write(
    `Usage: tsx scripts/feedback-link-pr.ts [options]\n\n` +
      `Options:\n` +
      `  --api <url>           API base URL (default env FEEDBACK_API_URL)\n` +
      `  --token <jwt>         SuperAdmin bearer token (default env SUPERADMIN_TOKEN)\n` +
      `  --branch <name>       Override current git branch\n` +
      `  --pr <url>            PR URL to record (GITHUB_PR_URL env fallback)\n` +
      `  --owner <handle>      Override owner (defaults to 'cursor')\n` +
      `  --deploy-status <s>   e.g. staging | production | rolled_back\n` +
      `  --note <text>         Free-form note stored in the workflow timeline\n` +
      `  --dry-run             Print payload and exit, do not PATCH\n`
  );
}

function getCurrentBranch(): string {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Branches created by the Cursor brief use the shape `feedback/<8hex>`.
 * We also tolerate `feedback/<8hex>-<anything>` for human-friendly suffixes.
 */
function extractShortIdFromBranch(branch: string): string | null {
  const m = /^feedback\/([0-9a-f]{8})(?:[-/].*)?$/i.exec(branch);
  return m ? m[1].toLowerCase() : null;
}

async function resolveFeedbackId(apiBase: string, token: string, shortId: string): Promise<string> {
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/feedback`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`GET /api/feedback failed: ${res.status} ${res.statusText}`);
  }
  const payload = (await res.json()) as unknown;
  const items: Array<{ id?: string }> = Array.isArray(payload)
    ? (payload as Array<{ id?: string }>)
    : Array.isArray((payload as { items?: unknown }).items)
      ? ((payload as { items: Array<{ id?: string }> }).items)
      : [];
  const match = items.find(
    (item) => typeof item.id === 'string' && item.id.toLowerCase().startsWith(shortId)
  );
  if (!match?.id) {
    throw new Error(`No feedback row matches short id '${shortId}'. Check the branch name.`);
  }
  return match.id;
}

async function patchWorkflow(
  apiBase: string,
  token: string,
  feedbackId: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const url = `${apiBase.replace(/\/$/, '')}/api/feedback/${encodeURIComponent(feedbackId)}/workflow`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PATCH workflow failed: ${res.status} ${res.statusText}\n${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (!args.token && !args.dryRun) {
    console.error('Missing --token or SUPERADMIN_TOKEN env. Refusing to PATCH.');
    exit(1);
  }
  const branch = args.branch || getCurrentBranch();
  if (!branch) {
    console.error('Could not resolve current git branch. Pass --branch explicitly.');
    exit(1);
  }
  const shortId = extractShortIdFromBranch(branch);
  if (!shortId) {
    console.error(
      `Branch '${branch}' does not look like a Cursor feedback branch ` +
        `(expected 'feedback/<8hex>'). Nothing to do.`
    );
    exit(1);
  }

  const payload: Record<string, unknown> = {
    branch,
    source: 'cursor',
    owner: args.owner ?? 'cursor',
  };
  if (args.prUrl) payload.prUrl = args.prUrl;
  if (args.deployStatus) payload.deployStatus = args.deployStatus;
  if (args.note) payload.note = args.note;

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          action: 'feedback-link-pr (dry-run)',
          api: args.api,
          branch,
          shortId,
          payload,
        },
        null,
        2
      )
    );
    exit(0);
  }

  const feedbackId = await resolveFeedbackId(args.api, args.token, shortId);
  const result = await patchWorkflow(args.api, args.token, feedbackId, payload);
  console.log(
    JSON.stringify(
      {
        action: 'feedback-link-pr',
        api: args.api,
        branch,
        feedbackId,
        payload,
        response: result,
      },
      null,
      2
    )
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  exit(1);
});
