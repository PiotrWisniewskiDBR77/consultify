/** @vitest-environment node */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8');

describe('Execution mounted initiative truth spine', () => {
  it('mounts Realizacje from the runtime-v1 surface with no later legacy portfolio branch', () => {
    const hub = read('src/components/Execution/ExecutionHub.tsx');
    const renderStart = hub.indexOf('const renderContent = () =>');
    const mountedList = hub.indexOf("if (activeTab === 'list')", renderStart);
    const runtimeSurface = hub.indexOf('<ExecutionRealizationsSurface', mountedList);
    const legacyPortfolioBranch = hub.indexOf("if (activeTab === 'list')", mountedList + 1);

    expect(renderStart).toBeGreaterThan(-1);
    expect(mountedList).toBeGreaterThan(renderStart);
    expect(runtimeSurface).toBeGreaterThan(mountedList);
    expect(legacyPortfolioBranch).toBe(-1);
  });

  it('hydrates the mounted surface only through runtime-v1 initiative and case readers', () => {
    const surface = read('src/components/Execution/ExecutionRealizationsSurface.tsx');

    expect(surface).toContain('listExecutionCases');
    expect(surface).toContain('readExecutionCase');
    expect(surface).toContain('readRegisteredInitiative');
    expect(surface).not.toContain('Api.getInitiatives');
    expect(surface).not.toContain('/initiatives/${');
  });

  it('contains no legacy initiative status writer in ExecutionHub', () => {
    const hub = read('src/components/Execution/ExecutionHub.tsx');

    expect(hub).not.toContain('Api.patch(`/initiatives/${initiativeId}/status`');
    expect(hub).not.toContain('Api.patch(`/initiatives/${id}/status`');
    expect(hub).not.toContain('handleInlineStatusChange');
    expect(hub).not.toContain('handleBulkStatusChange');
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
