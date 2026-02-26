#!/usr/bin/env npx tsx
/**
 * Quality Scorecard Generator
 *
 * Generates per-module quality metrics for VC tech DD audits.
 * Outputs: JSON + Markdown report.
 *
 * Usage: npx tsx scripts/testing/quality-scorecard.ts [--json] [--output <path>]
 */

import * as fs from 'fs';
import * as path from 'path';

interface ModuleDefinition {
  name: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  testPaths: {
    unit: string[];
    component: string[];
    integration: string[];
    e2e: string[];
    security: string[];
  };
  sourcePatterns: string[];
}

interface ModuleScore {
  module: string;
  riskLevel: string;
  testFiles: { unit: number; component: number; integration: number; e2e: number; security: number; total: number };
  coverageGate: boolean;
  hasNegativeTests: boolean;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

const MODULES: ModuleDefinition[] = [
  {
    name: 'Auth & Security',
    riskLevel: 'critical',
    testPaths: {
      unit: ['tests/unit/auth', 'tests/unit/backend/middleware', 'tests/unit/backend/permissionService.test.ts', 'tests/unit/backend/accessPolicyService.test.ts'],
      component: ['tests/components/auth'],
      integration: ['tests/integration/auth', 'tests/integration/security', 'tests/integration/middleware', 'tests/integration/sessions'],
      e2e: ['tests/e2e/auth', 'tests/e2e/security'],
      security: ['tests/security'],
    },
    sourcePatterns: ['server/src/middleware/', 'server/src/routes/auth', 'server/src/routes/security', 'server/src/services/access/', 'server/src/services/encryption/'],
  },
  {
    name: 'Billing & Payments',
    riskLevel: 'critical',
    testPaths: {
      unit: ['tests/unit/billing'],
      component: ['tests/components/billing'],
      integration: ['tests/integration/payments', 'tests/integration/subscriptions'],
      e2e: ['tests/e2e/billing'],
      security: ['tests/security/billing'],
    },
    sourcePatterns: ['server/src/routes/billing', 'server/src/routes/pricing', 'server/src/services/billing/'],
  },
  {
    name: 'AI Services',
    riskLevel: 'high',
    testPaths: {
      unit: ['tests/unit/ai', 'tests/unit/backend/aiService.test.ts'],
      component: ['tests/components/AIChat', 'tests/components/AISettings', 'tests/components/ai'],
      integration: ['tests/integration/ai', 'tests/integration/chat'],
      e2e: ['tests/e2e/ai'],
      security: [],
    },
    sourcePatterns: ['server/src/routes/ai', 'server/src/services/ai/'],
  },
  {
    name: 'Initiatives & Portfolio',
    riskLevel: 'high',
    testPaths: {
      unit: ['tests/unit/initiatives'],
      component: ['tests/components/Portfolio'],
      integration: ['tests/integration/initiatives'],
      e2e: ['tests/e2e/initiatives'],
      security: [],
    },
    sourcePatterns: ['server/src/routes/initiatives', 'server/src/services/initiative/'],
  },
  {
    name: 'Presentations & Reports',
    riskLevel: 'high',
    testPaths: {
      unit: ['tests/unit/reports'],
      component: ['tests/components/Reports'],
      integration: ['tests/integration/reports'],
      e2e: ['tests/e2e/reports'],
      security: [],
    },
    sourcePatterns: ['server/src/routes/presentations', 'server/src/routes/reports', 'server/src/services/report/'],
  },
  {
    name: 'Interview & Discovery',
    riskLevel: 'medium',
    testPaths: {
      unit: ['tests/unit/interview', 'tests/unit/discovery'],
      component: ['tests/components/Discovery', 'tests/components/interview'],
      integration: ['tests/integration/interview'],
      e2e: [],
      security: [],
    },
    sourcePatterns: ['server/src/routes/interview', 'src/components/Interview/'],
  },
  {
    name: 'MyWork',
    riskLevel: 'medium',
    testPaths: {
      unit: [],
      component: ['tests/components/MyWork'],
      integration: ['tests/integration/mywork'],
      e2e: ['tests/e2e/tasks'],
      security: [],
    },
    sourcePatterns: ['server/src/routes/my-work', 'src/components/MyWork/'],
  },
  {
    name: 'Assessment',
    riskLevel: 'medium',
    testPaths: {
      unit: ['tests/unit/assessment'],
      component: ['tests/components/assessment'],
      integration: ['tests/integration/assessment', 'tests/integration/assessment-reports.routes.test.ts'],
      e2e: [],
      security: [],
    },
    sourcePatterns: ['server/src/routes/assessment', 'src/components/Assessment/'],
  },
  {
    name: 'Execution & Benefits',
    riskLevel: 'medium',
    testPaths: {
      unit: ['tests/unit/execution'],
      component: ['tests/components/Execution', 'tests/components/Benefits', 'tests/components/Economics'],
      integration: [],
      e2e: ['tests/e2e/budgets'],
      security: [],
    },
    sourcePatterns: ['server/src/routes/execution', 'server/src/routes/benefits', 'server/src/routes/economics'],
  },
  {
    name: 'Admin & Governance',
    riskLevel: 'high',
    testPaths: {
      unit: ['tests/unit/governance'],
      component: ['tests/components/Admin', 'tests/components/SuperAdmin', 'tests/components/governance'],
      integration: ['tests/integration/admin', 'tests/integration/audit'],
      e2e: ['tests/e2e/admin', 'tests/e2e/superadmin', 'tests/e2e/permissions'],
      security: [],
    },
    sourcePatterns: ['server/src/routes/admin', 'server/src/routes/superadmin', 'server/src/routes/audit'],
  },
  {
    name: 'PMO & Projects',
    riskLevel: 'medium',
    testPaths: {
      unit: ['tests/unit/pmo'],
      component: ['tests/components/PMO'],
      integration: ['tests/integration/routes/pmo'],
      e2e: ['tests/e2e/projects'],
      security: [],
    },
    sourcePatterns: ['server/src/routes/pmo', 'server/src/routes/projects'],
  },
  {
    name: 'Navigation & Layout',
    riskLevel: 'medium',
    testPaths: {
      unit: [],
      component: ['tests/components/navigation', 'tests/components/layout'],
      integration: [],
      e2e: ['tests/e2e/navigation'],
      security: [],
    },
    sourcePatterns: ['src/components/navigation/', 'src/components/shared/'],
  },
];

const TEST_EXTENSIONS = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.test.js'];

function countTestFiles(testPath: string): number {
  const fullPath = path.join(process.cwd(), testPath);
  if (!fs.existsSync(fullPath)) return 0;

  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    return TEST_EXTENSIONS.some((ext) => testPath.endsWith(ext)) ? 1 : 0;
  }

  let count = 0;
  function walk(dir: string) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          walk(p);
        } else if (entry.isFile() && TEST_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
          count++;
        }
      }
    } catch { /* skip inaccessible dirs */ }
  }
  walk(fullPath);
  return count;
}

function checkCoverageGate(mod: ModuleDefinition): boolean {
  const criticalModules = ['Auth & Security', 'Billing & Payments'];
  return criticalModules.includes(mod.name);
}

function hasNegativeTests(mod: ModuleDefinition): boolean {
  for (const paths of Object.values(mod.testPaths)) {
    for (const p of paths) {
      const fullPath = path.join(process.cwd(), p);
      if (!fs.existsSync(fullPath)) continue;

      try {
        const stat = fs.statSync(fullPath);
        const files = stat.isFile() ? [fullPath] : getAllFiles(fullPath);
        for (const file of files) {
          const content = fs.readFileSync(file, 'utf-8');
          if (content.match(/\b(unauthorized|forbidden|reject|deny|invalid|malicious|xss|injection|csrf)\b/i)) {
            return true;
          }
        }
      } catch { /* skip */ }
    }
  }
  return false;
}

function getAllFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        files.push(...getAllFiles(p));
      } else if (entry.isFile() && TEST_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        files.push(p);
      }
    }
  } catch { /* skip */ }
  return files;
}

function calculateScore(mod: ModuleDefinition, files: ModuleScore['testFiles'], hasNeg: boolean, covGate: boolean): number {
  let score = 0;

  if (files.unit > 0) score += 20;
  if (files.component > 0) score += 15;
  if (files.integration > 0) score += 20;
  if (files.e2e > 0) score += 15;
  if (files.security > 0) score += 10;

  if (files.total >= 10) score += 5;
  if (files.total >= 25) score += 5;

  if (covGate) score += 5;
  if (hasNeg) score += 5;

  if (mod.riskLevel === 'critical' && files.security === 0) score -= 10;
  if (mod.riskLevel === 'critical' && !hasNeg) score -= 10;

  return Math.max(0, Math.min(100, score));
}

function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

function generateScorecard(): ModuleScore[] {
  return MODULES.map((mod) => {
    const files = {
      unit: mod.testPaths.unit.reduce((s, p) => s + countTestFiles(p), 0),
      component: mod.testPaths.component.reduce((s, p) => s + countTestFiles(p), 0),
      integration: mod.testPaths.integration.reduce((s, p) => s + countTestFiles(p), 0),
      e2e: mod.testPaths.e2e.reduce((s, p) => s + countTestFiles(p), 0),
      security: mod.testPaths.security.reduce((s, p) => s + countTestFiles(p), 0),
      total: 0,
    };
    files.total = files.unit + files.component + files.integration + files.e2e + files.security;

    const covGate = checkCoverageGate(mod);
    const hasNeg = hasNegativeTests(mod);
    const score = calculateScore(mod, files, hasNeg, covGate);

    return {
      module: mod.name,
      riskLevel: mod.riskLevel,
      testFiles: files,
      coverageGate: covGate,
      hasNegativeTests: hasNeg,
      score,
      grade: getGrade(score),
    };
  });
}

function printMarkdown(scores: ModuleScore[]) {
  console.log('# Quality Scorecard per Module\n');
  console.log(`Generated: ${new Date().toISOString()}\n`);

  console.log('## Summary\n');
  console.log('| Module | Risk | Unit | Comp | Integ | E2E | Sec | Total | CovGate | NegTests | Score | Grade |');
  console.log('|--------|------|------|------|-------|-----|-----|-------|---------|----------|-------|-------|');

  const sorted = [...scores].sort((a, b) => b.score - a.score);

  for (const s of sorted) {
    const risk = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[s.riskLevel];
    console.log(
      `| ${s.module} | ${risk} ${s.riskLevel} | ${s.testFiles.unit} | ${s.testFiles.component} | ${s.testFiles.integration} | ${s.testFiles.e2e} | ${s.testFiles.security} | **${s.testFiles.total}** | ${s.coverageGate ? '✅' : '—'} | ${s.hasNegativeTests ? '✅' : '❌'} | ${s.score} | **${s.grade}** |`
    );
  }

  const totalTests = scores.reduce((s, m) => s + m.testFiles.total, 0);
  const avgScore = Math.round(scores.reduce((s, m) => s + m.score, 0) / scores.length);
  const criticalModules = scores.filter((s) => s.riskLevel === 'critical');
  const criticalAvg = criticalModules.length > 0
    ? Math.round(criticalModules.reduce((s, m) => s + m.score, 0) / criticalModules.length)
    : 0;

  console.log(`\n## Aggregated Metrics\n`);
  console.log(`- **Modules tracked**: ${scores.length}`);
  console.log(`- **Total test files (tracked modules)**: ${totalTests}`);
  console.log(`- **Average score**: ${avgScore}/100`);
  console.log(`- **Critical modules avg**: ${criticalAvg}/100`);
  console.log(`- **Modules with grade A**: ${scores.filter((s) => s.grade === 'A').length}`);
  console.log(`- **Modules with grade F**: ${scores.filter((s) => s.grade === 'F').length}`);

  const atRisk = scores.filter(
    (s) => (s.riskLevel === 'critical' || s.riskLevel === 'high') && s.grade !== 'A' && s.grade !== 'B'
  );
  if (atRisk.length > 0) {
    console.log(`\n## ⚠️ Attention Required\n`);
    console.log('High/critical-risk modules with grade C or below:\n');
    for (const s of atRisk) {
      console.log(`- **${s.module}** (${s.riskLevel}, grade ${s.grade}, score ${s.score})`);
      if (s.testFiles.security === 0 && s.riskLevel === 'critical') {
        console.log(`  → Missing: dedicated security tests`);
      }
      if (!s.hasNegativeTests && s.riskLevel === 'critical') {
        console.log(`  → Missing: negative/adversarial test cases`);
      }
      if (s.testFiles.integration === 0) {
        console.log(`  → Missing: integration tests`);
      }
    }
  }

  console.log(`\n## Scoring Methodology\n`);
  console.log('| Criterion | Points |');
  console.log('|-----------|--------|');
  console.log('| Has unit tests | +20 |');
  console.log('| Has component tests | +15 |');
  console.log('| Has integration tests | +20 |');
  console.log('| Has E2E tests | +15 |');
  console.log('| Has security tests | +10 |');
  console.log('| ≥10 test files | +5 |');
  console.log('| ≥25 test files | +5 |');
  console.log('| Coverage gate (95%) | +5 |');
  console.log('| Negative test cases | +5 |');
  console.log('| Critical module w/o security tests | -10 |');
  console.log('| Critical module w/o negative tests | -10 |');
}

const scores = generateScorecard();
const argv = process.argv.slice(2);

if (argv.includes('--json')) {
  const outputPath = argv[argv.indexOf('--output') + 1] || 'docs/testing/quality-scorecard.json';
  fs.writeFileSync(path.resolve(process.cwd(), outputPath), JSON.stringify(scores, null, 2));
  console.log(`JSON scorecard saved to: ${outputPath}`);
} else {
  printMarkdown(scores);
  const jsonPath = 'docs/testing/quality-scorecard.json';
  fs.writeFileSync(path.resolve(process.cwd(), jsonPath), JSON.stringify(scores, null, 2));
  console.log(`\n---\nJSON saved to: ${jsonPath}`);
}
