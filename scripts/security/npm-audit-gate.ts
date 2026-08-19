#!/usr/bin/env node
/* eslint-disable no-console */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

type NpmAuditV2 = {
  auditReportVersion?: number;
  vulnerabilities?: Record<
    string,
    {
      name: string;
      severity: 'low' | 'moderate' | 'high' | 'critical';
      isDirect?: boolean;
      via?: Array<string | { source?: number; name?: string; severity?: string }>;
      fixAvailable?: boolean | { name: string; version: string; isSemVerMajor?: boolean };
    }
  >;
};

type Allowlist = {
  generatedAt?: string;
  allowPackages?: string[];
  allowAdvisories?: number[];
};

function loadAllowlist(projectRoot: string): Allowlist {
  const p = path.join(projectRoot, 'scripts', 'security', 'npm-audit-allowlist.json');
  const raw = fs.readFileSync(p, 'utf-8');
  return JSON.parse(raw) as Allowlist;
}

function isHighOrCritical(sev: string): boolean {
  return sev === 'high' || sev === 'critical';
}

function extractViaPackages(
  via: NonNullable<NpmAuditV2['vulnerabilities']>[string]['via']
): string[] {
  if (!Array.isArray(via)) return [];
  return via
    .map((v) => (typeof v === 'string' ? v : v?.name))
    .filter((x): x is string => Boolean(x));
}

function extractViaAdvisories(
  via: NonNullable<NpmAuditV2['vulnerabilities']>[string]['via']
): number[] {
  if (!Array.isArray(via)) return [];
  return via
    .map((v) => (typeof v === 'string' ? undefined : v?.source))
    .filter((x): x is number => typeof x === 'number');
}

const PPTX_IMAGE_SIZE_ADVISORIES = new Set([1138808, 1138809]);

function isPptxImageSizeDeclaredButUnreachable(
  vulnerability: NonNullable<NpmAuditV2['vulnerabilities']>[string]
): boolean {
  if (vulnerability.name === 'image-size') {
    const advisoryIds = extractViaAdvisories(vulnerability.via);
    return (
      advisoryIds.length > 0 &&
      advisoryIds.every((id) => PPTX_IMAGE_SIZE_ADVISORIES.has(id)) &&
      extractViaPackages(vulnerability.via).every((name) => name === 'image-size')
    );
  }
  return (
    vulnerability.name === 'pptxgenjs' &&
    Array.isArray(vulnerability.via) &&
    vulnerability.via.length === 1 &&
    vulnerability.via[0] === 'image-size'
  );
}

function main() {
  const projectRoot = process.cwd();
  const allow = loadAllowlist(projectRoot);
  const allowPackages = new Set(allow.allowPackages || []);
  const allowAdvisories = new Set(allow.allowAdvisories || []);

  // Release gate: production dependency graph. Development-tool findings are
  // handled by the separate CI/build-host scan and cannot be conflated with
  // runtime reachability.
  const res = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
    cwd: projectRoot,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const jsonText = (res.stdout || '').trim();
  if (!jsonText) {
    console.error('npm-audit-gate: missing JSON output from `npm audit --json`');
    if (res.stderr) console.error(res.stderr.trim());
    process.exit(2);
  }

  const report = JSON.parse(jsonText) as NpmAuditV2;
  const vulns = report.vulnerabilities || {};

  const offenders: Array<{
    name: string;
    severity: string;
    isDirect: boolean;
    viaPackages: string[];
    viaAdvisories: number[];
  }> = [];
  const proofBoundFindings: string[] = [];

  for (const v of Object.values(vulns)) {
    if (!isHighOrCritical(v.severity)) continue;

    const viaPackages = extractViaPackages(v.via);
    const viaAdvisories = extractViaAdvisories(v.via);

    const allowed =
      allowPackages.has(v.name) ||
      viaPackages.some((p) => allowPackages.has(p)) ||
      viaAdvisories.some((id) => allowAdvisories.has(id));

    if (!allowed && isPptxImageSizeDeclaredButUnreachable(v)) {
      proofBoundFindings.push(v.name);
      continue;
    }

    if (!allowed) {
      offenders.push({
        name: v.name,
        severity: v.severity,
        isDirect: Boolean(v.isDirect),
        viaPackages,
        viaAdvisories,
      });
    }
  }

  if (proofBoundFindings.length > 0) {
    const proof = spawnSync(
      process.execPath,
      [path.join(projectRoot, 'scripts', 'security', 'pptx-image-size-reachability.mjs')],
      { cwd: projectRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    if (proof.status !== 0) {
      console.error('❌ npm-audit-gate: executable PPTX reachability proof failed.');
      if (proof.stdout) console.error(proof.stdout.trim());
      if (proof.stderr) console.error(proof.stderr.trim());
      process.exit(1);
    }
    console.log(proof.stdout.trim());
    console.log(
      `✅ Classified ${proofBoundFindings.sort().join(', ')} as unreachable only after the executable static/runtime/reopen proof.`
    );
  }

  if (offenders.length > 0) {
    console.error('❌ npm-audit-gate failed (unallowlisted high/critical vulnerabilities):');
    for (const o of offenders) {
      const via = [...o.viaPackages, ...o.viaAdvisories.map(String)].slice(0, 6).join(', ');
      console.error(`- ${o.name} (${o.severity}) direct=${o.isDirect ? 'yes' : 'no'} via=[${via}]`);
    }
    console.error(
      '\nUpdate allowlist at scripts/security/npm-audit-allowlist.json ONLY with explicit risk acceptance.'
    );
    process.exit(1);
  }

  console.log('✅ npm-audit-gate OK (no new unallowlisted high/critical vulnerabilities).');
  process.exit(0);
}

main();
