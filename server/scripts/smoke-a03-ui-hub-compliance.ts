#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type Check = { name: string; pass: boolean };

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function includesAll(content: string, needles: string[]): boolean {
  return needles.every((needle) => content.includes(needle));
}

function containsCanonicalSubsetOrder(content: string, tokens: string[]): boolean {
  let cursor = -1;
  for (const token of tokens) {
    const next = content.indexOf(token, cursor + 1);
    if (next < 0) return false;
    cursor = next;
  }
  return true;
}

function main(): void {
  const root = process.cwd();
  const checks: Check[] = [];

  const discoveryHub = read(path.join(root, 'src/components/Discovery/DiscoveryToolsHub.tsx'));
  const initiativesHub = read(path.join(root, 'src/components/Initiatives/InitiativesHub.tsx'));
  const reportsHub = read(path.join(root, 'src/components/Reports/Management/ReportsHub.tsx'));
  const reportsEntryRouter = read(path.join(root, 'src/components/Reports/ReportsEntryRouter.tsx'));
  const presentationsHub = read(path.join(root, 'src/components/Presentations/PresentationsHub.tsx'));
  const executionHub = read(path.join(root, 'src/components/Execution/ExecutionHub.tsx'));
  const interviewHub = read(path.join(root, 'src/components/Interview/InterviewHub.tsx'));
  const myWorkHub = read(path.join(root, 'src/components/MyWork/MyWorkHub.tsx'));
  const moduleNavBar = read(path.join(root, 'src/components/shared/ModuleHub/ModuleNavBar.tsx'));

  checks.push({
    name: 'A03 module nav bar enforces canonical view-mode order',
    pass: includesAll(moduleNavBar, [
      "const VIEW_MODE_ORDER: ViewMode[] = ['table', 'kanban', 'timeline', 'calendar', 'matrix', 'grid']",
      'const orderedViewModes = VIEW_MODE_ORDER.filter((m) => availableViewModes.includes(m));',
    ]),
  });

  checks.push({
    name: 'A03 Discovery hub uses shared ModuleHub pattern',
    pass: discoveryHub.includes('<ModuleHub'),
  });

  checks.push({
    name: 'A03 Initiatives hub uses canonical subset order (table→kanban→timeline→grid)',
    pass: includesAll(initiativesHub, [
      "const availableViewModes: ViewMode[] =",
      "['table', 'kanban', 'timeline', 'grid']",
    ]),
  });

  // A03 Results: the hub this check read (src/components/Results/ResultsHub.tsx)
  // was deleted together with its whole subtree — unreachable from any route
  // since 8df1cd413d (2026-08-24). The canonical Results surface is
  // src/components/ResultsVNext/ResultsKpiRegistryPage.tsx, reached through the
  // `/results` redirect in ResultsOwnerReviewEntry.tsx; its route binding is
  // guarded by scripts/dev/__tests__/verifyCanonical16Bindings.test.mjs.

  checks.push({
    name: 'A03 Reports hub uses ModuleHub + app-table table mode',
    pass: includesAll(reportsHub, ['<ModuleHub', "availableViewModes={['table']}"]),
  });

  checks.push({
    name: 'A03 Reports entry router kept as dedicated entry screen',
    pass: includesAll(reportsEntryRouter, ['export const ReportsEntryRouter', 'handleBuilder', 'handleManagement']),
  });

  checks.push({
    name: 'A03 Presentations hub uses ModuleHub + canonical subset order (table→grid)',
    pass: includesAll(presentationsHub, ['<ModuleHub', "availableViewModes={['table', 'grid']}"]),
  });

  checks.push({
    name: 'A03 Execution hub view mode subset resolves in canonical order',
    pass: containsCanonicalSubsetOrder(executionHub, [
      "'table'",
      "'kanban'",
      "'timeline'",
      "'calendar'",
      "'grid'",
    ]),
  });

  checks.push({
    name: 'A03 Interview hub keeps explicit single command row contract',
    pass: interviewHub.includes('Command Row: context counters'),
  });

  checks.push({
    name: 'A03 MyWork sub-hubs keep canonical subset toggles',
    pass:
      // Allow both legacy explicit toggles (setX('table')) and the newer map-based toggles
      // (setX(id)) as long as the canonical subsets exist.
      includesAll(myWorkHub, [
        "type TasksViewMode = 'table' | 'kanban' | 'calendar'",
        "type DecisionsViewMode = 'table' | 'kanban' | 'timeline'",
        "id: 'table' as TasksViewMode",
        "id: 'kanban' as TasksViewMode",
        "id: 'calendar' as TasksViewMode",
        "id: 'table' as DecisionsViewMode",
        "id: 'kanban' as DecisionsViewMode",
        "id: 'timeline' as DecisionsViewMode",
      ]) &&
      includesAll(myWorkHub, ['setTasksViewMode(', 'setDecisionsViewMode(']),
  });

  const failed = checks.filter((check) => !check.pass);

  console.log('\n[smoke-a03-ui-hub-compliance] Summary:');
  for (const check of checks) {
    console.log(` - ${check.pass ? 'OK' : 'FAIL'} ${check.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Compliance failed: ${failed.map((item) => item.name).join(', ')}`);
  }

  console.log('\n[smoke-a03-ui-hub-compliance] Compliance checks passed.');
}

try {
  main();
} catch (error) {
  console.error('[smoke-a03-ui-hub-compliance] Failed:', (error as Error)?.message || error);
  process.exit(1);
}

