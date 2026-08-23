/** @vitest-environment node */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8');

describe('Execution mounted initiative truth spine', () => {
  it('mounts the initiative register as the primary Execution list', () => {
    const hub = read('src/components/Execution/ExecutionHub.tsx');
    const renderStart = hub.indexOf('const renderContent = () =>');
    const mountedList = hub.indexOf("if (activeTab === 'list')", renderStart);
    const initiativeTable = hub.indexOf('<StandardTable', mountedList);
    const executionCaseSurface = hub.indexOf('<ExecutionRealizationsSurface', mountedList);

    expect(renderStart).toBeGreaterThan(-1);
    expect(mountedList).toBeGreaterThan(renderStart);
    expect(initiativeTable).toBeGreaterThan(mountedList);
    expect(executionCaseSurface).toBe(-1);
  });

  it('uses the same initiative identities and full initiative document in Execution', () => {
    const hub = read('src/components/Execution/ExecutionHub.tsx');

    expect(hub).toContain('summaryInitiatives');
    expect(hub).toContain('<ExecutionInitiativeDocumentView');
  });

  it('does not mount the rejected Execution Case register in the primary list', () => {
    const hub = read('src/components/Execution/ExecutionHub.tsx');

    expect(hub).not.toContain("import { ExecutionRealizationsSurface }");
    expect(hub).not.toContain('<ExecutionRealizationsSurface');
  });

  it('mounts and resolves the canonical execution-case deep link', () => {
    const routes = read('src/routes/AppRoutes.tsx');
    const surface = read('src/components/Execution/ExecutionRealizationsSurface.tsx');

    expect(routes).toContain('path={`${ROUTES.EXECUTION}/:executionCaseId`}');
    expect(surface).toContain('useParams<{');
    expect(surface).toContain('setSelectedExecutionCaseId(deepLinkedExecutionCaseId)');
    expect(surface).toContain('setShowWorkbench(true)');
  });
});
