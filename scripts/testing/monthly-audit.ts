#!/usr/bin/env npx tsx
/**
 * Monthly L1–L5 Testing Audit
 *
 * Aggregates quality metrics across all layers and generates a trend-ready report.
 * Designed to be run monthly and results committed to docs/testing/audits/.
 *
 * Usage: npx tsx scripts/testing/monthly-audit.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface AuditReport {
  generatedAt: string;
  period: string;
  layers: LayerAudit[];
  qualityGates: GateAudit[];
  skipAllowlist: SkipAudit;
  scorecard: ScorecardSummary;
  debtItems: DebtItem[];
}

interface LayerAudit {
  layer: string;
  testFiles: number;
  sharding: string;
  timeout: string;
  prBlocking: boolean;
}

interface GateAudit {
  name: string;
  type: string;
  status: 'active' | 'planned';
}

interface SkipAudit {
  totalEntries: number;
  expiredEntries: number;
  entriesWithoutOwner: number;
}

interface ScorecardSummary {
  modulesTracked: number;
  averageScore: number;
  gradeA: number;
  gradeF: number;
  criticalModulesAvg: number;
}

interface DebtItem {
  area: string;
  issue: string;
  priority: 'P0' | 'P1' | 'P2';
  recommendation: string;
}

const TEST_EXTENSIONS = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.test.js'];

function countFiles(dir: string): number {
  const fullDir = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullDir)) return 0;
  let count = 0;
  function walk(d: string) {
    try {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name !== 'node_modules') walk(path.join(d, entry.name));
        else if (entry.isFile() && TEST_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) count++;
      }
    } catch { /* skip */ }
  }
  walk(fullDir);
  return count;
}

function auditSkipAllowlist(): SkipAudit {
  const allowlistPath = path.join(process.cwd(), 'scripts/testing/skip-allowlist.json');
  if (!fs.existsSync(allowlistPath)) return { totalEntries: 0, expiredEntries: 0, entriesWithoutOwner: 0 };

  const data = JSON.parse(fs.readFileSync(allowlistPath, 'utf-8'));
  const entries = data.entries || [];
  const now = new Date();

  return {
    totalEntries: entries.length,
    expiredEntries: entries.filter((e: any) => e.expiresOn && new Date(e.expiresOn) < now).length,
    entriesWithoutOwner: entries.filter((e: any) => !e.owner).length,
  };
}

function loadScorecard(): ScorecardSummary {
  const scorecardPath = path.join(process.cwd(), 'docs/testing/quality-scorecard.json');
  if (!fs.existsSync(scorecardPath)) {
    return { modulesTracked: 0, averageScore: 0, gradeA: 0, gradeF: 0, criticalModulesAvg: 0 };
  }
  const scores = JSON.parse(fs.readFileSync(scorecardPath, 'utf-8'));
  const critical = scores.filter((s: any) => s.riskLevel === 'critical');
  return {
    modulesTracked: scores.length,
    averageScore: Math.round(scores.reduce((s: number, m: any) => s + m.score, 0) / scores.length),
    gradeA: scores.filter((s: any) => s.grade === 'A').length,
    gradeF: scores.filter((s: any) => s.grade === 'F').length,
    criticalModulesAvg: critical.length > 0
      ? Math.round(critical.reduce((s: number, m: any) => s + m.score, 0) / critical.length)
      : 0,
  };
}

function identifyDebt(scorecard: ScorecardSummary, skip: SkipAudit): DebtItem[] {
  const items: DebtItem[] = [];

  if (scorecard.gradeF > 0) {
    items.push({
      area: 'Test coverage',
      issue: `${scorecard.gradeF} module(s) with grade F (no meaningful test coverage)`,
      priority: 'P1',
      recommendation: 'Add at least unit + component tests for each F-graded module',
    });
  }

  if (scorecard.criticalModulesAvg < 80) {
    items.push({
      area: 'Critical modules',
      issue: `Critical modules average score ${scorecard.criticalModulesAvg}/100 (target: ≥80)`,
      priority: 'P0',
      recommendation: 'Prioritize security tests and negative test cases for critical modules',
    });
  }

  if (skip.expiredEntries > 0) {
    items.push({
      area: 'Skip allowlist',
      issue: `${skip.expiredEntries} expired skip entries (TTL exceeded)`,
      priority: 'P0',
      recommendation: 'Fix or remove expired skip entries immediately',
    });
  }

  if (skip.entriesWithoutOwner > 0) {
    items.push({
      area: 'Skip allowlist',
      issue: `${skip.entriesWithoutOwner} entries without assigned owner`,
      priority: 'P1',
      recommendation: 'Assign an owner to every skip-allowlist entry',
    });
  }

  if (skip.totalEntries > 5) {
    items.push({
      area: 'Skip allowlist',
      issue: `${skip.totalEntries} entries (policy max: 5)`,
      priority: 'P1',
      recommendation: 'Reduce skip entries as a sprint goal',
    });
  }

  return items.sort((a, b) => a.priority.localeCompare(b.priority));
}

function generateReport(): AuditReport {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const layers: LayerAudit[] = [
    { layer: 'L1 Unit', testFiles: countFiles('tests/unit'), sharding: '4-way', timeout: '12 min/shard', prBlocking: true },
    { layer: 'L2 Component', testFiles: countFiles('tests/components'), sharding: '8-way (npm)', timeout: '12 min', prBlocking: true },
    { layer: 'L3 Integration', testFiles: countFiles('tests/integration'), sharding: '3-way', timeout: '12 min/shard', prBlocking: true },
    { layer: 'L4 E2E Smoke (Tier-0)', testFiles: countFiles('tests/e2e/smoke'), sharding: 'none', timeout: '15 min', prBlocking: true },
    { layer: 'L4 E2E Full (Tier-1)', testFiles: countFiles('tests/e2e'), sharding: 'none', timeout: '30 min', prBlocking: false },
    { layer: 'L5 Security', testFiles: countFiles('tests/security'), sharding: 'none', timeout: '10 min', prBlocking: false },
    { layer: 'L5 Performance', testFiles: countFiles('tests/performance'), sharding: 'none', timeout: '10 min', prBlocking: false },
  ];

  const gates: GateAudit[] = [
    { name: 'lint + typecheck', type: 'static analysis', status: 'active' },
    { name: 'quality-check (anti-placeholder)', type: 'test quality', status: 'active' },
    { name: 'skip-scan (zero .only())', type: 'test hygiene', status: 'active' },
    { name: 'security-integrity (29 checks)', type: 'security', status: 'active' },
    { name: 'L1–L3 coverage gates (95%)', type: 'coverage', status: 'active' },
    { name: 'critical-path coverage (95%)', type: 'coverage', status: 'active' },
    { name: 'patch coverage (≥80%)', type: 'coverage', status: 'active' },
  ];

  const skip = auditSkipAllowlist();
  const scorecard = loadScorecard();
  const debt = identifyDebt(scorecard, skip);

  return { generatedAt: now.toISOString(), period, layers, qualityGates: gates, skipAllowlist: skip, scorecard, debtItems: debt };
}

function printMarkdown(report: AuditReport): void {
  console.log(`# Monthly Testing Audit — ${report.period}\n`);
  console.log(`Generated: ${report.generatedAt}\n`);

  console.log('## Test Layer Summary\n');
  console.log('| Layer | Files | Sharding | Timeout | PR Gate? |');
  console.log('|-------|-------|----------|---------|----------|');
  const totalFiles = report.layers.reduce((s, l) => s + l.testFiles, 0);
  for (const l of report.layers) {
    console.log(`| ${l.layer} | ${l.testFiles} | ${l.sharding} | ${l.timeout} | ${l.prBlocking ? '✅' : '🌙'} |`);
  }
  console.log(`| **Total** | **${totalFiles}** | | | |`);

  console.log('\n## Quality Gates (7 active)\n');
  for (const g of report.qualityGates) {
    console.log(`- ✅ ${g.name} (${g.type})`);
  }

  console.log('\n## Skip Allowlist Health\n');
  console.log(`| Metric | Value | Threshold |`);
  console.log(`|--------|-------|-----------|`);
  console.log(`| Total entries | ${report.skipAllowlist.totalEntries} | ≤ 5 |`);
  console.log(`| Expired entries | ${report.skipAllowlist.expiredEntries} | 0 |`);
  console.log(`| Without owner | ${report.skipAllowlist.entriesWithoutOwner} | 0 |`);

  console.log('\n## Module Quality Scorecard\n');
  console.log(`| Metric | Value |`);
  console.log(`|--------|-------|`);
  console.log(`| Modules tracked | ${report.scorecard.modulesTracked} |`);
  console.log(`| Average score | ${report.scorecard.averageScore}/100 |`);
  console.log(`| Grade A modules | ${report.scorecard.gradeA} |`);
  console.log(`| Grade F modules | ${report.scorecard.gradeF} |`);
  console.log(`| Critical modules avg | ${report.scorecard.criticalModulesAvg}/100 |`);

  if (report.debtItems.length > 0) {
    console.log('\n## 🔴 Test Debt — Top Items\n');
    console.log('| Priority | Area | Issue | Recommendation |');
    console.log('|----------|------|-------|----------------|');
    for (const d of report.debtItems.slice(0, 5)) {
      console.log(`| ${d.priority} | ${d.area} | ${d.issue} | ${d.recommendation} |`);
    }
  } else {
    console.log('\n## ✅ No Critical Test Debt Identified\n');
  }

  console.log('\n## Maturity Level\n');
  console.log('- Level 1 (Basic Testing): ✅');
  console.log('- Level 2 (Structured Coverage): ✅');
  console.log('- Level 3 (Quality Enforcement): ✅');
  console.log('- Level 4 (Automated Governance): ✅');
  console.log('- Level 5 (Continuous Improvement): 🔲 advancing');
}

const report = generateReport();

const auditsDir = path.join(process.cwd(), 'docs/testing/audits');
if (!fs.existsSync(auditsDir)) fs.mkdirSync(auditsDir, { recursive: true });

const jsonPath = path.join(auditsDir, `audit-${report.period}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

printMarkdown(report);
console.log(`\n---\nJSON saved to: docs/testing/audits/audit-${report.period}.json`);
