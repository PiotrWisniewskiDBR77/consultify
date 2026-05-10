#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

type ContractCategory = 'CODEMAP' | 'BEHAVIOR' | 'UI_UX' | 'ACCEPTANCE' | 'STATUS' | 'FUNCTION';

const MODULE_IDS = [
  '01_czat',
  '02_moja-praca',
  '03_wywiad',
  '04_narzedzia',
  '05_inicjatywy',
  '06_realizacja',
  '07_rezultaty',
  '08_finanse',
  '09_outputs',
  '10_dokumenty',
  '11_tabele',
  '12_prezentacje',
  '13_meeting',
  '14_mcp-iris',
  '15_mcp-marketplace',
  '16_organizacja',
  '17_panel-administratora',
  '18_ustawienia',
  '19_portal-partnerski',
] as const;

const MODULE_KEYWORDS: Record<string, string[]> = {
  '01_czat': ['chat', 'conversation', 'canvas', 'teresa'],
  '02_moja-praca': ['my-work', 'mywork', 'idea', 'radar', 'notebook'],
  '03_wywiad': ['interview', 'assessment', 'discovery'],
  '04_narzedzia': ['tool', 'framework', 'methodology'],
  '05_inicjatywy': ['initiative', 'portfolio', 'roadmap'],
  '06_realizacja': ['implementation', 'execution', 'rollout'],
  '07_rezultaty': ['result', 'kpi', 'roi'],
  '08_finanse': ['finance', 'economics', 'statement', 'valuation'],
  '09_outputs': ['output', 'report', 'deck', 'artifact', 'library'],
  '10_dokumenty': ['document', 'wordy', 'word'],
  '11_tabele': ['table', 'excel', 'sheet'],
  '12_prezentacje': ['presentation', 'slide', 'ppt'],
  '13_meeting': ['meeting', 'calendar'],
  '14_mcp-iris': ['mcp', 'iris'],
  '15_mcp-marketplace': ['marketplace', 'connector'],
  '16_organizacja': ['organization', 'context', 'org'],
  '17_panel-administratora': ['admin', 'superadmin', 'administrator'],
  '18_ustawienia': ['setting', 'preference'],
  '19_portal-partnerski': ['partner', 'portal'],
};

const REQUIRED_CATEGORIES: ContractCategory[] = [
  'CODEMAP',
  'BEHAVIOR',
  'UI_UX',
  'ACCEPTANCE',
  'STATUS',
  'FUNCTION',
];

function parseArgs(): { base: string } {
  const args = process.argv.slice(2);
  const baseIdx = args.indexOf('--base');
  if (baseIdx >= 0 && args[baseIdx + 1]) {
    return { base: args[baseIdx + 1] };
  }
  return { base: 'origin/main' };
}

function validateOwnerAcceptance(prBody: string): string[] {
  const errors: string[] = [];
  const body = prBody || '';

  const hasBusinessYes = /business_owner_acceptance\s*:\s*yes/i.test(body);
  const hasTechYes = /tech_owner_acceptance\s*:\s*yes/i.test(body);
  const hasModules = /impacted_modules\s*:\s*(.+)/i.test(body);
  const hasFunctions = /impacted_functions\s*:\s*(.+)/i.test(body);

  if (!hasBusinessYes) {
    errors.push('PR body missing `business_owner_acceptance: yes` for runtime-impacting changes.');
  }
  if (!hasTechYes) {
    errors.push('PR body missing `tech_owner_acceptance: yes` for runtime-impacting changes.');
  }
  if (!hasModules) {
    errors.push('PR body missing `impacted_modules:` declaration.');
  }
  if (!hasFunctions) {
    errors.push('PR body missing `impacted_functions:` declaration.');
  }

  return errors;
}

function getChangedFiles(base: string): string[] {
  const cmd = `git diff --name-only --diff-filter=ACMR ${base}...HEAD`;
  const out = execSync(cmd, { encoding: 'utf-8' }).trim();
  if (!out) return [];
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isRuntimeFile(file: string): boolean {
  if (
    file.startsWith('docs/') ||
    file.startsWith('.github/') ||
    file.startsWith('scripts/') ||
    file.startsWith('tests/') ||
    file.startsWith('e2e/')
  ) {
    return false;
  }

  const inRuntimeTree =
    file.startsWith('src/') || file.startsWith('server/src/') || file.startsWith('packages/');
  if (!inRuntimeTree) return false;

  return /\.(ts|tsx|js|jsx|mjs|cjs|json|css|scss)$/.test(file);
}

function getModuleContractCategory(file: string): { moduleId: string; category: ContractCategory } | null {
  const m = file.match(/^docs\/modules\/([0-9]{2}_[^/]+)\/(.+)$/);
  if (!m) return null;
  const moduleId = m[1];
  const rel = m[2];

  if (rel === 'CODEMAP.md') return { moduleId, category: 'CODEMAP' };
  if (rel === '03_BEHAVIOR.md') return { moduleId, category: 'BEHAVIOR' };
  if (rel === '04_UI_UX.md') return { moduleId, category: 'UI_UX' };
  if (rel === '07_ACCEPTANCE_AND_TESTS.md') return { moduleId, category: 'ACCEPTANCE' };
  if (rel === 'STATUS.md') return { moduleId, category: 'STATUS' };
  if (/^functions\/[^/]+\.md$/.test(rel)) return { moduleId, category: 'FUNCTION' };

  return null;
}

function inferImpactedModules(runtimeFiles: string[]): Set<string> {
  const impacted = new Set<string>();
  for (const file of runtimeFiles) {
    const lower = file.toLowerCase();
    for (const moduleId of MODULE_IDS) {
      const keywords = MODULE_KEYWORDS[moduleId] || [];
      if (keywords.some((k) => lower.includes(k))) {
        impacted.add(moduleId);
      }
    }
  }
  return impacted;
}

function readFileSafe(filePath: string): string {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) return '';
  return fs.readFileSync(abs, 'utf-8');
}

function validateEvidenceTags(changedFiles: string[]): string[] {
  const errors: string[] = [];
  const changedFunctionContracts = changedFiles.filter((f) =>
    /^docs\/modules\/[0-9]{2}_[^/]+\/functions\/[^/]+\.md$/.test(f)
  );

  for (const file of changedFunctionContracts) {
    const content = readFileSafe(file);
    const hasRoute = /route evidence|route:|`\/[^`]+`/i.test(content);
    const hasComponent = /component evidence|component:/i.test(content);
    const hasApi = /api evidence|api\/|server\/src\/routes/i.test(content);
    const hasTest = /test evidence|tests\/|e2e\//i.test(content);

    if (!hasRoute || !hasComponent || !hasApi || !hasTest) {
      errors.push(
        `${file}: missing required evidence links (need route + component + API + test evidence).`
      );
    }
  }

  return errors;
}

function validateOwnershipRegistry(): string[] {
  const errors: string[] = [];
  const registryPath = path.resolve(
    process.cwd(),
    'docs/modules/CONTRACT_OWNERSHIP_REGISTRY.md'
  );
  if (!fs.existsSync(registryPath)) {
    errors.push('Missing docs/modules/CONTRACT_OWNERSHIP_REGISTRY.md');
    return errors;
  }

  const content = fs.readFileSync(registryPath, 'utf-8');
  for (const moduleId of MODULE_IDS) {
    if (!content.includes(`| \`${moduleId}\` |`)) {
      errors.push(`Ownership registry missing module row: ${moduleId}`);
    }
  }
  return errors;
}

function main(): void {
  const { base } = parseArgs();
  const changedFiles = getChangedFiles(base);
  const runtimeFiles = changedFiles.filter(isRuntimeFile);

  console.log('Module Contract PR Gate');
  console.log(`Base: ${base}`);
  console.log(`Changed files: ${changedFiles.length}`);
  console.log(`Runtime files: ${runtimeFiles.length}`);

  const ownershipErrors = validateOwnershipRegistry();
  if (ownershipErrors.length > 0) {
    console.error('\n❌ Ownership registry errors:');
    for (const err of ownershipErrors) console.error(`- ${err}`);
    process.exit(1);
  }

  if (runtimeFiles.length === 0) {
    console.log('✅ No runtime changes detected; contract-runtime sync gate not required.');
    process.exit(0);
  }

  const byModule = new Map<string, Set<ContractCategory>>();
  for (const file of changedFiles) {
    const parsed = getModuleContractCategory(file);
    if (!parsed) continue;
    if (!byModule.has(parsed.moduleId)) byModule.set(parsed.moduleId, new Set<ContractCategory>());
    byModule.get(parsed.moduleId)?.add(parsed.category);
  }

  const impacted = inferImpactedModules(runtimeFiles);
  const moduleContractTouches = Array.from(byModule.keys());

  const errors: string[] = [];
  if (moduleContractTouches.length === 0) {
    errors.push(
      'Runtime changed but no module contract files were updated. Required: CODEMAP, 03_BEHAVIOR, 04_UI_UX, 07_ACCEPTANCE_AND_TESTS, STATUS, functions/*.md'
    );
  }

  if (impacted.size > 0) {
    for (const moduleId of impacted) {
      const touched = byModule.get(moduleId);
      if (!touched) {
        errors.push(
          `Runtime likely impacts ${moduleId}, but no matching module contract updates found under docs/modules/${moduleId}/`
        );
        continue;
      }

      const missing = REQUIRED_CATEGORIES.filter((cat) => !touched.has(cat));
      if (missing.length > 0) {
        errors.push(
          `Module ${moduleId} missing contract updates for categories: ${missing.join(', ')}`
        );
      }
    }
  } else if (moduleContractTouches.length === 0) {
    errors.push('Unable to infer impacted module; update at least one module contract pack.');
  }

  const evidenceErrors = validateEvidenceTags(changedFiles);
  errors.push(...evidenceErrors);

  const ownerAcceptanceErrors = validateOwnerAcceptance(process.env.PR_BODY || '');
  errors.push(...ownerAcceptanceErrors);

  if (errors.length > 0) {
    console.error('\n❌ Module contract PR gate failed:');
    for (const err of errors) console.error(`- ${err}`);
    process.exit(1);
  }

  console.log('✅ Module contract PR gate passed.');
}

main();
