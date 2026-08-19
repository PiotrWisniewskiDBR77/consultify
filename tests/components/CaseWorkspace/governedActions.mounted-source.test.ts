import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('EXE-MVP-ACTIONS mounted UI source contract', () => {
  it('mounts all nine implemented governed actions on production components', () => {
    const cases = read('src/components/CaseWorkspace/CasesListScreen.tsx');
    const detail = read('src/components/CaseWorkspace/CaseDetailScreen.tsx');
    const execution = read('src/components/CaseWorkspace/RealizacjaView.tsx');
    const results = read('src/components/CaseWorkspace/RezultatyView.tsx');
    const budget = read('src/components/Execution/BudgetControlPanel.tsx');
    const initiativeResources = read('src/components/Initiatives/sections/ResourcesSection.tsx');

    expect(cases).toContain('cancelCase(');
    expect(detail).toContain('closeCase(');
    expect(execution).toContain('cancelWait(');
    expect(execution).toContain('cancelRun(');
    expect(results).toContain('unlinkArtifactFromCase(');
    expect(execution).toContain("kind: 'proposal-decision'");
    expect(execution).toContain("kind: 'proposal-execute'");
    expect(execution).toContain("kind: 'proposal-revoke'");
    expect(budget).toContain("method: 'DELETE'");
    expect(budget).toContain('canonical readback');
    expect(initiativeResources).toContain('<BudgetControlPanel');
    expect(initiativeResources).toContain('initiativeId={String(initiativeId)}');
  });

  it('does not surface the four HIDDEN registry actions in these mounted controls', () => {
    const mounted = [
      'src/components/CaseWorkspace/CasesListScreen.tsx',
      'src/components/CaseWorkspace/CaseDetailScreen.tsx',
      'src/components/CaseWorkspace/RealizacjaView.tsx',
      'src/components/CaseWorkspace/RezultatyView.tsx',
      'src/components/Execution/BudgetControlPanel.tsx',
    ]
      .map(read)
      .join('\n');
    for (const hidden of [
      'execution.initiative.archive',
      'execution.initiative.delete',
      'execution.report.edit',
      'execution.report.archive',
    ]) {
      expect(mounted).not.toContain(hidden);
    }
  });
});
