/**
 * CI sanity checks for architecture hygiene (T122).
 *
 * Goal: catch route drift regressions early without booting the full server.
 *
 * Run:
 *   npx tsx server/scripts/arch-sanity-ci.ts
 */
import fs from 'node:fs';
import path from 'node:path';

type Finding = { level: 'warn' | 'error'; message: string };

function read(rel: string): string {
  const p = path.resolve(process.cwd(), rel);
  return fs.readFileSync(p, 'utf8');
}

function countMatches(haystack: string, re: RegExp): number {
  const m = haystack.match(re);
  return m ? m.length : 0;
}

async function main() {
  const findings: Finding[] = [];

  const gateway = read('server/src/Gateway.ts');
  const aiIndex = read('server/src/routes/ai/index.ts');

  // 1) Reserved canonical alias: /api/ai/prompts must NOT be shadowed by aggregated aiDomainRoutes.
  if (/router\.use\(\s*['"]\/prompts['"]/.test(aiIndex)) {
    findings.push({
      level: 'error',
      message:
        '`server/src/routes/ai/index.ts` mounts `router.use("/prompts", ...)` which shadows the canonical `/api/ai/prompts` alias. Use a distinct legacy path (e.g. `/ai-prompts`).',
    });
  }

  // 2) Ensure canonical prompt SSOT routes exist in gateway.
  const hasAiPrompts = gateway.includes("app.use('/api/ai-prompts'");
  const hasAiPromptsAlias = gateway.includes("app.use('/api/ai/prompts'");
  if (!hasAiPrompts) {
    findings.push({
      level: 'error',
      message: '`server/src/Gateway.ts` is missing canonical mount: `app.use("/api/ai-prompts", ...)`.',
    });
  }
  if (!hasAiPromptsAlias) {
    findings.push({
      level: 'warn',
      message:
        '`server/src/Gateway.ts` is missing legacy alias: `app.use("/api/ai/prompts", ...)` (optional but recommended for no-breaking rollout).',
    });
  }

  // 3) Prod stubs must not be enabled.
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const stubEnabled = String(process.env.ENABLE_STUB_ROUTES || '').toLowerCase() === 'true';
  if (isProd && stubEnabled) {
    findings.push({
      level: 'error',
      message:
        'Stub routes are enabled in production (`ENABLE_STUB_ROUTES=true`). Disable stubs for prod.',
    });
  }

  // 4) Lightweight duplicate mount signal (best-effort).
  const aiMountCount = countMatches(gateway, /app\.use\(\s*['"]\/api\/ai['"]\s*,/g);
  if (aiMountCount > 2) {
    findings.push({
      level: 'warn',
      message: `Gateway mounts "/api/ai" ${aiMountCount} times (unexpected; risk of drift).`,
    });
  }

  // Output
  if (findings.length === 0) {
    // eslint-disable-next-line no-console
    console.log('[arch-sanity-ci] OK');
    return;
  }

  // eslint-disable-next-line no-console
  console.log('[arch-sanity-ci] Findings:');
  for (const f of findings) {
    // eslint-disable-next-line no-console
    console.log(`- [${f.level.toUpperCase()}] ${f.message}`);
  }

  if (findings.some((f) => f.level === 'error')) {
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[arch-sanity-ci] Failed:', err);
  process.exit(1);
});

