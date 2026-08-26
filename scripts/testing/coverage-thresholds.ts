#!/usr/bin/env node
/* eslint-disable no-console */

import fs from 'node:fs';
import path from 'node:path';
import istanbulCoverage from 'istanbul-lib-coverage';

type Thresholds = Record<
  string,
  { statements: number; branches: number; functions: number; lines: number }
>;

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) continue;
    out[key] = value;
    i++;
  }
  return out;
}

function getProfileThresholds(profile: string): Thresholds {
  if (profile === 'l1') {
    return {
      'server/src/middleware/auth.middleware.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/middleware/csrf.middleware.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/middleware/permission.middleware.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/middleware/inputSanitization.middleware.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/middleware/rateLimitUserId.middleware.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/services/accessPolicyService.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/utils/security.utils.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
    };
  }

  if (profile === 'l2') {
    return {
      'views/auth/LoginView.tsx': { statements: 95, branches: 80, functions: 95, lines: 95 },
      'src/components/auth/MFASetup.tsx': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'src/components/auth/MFAChallenge.tsx': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'src/components/navigation/Sidebar/menuConfig.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'src/components/navigation/Sidebar/Sidebar.tsx': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'src/components/navigation/Sidebar/NavItem.tsx': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'src/components/navigation/Sidebar/SidebarFooter.tsx': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'src/components/navigation/Sidebar/SidebarHeader.tsx': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'src/components/navigation/Sidebar/FloatingSubmenu.tsx': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'src/views/OrganizationView.tsx': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'src/components/Organization/OrganizationSidebar.tsx': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
    };
  }

  if (profile === 'l3') {
    return {
      'server/src/routes/securityPolicies.routes.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/routes/security.routes.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/routes/security/roles.routes.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/routes/notifications/notificationSettings.routes.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/routes/loginHistory.routes.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/routes/verify.routes.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/routes/mcp.routes.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/routes/audit.routes.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/routes/auditLog.routes.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/routes/systemHealth.routes.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/routes/db-metrics.routes.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/routes/status.routes.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/routes/status-reports.routes.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/routes/stabilization.routes.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/routes/apiKeys.routes.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/routes/healthRoutes.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/routes/health.routes.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
      'server/src/controllers/HealthCheckController.ts': {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
    };
  }

  throw new Error(`Unknown profile: ${profile}`);
}

function pct(n: number | undefined): number {
  return typeof n === 'number' ? n : 0;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const reportPath = args.report;
  const profile = args.profile;

  if (!reportPath || !profile) {
    console.error('Usage: coverage-thresholds --report <path> --profile <l1|l2|l3>');
    process.exit(2);
  }

  const absReport = path.resolve(process.cwd(), reportPath);
  if (!fs.existsSync(absReport)) {
    console.error(`Missing report: ${absReport}`);
    process.exit(2);
  }

  const report = JSON.parse(fs.readFileSync(absReport, 'utf-8')) as any;
  const rawCoverage = report.coverageMap?.data || report.coverageMap;
  if (!rawCoverage) {
    console.error(`Report does not contain coverageMap: ${absReport}`);
    process.exit(2);
  }

  const thresholds = getProfileThresholds(profile);
  const { createCoverageMap } = istanbulCoverage as any;
  const map = createCoverageMap(rawCoverage);

  const failures: string[] = [];
  for (const [relPath, t] of Object.entries(thresholds)) {
    const file = path.resolve(process.cwd(), relPath);
    let summary;
    try {
      summary = map.fileCoverageFor(file).toSummary().data;
    } catch {
      failures.push(`${relPath}: missing in coverageMap`);
      continue;
    }

    const checks: Array<[keyof typeof t, number]> = [
      ['statements', pct(summary.statements?.pct)],
      ['branches', pct(summary.branches?.pct)],
      ['functions', pct(summary.functions?.pct)],
      ['lines', pct(summary.lines?.pct)],
    ];

    for (const [k, got] of checks) {
      const need = t[k];
      if (got + 1e-9 < need) {
        failures.push(`${relPath}: ${k} ${got.toFixed(2)}% < ${need}%`);
      }
    }
  }

  if (failures.length) {
    console.error('Coverage thresholds failed:');
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }

  console.log('Coverage thresholds OK.');
  process.exit(0);
}

main();
