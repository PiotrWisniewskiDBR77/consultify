import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../MyWorkHub.tsx'), 'utf8');
const workspaceSource = fs.readFileSync(path.resolve(__dirname, '../IdeaMapWorkspace.tsx'), 'utf8');

describe('MyWorkHub notebook loading counts', () => {
  it('keeps counts unknown until NotebookLibraryContent reports measured values', () => {
    expect(source).toContain('} | null>(null);');
    expect(source).toContain("count: notebookScopeCounts?.all ?? '—'");
    expect(source).toContain("count: notebookScopeCounts?.personal ?? '—'");
    expect(source).toContain("count: notebookScopeCounts?.team ?? '—'");
    expect(source).toContain('onScopeCountsChange={setNotebookScopeCounts}');
    expect(source).toContain('data-testid="tab-count"');
    expect(source).not.toMatch(/setNotebookScopeCounts\]\s*=\s*useState\(\{\s*all:\s*0/);
  });

  it('keeps the shared canvas skeleton through canonical graph hydration', () => {
    expect(workspaceSource).toContain('const graphHydrating = loading || graphRuntime.loading');
    expect(workspaceSource).toContain('useDeferredLoading(graphHydrating)');
    expect(workspaceSource).toContain('data-testid="idea-canvas-loading"');
    expect(workspaceSource).toContain('<SkeletonState variant="canvas" />');
    expect(workspaceSource).toContain("loadingPhase === 'timeout'");
  });
});
