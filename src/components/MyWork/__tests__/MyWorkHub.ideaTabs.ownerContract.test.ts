import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/MyWork/MyWorkHub.tsx'),
  'utf8'
);

describe('My Work Idea tab owner contract', () => {
  it('maps every canvas tool to a distinct icon and accent', () => {
    expect(source).toContain('const IDEA_TOOL_TAB_VISUALS');
    expect(source).toContain("mindmap: { icon: Network, border: 'border-l-violet-500' }");
    expect(source).toContain("process_flow: { icon: GitBranch, border: 'border-l-blue-500' }");
    expect(source).toContain("table: { icon: Table2, border: 'border-l-emerald-500' }");
    expect(source).toContain("whiteboard: { icon: PenTool, border: 'border-l-amber-500' }");
    expect(source).toContain('<IdeaToolIcon size={14} aria-hidden={true} />');
    expect(source).toContain('getIdeaWorkspaceToolLabel(ideaTool, Boolean(isPolish))');
    expect(source).toContain('<span className="sr-only">');
    expect(source).toContain('role="tab"');
    expect(source).toContain('aria-selected={isActive}');
    expect(source).toContain('role="tablist"');
    expect(source).toContain('tabIndex={isActive ? 0 : -1}');
    expect(source).toContain('aria-controls={`my-work-document-panel-${doc.id}`}');
    expect(source).toContain('role="tabpanel"');
    expect(source).toContain('aria-labelledby={`my-work-document-tab-${activeDocumentId}`}');
    expect(source).toContain("['ArrowLeft', 'ArrowRight', 'Home', 'End']");
  });

  it('persists a changed Idea tool in the existing scoped open-document record', () => {
    const handler = source.slice(
      source.indexOf('const handleIdeaToolChange'),
      source.indexOf('const handleIdeaSelectionChange')
    );
    expect(handler).toContain('setOpenDocuments((prev) =>');
    expect(handler).toContain('data: { ...doc.data, initialTool: tool }');
    expect(source).toContain('writeStoredMyWorkDocuments(myWorkDocumentsUserId');
  });

  it('keeps New Idea available in the contextual document row', () => {
    expect(source).toContain('data-testid="ideas-contextual-new-idea"');
    expect(source).toContain("t('myWork.hub.label18', 'New Idea')");
  });

  it('keeps every Ideas identity-row action unique and Spark only as a lifecycle filter', () => {
    const identityStart = source.indexOf('{/* List button — w trybie edycji');
    const identityEnd = source.indexOf('{/* Document Tabs', identityStart);
    const identityActions = source.slice(identityStart, identityEnd);

    expect(identityActions).toContain('handleListClick');
    expect(identityActions).toContain('handleCreateIdea');
    expect(identityActions).toContain('ideas-contextual-new-idea');
    expect(identityActions).not.toContain('Sparkles');
    expect(identityActions).not.toContain('openTabAiContext');
    expect(identityActions).not.toContain('handleSave');
    expect(identityActions).not.toContain('handleConvert');
    expect(identityActions).not.toContain('Export');

    const stageStart = source.indexOf('const stagePresets:');
    const stageEnd = source.indexOf('// S1-U1:', stageStart);
    const stageFilters = source.slice(stageStart, stageEnd);
    expect(stageFilters).toContain("id: 'spark'");
    expect(stageFilters).toContain("getIdeaStageBucketLabel('spark', isPolish)");
    expect(stageFilters).toContain('<Lightbulb size={14}');
    expect(stageFilters).not.toContain('<Sparkles');
  });
});
