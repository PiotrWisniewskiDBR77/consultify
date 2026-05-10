#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

interface GateError {
  scope: string;
  message: string;
}

interface GateWarning {
  scope: string;
  message: string;
}

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

const REQUIRED_MODULE_FILES = [
  'README.md',
  'SSOT.md',
  'CODEMAP.md',
  'STATUS.md',
  '00_META.md',
  '01_PURPOSE.md',
  '02_SCOPE.md',
  '03_BEHAVIOR.md',
  '04_UI_UX.md',
  '05_DATA_AND_INTEGRATIONS.md',
  '06_PERMISSIONS_AND_SECURITY.md',
  '07_ACCEPTANCE_AND_TESTS.md',
  'RAW_INPUT.md',
  'CHANGELOG.md',
];

const FUNCTION_SECTION_PATTERNS = [
  /##\s*1[\.\)]\s*Function Identity/i,
  /##\s*2[\.\)]\s*User Job and Business Outcome/i,
  /##\s*3[\.\)]\s*Trigger and Entry Points/i,
  /##\s*4[\.\)]\s*UI Component Footprint/i,
  /##\s*5[\.\)]\s*Inputs,\s*Data Contracts,\s*and Dependencies/i,
  /##\s*6[\.\)]\s*Outputs and Side Effects/i,
  /##\s*7[\.\)]\s*Ownership and Handoff Boundaries/i,
  /##\s*8[\.\)]\s*Runtime States and UX Behavior/i,
  /##\s*9[\.\)]\s*AI,\s*Source,\s*Evidence,\s*Approval/i,
  /##\s*10[\.\)]\s*Security,\s*Roles,\s*and Tenancy/i,
  /##\s*11[\.\)]\s*Acceptance Criteria and Test Evidence/i,
  /##\s*12[\.\)]\s*Open Risks and Change Log/i,
];

function listFunctionFiles(modulePath: string): string[] {
  const fnDir = path.join(modulePath, 'functions');
  if (!fs.existsSync(fnDir)) return [];
  return fs
    .readdirSync(fnDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(fnDir, f));
}

function assertFileExists(baseDir: string, relPath: string, errors: GateError[], scope: string): void {
  if (!fs.existsSync(path.join(baseDir, relPath))) {
    errors.push({ scope, message: `missing required file: ${relPath}` });
  }
}

function validateFunctionContract(
  filePath: string,
  errors: GateError[],
  warnings: GateWarning[]
): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const rel = path.relative(process.cwd(), filePath);

  for (const pattern of FUNCTION_SECTION_PATTERNS) {
    if (!pattern.test(content)) {
      errors.push({ scope: rel, message: `missing required section pattern: ${pattern}` });
    }
  }

  const hasRoute = /route evidence|route\/|routeConfig\.ts|AppRoutes\.tsx/i.test(content);
  const hasComponent = /component evidence|src\/components|src\/views/i.test(content);
  const hasApi = /api evidence|server\/src\/routes|\/api\//i.test(content);
  const hasTest = /test evidence|tests\/|e2e\//i.test(content);

  if (!hasRoute || !hasComponent || !hasApi || !hasTest) {
    warnings.push({
      scope: rel,
      message: 'missing evidence linkage (need route + component + API + test references)',
    });
  }
}

function ensureGovernanceDocs(errors: GateError[]): void {
  const mustExist = [
    'docs/modules/HIERARCHY_OF_TRUTH.md',
    'docs/modules/CONTRACT_OWNERSHIP_REGISTRY.md',
    'docs/modules/FUNCTION_CONTRACT_STANDARD.md',
    'docs/modules/FUNCTION_CONTRACT_TEMPLATE.md',
    'docs/modules/MODULE_INTERACTION_GRAPH.md',
    'docs/modules/CONTROL_PLANE_CONTRACT.md',
    'docs/modules/END_TO_END_WORKFLOWS.md',
    'docs/modules/CROSS_MODULE_PERMISSION_MATRIX.md',
    'docs/modules/APPROVED_COMPONENT_COMPOSITION.md',
    'docs/modules/ARTIFACT_LINEAGE_MATRIX.md',
    'docs/modules/UI_UX_COMPONENTS_AND_ARTIFACTS_UNIFIED_STANDARD.md',
    'docs/modules/SYSTEM_TRACEABILITY_MATRIX.md',
    'docs/modules/EVIDENCE_REGISTRY.md',
    'docs/modules/DECISION_LOG.md',
    'docs/modules/CHANGE_TYPE_DOR_DOD.md',
    'docs/modules/RELEASE_READINESS_CONTRACT.md',
  ];

  for (const rel of mustExist) {
    if (!fs.existsSync(path.join(process.cwd(), rel))) {
      errors.push({ scope: 'governance', message: `missing required governance doc: ${rel}` });
    }
  }
}

function renderMarkdown(
  errors: GateError[],
  warnings: GateWarning[],
  checkedFunctions: number
): string {
  const lines: string[] = [];
  lines.push('# Module Contract Rerun Gate');
  lines.push('');
  lines.push(`Generated: \`${new Date().toISOString()}\``);
  lines.push(`Checked modules: **${MODULE_IDS.length}**`);
  lines.push(`Checked function contracts: **${checkedFunctions}**`);
  lines.push('');

  if (errors.length === 0) {
    lines.push('## Result');
    lines.push('');
    lines.push(warnings.length === 0 ? '**PASS**' : '**PASS_WITH_WARNINGS**');
    if (warnings.length > 0) {
      lines.push('');
      lines.push(`Warnings: **${warnings.length}** (evidence debt to close in P2 plan).`);
      lines.push('');
      lines.push('## Warnings');
      lines.push('');
      for (const warn of warnings) {
        lines.push(`- \`${warn.scope}\`: ${warn.message}`);
      }
    }
    return lines.join('\n');
  }

  lines.push('## Result');
  lines.push('');
  lines.push('**FAIL**');
  lines.push('');
  lines.push('## Errors');
  lines.push('');
  for (const err of errors) {
    lines.push(`- \`${err.scope}\`: ${err.message}`);
  }
  return lines.join('\n');
}

function main(): void {
  const root = process.cwd();
  const modulesRoot = path.join(root, 'docs/modules');
  const errors: GateError[] = [];
  const warnings: GateWarning[] = [];
  let checkedFunctions = 0;

  ensureGovernanceDocs(errors);

  for (const moduleId of MODULE_IDS) {
    const modulePath = path.join(modulesRoot, moduleId);
    if (!fs.existsSync(modulePath)) {
      errors.push({ scope: moduleId, message: 'missing module directory' });
      continue;
    }

    for (const rel of REQUIRED_MODULE_FILES) {
      assertFileExists(modulePath, rel, errors, moduleId);
    }

    const uiUxPath = path.join(modulePath, '04_UI_UX.md');
    if (fs.existsSync(uiUxPath)) {
      const uiUx = fs.readFileSync(uiUxPath, 'utf-8');
      if (!/##\s*11\.\s*Function Annex/i.test(uiUx)) {
        errors.push({ scope: `${moduleId}/04_UI_UX.md`, message: 'missing Function Annex section' });
      }
    }

    const accPath = path.join(modulePath, '07_ACCEPTANCE_AND_TESTS.md');
    if (fs.existsSync(accPath)) {
      const acc = fs.readFileSync(accPath, 'utf-8');
      if (!/Function-Level Acceptance Matrix/i.test(acc)) {
        errors.push({
          scope: `${moduleId}/07_ACCEPTANCE_AND_TESTS.md`,
          message: 'missing Function-Level Acceptance Matrix',
        });
      }
    }

    const fnFiles = listFunctionFiles(modulePath);
    if (fnFiles.length === 0) {
      errors.push({ scope: moduleId, message: 'missing function contracts in functions/' });
      continue;
    }

    for (const fn of fnFiles) {
      validateFunctionContract(fn, errors, warnings);
      checkedFunctions++;
    }
  }

  const outDir = path.join(root, 'test-results', 'module-contract-gate');
  fs.mkdirSync(outDir, { recursive: true });

  const jsonReport = {
    generatedAt: new Date().toISOString(),
    checkedModules: MODULE_IDS.length,
    checkedFunctions,
    errorCount: errors.length,
    warningCount: warnings.length,
    errors,
    warnings,
    result: errors.length === 0 ? (warnings.length === 0 ? 'PASS' : 'PASS_WITH_WARNINGS') : 'FAIL',
  };

  fs.writeFileSync(path.join(outDir, 'module-contract-gate.json'), JSON.stringify(jsonReport, null, 2));
  fs.writeFileSync(
    path.join(outDir, 'module-contract-gate.md'),
    renderMarkdown(errors, warnings, checkedFunctions)
  );

  console.log(`Checked modules: ${MODULE_IDS.length}`);
  console.log(`Checked function contracts: ${checkedFunctions}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log('Report: test-results/module-contract-gate/module-contract-gate.md');

  if (errors.length > 0) {
    process.exit(1);
  }
}

main();
