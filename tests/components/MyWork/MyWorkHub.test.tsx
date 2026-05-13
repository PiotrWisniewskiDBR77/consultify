import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __private__ } from '../../../src/components/MyWork/MyWorkHub';

const { getInitialMyWorkTab, parseMyWorkPathIntent, readStoredMyWorkDocuments } = __private__;
const { readCoreRuntimeHandoff } = __private__;
const { resolveEntityDeepLinkIntent } = __private__;
const { normalizeItemStatus } = __private__;
const { normalizeMyWorkOpenItemType } = __private__;
const { getMyWorkOpenItemStatus } = __private__;
const { getWorkspaceSelectionSummary } = __private__;
const { getInboxPresetCounts } = __private__;
const { getDocumentTab } = __private__;
const { safeResponseJson } = __private__;
const { normalizeMyWorkEntityId } = __private__;
const { getNotebookPageIdForListView } = __private__;

describe('MyWorkHub runtime helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('resolves initial tab from deep-link query before generic tab selection', () => {
    const deepLinkParams = new URLSearchParams('taskId=task-1&tab=inbox');
    expect(getInitialMyWorkTab(deepLinkParams, false, true)).toBe('tasks');

    const tabParams = new URLSearchParams('tab=inbox');
    expect(getInitialMyWorkTab(tabParams, false, true)).toBe('inbox');
  });

  it('allows manager tab only when manager access is granted', () => {
    const managerParams = new URLSearchParams('tab=manager');
    expect(getInitialMyWorkTab(managerParams, false, true)).toBe('home');
    expect(getInitialMyWorkTab(managerParams, true, true)).toBe('manager');
  });

  it('resolves only one deep-link entity intent with deterministic priority', () => {
    const params = new URLSearchParams('taskId=task-1&decisionId=dec-1&ideaId=idea-1');
    const intent = resolveEntityDeepLinkIntent(params, false);

    expect(intent).toEqual(
      expect.objectContaining({
        tab: 'tasks',
        cleanupKeys: ['taskId', 'task'],
        document: expect.objectContaining({ id: 'task-1', type: 'task' }),
      })
    );
  });

  it('does not resolve idea deep-link intent when ideas are disallowed', () => {
    const params = new URLSearchParams('ideaId=idea-1');
    expect(resolveEntityDeepLinkIntent(params, false, false)).toBeNull();
  });

  it('parses path intents for idea workspace tools and task details', () => {
    expect(parseMyWorkPathIntent('/my-work/ideas/idea-1/workspace/table', false)).toEqual(
      expect.objectContaining({
        tab: 'ideas',
        doc: expect.objectContaining({
          id: 'idea-1',
          type: 'idea',
          data: expect.objectContaining({ openMap: true, initialTool: 'table' }),
        }),
      })
    );

    expect(parseMyWorkPathIntent('/my-work/tasks/task-42', false)).toEqual(
      expect.objectContaining({
        tab: 'tasks',
        doc: expect.objectContaining({ id: 'task-42', type: 'task' }),
      })
    );

    expect(parseMyWorkPathIntent('/my-work/manager', false, false)).toEqual({ tab: 'home' });
    expect(parseMyWorkPathIntent('/my-work/manager', false, true)).toEqual({ tab: 'manager' });
  });

  it('blocks idea path intents when ideas are disallowed', () => {
    expect(parseMyWorkPathIntent('/my-work/ideas/idea-1/workspace/table', false, true, false)).toEqual(
      { tab: 'home' }
    );
    expect(parseMyWorkPathIntent('/my-work/ideas/idea-1', false, true, false)).toEqual({
      tab: 'home',
    });
    expect(parseMyWorkPathIntent('/my-work/ideas', false, true, false)).toEqual({ tab: 'home' });
  });

  it('returns null for malformed URL-encoded path segments', () => {
    expect(parseMyWorkPathIntent('/my-work/tasks/%E0%A4%A', false)).toBeNull();
  });

  it('restores persisted open documents but drops transient placeholders', () => {
    sessionStorage.setItem(
      'moduleHub.openDocuments.mywork',
      JSON.stringify({
        openDocuments: [
          { id: 'task-123', type: 'task', name: 'Task A', status: 'todo' },
          { id: 'new-task-999', type: 'task', name: 'Draft', status: 'todo' },
        ],
        activeDocumentId: 'new-task-999',
      })
    );

    expect(readStoredMyWorkDocuments()).toEqual({
      openDocuments: [{ id: 'task-123', type: 'task', name: 'Task A', status: 'todo' }],
      activeDocumentId: null,
    });
  });

  it('restores persisted notebook open documents', () => {
    sessionStorage.setItem(
      'moduleHub.openDocuments.mywork',
      JSON.stringify({
        openDocuments: [{ id: 'note-1', type: 'notebook', name: 'My note', status: 'draft' }],
        activeDocumentId: 'note-1',
      })
    );

    expect(readStoredMyWorkDocuments()).toEqual({
      openDocuments: [{ id: 'note-1', type: 'notebook', name: 'My note', status: 'draft' }],
      activeDocumentId: 'note-1',
    });
  });

  it('builds a handoff trace from Teresa query params', () => {
    const params = new URLSearchParams('source=teresa&tab=inbox');
    const trace = readCoreRuntimeHandoff('/my-work', params);

    expect(trace).toEqual(
      expect.objectContaining({
        target: 'my_work',
        source: 'teresa',
        tab: 'inbox',
        pathname: '/my-work',
      })
    );
  });

  it('normalizes non-string item status values safely', () => {
    expect(normalizeItemStatus('IN_PROGRESS', 'todo')).toBe('in_progress');
    expect(normalizeItemStatus(42, 'todo')).toBe('todo');
    expect(normalizeItemStatus({ value: 'pending' }, 'pending')).toBe('pending');
    expect(normalizeItemStatus('', 'pending')).toBe('pending');
  });

  it('normalizes mywork-open-item type values', () => {
    expect(normalizeMyWorkOpenItemType('Task')).toBe('task');
    expect(normalizeMyWorkOpenItemType(' NOTEBOOK ')).toBe('notebook');
    expect(normalizeMyWorkOpenItemType('unsupported')).toBeNull();
    expect(normalizeMyWorkOpenItemType(42)).toBeNull();
  });

  it('maps mywork-open-item status defaults safely', () => {
    expect(getMyWorkOpenItemStatus('task')).toBe('todo');
    expect(getMyWorkOpenItemStatus('decision')).toBe('pending');
    expect(getMyWorkOpenItemStatus('idea')).toBe('idea');
    expect(getMyWorkOpenItemStatus('notification')).toBe('unread');
  });

  it('builds workspace selection summary only for valid non-none selection', () => {
    expect(getWorkspaceSelectionSummary(undefined)).toBeNull();
    expect(getWorkspaceSelectionSummary({ type: 'none', count: 5 })).toBeNull();
    expect(getWorkspaceSelectionSummary({ type: '', count: 2 })).toBeNull();
    expect(getWorkspaceSelectionSummary({ type: 'mindmap', count: 2 })).toBe(
      'Selection: 2 mindmap(s) selected'
    );
    expect(getWorkspaceSelectionSummary({ type: 'node', count: 0 })).toBe(
      'Selection: 0 node(s) selected'
    );
  });

  it('resolves inbox preset counts with safe fallbacks', () => {
    expect(getInboxPresetCounts(undefined, 7)).toEqual({ all: 7, saved: 0 });
    expect(getInboxPresetCounts({ counts: { open: 3, saved: 1 } }, 7)).toEqual({
      all: 3,
      saved: 1,
    });
    expect(getInboxPresetCounts({ counts: {} }, 7)).toEqual({ all: 7, saved: 0 });
  });

  it('falls back to home tab for unknown document type', () => {
    expect(getDocumentTab('task')).toBe('tasks');
    expect(getDocumentTab('unknown' as never)).toBe('home');
  });

  it('returns null from safeResponseJson when response body is invalid', async () => {
    const okPayload = await safeResponseJson({
      json: async () => ({ value: 1 }),
    });
    expect(okPayload).toEqual({ value: 1 });

    const invalidPayload = await safeResponseJson({
      json: async () => {
        throw new Error('invalid json');
      },
    });
    expect(invalidPayload).toBeNull();
  });

  it('normalizes my work entity id values safely', () => {
    expect(normalizeMyWorkEntityId(' task-1 ')).toBe('task-1');
    expect(normalizeMyWorkEntityId('   ')).toBeNull();
    expect(normalizeMyWorkEntityId(123)).toBeNull();
  });

  it('derives notebook page id for list view only from active notebook document', () => {
    expect(
      getNotebookPageIdForListView('note-1', [
        { id: 'note-1', type: 'notebook', name: 'Note', status: 'draft' },
      ])
    ).toBe('note-1');
    expect(
      getNotebookPageIdForListView('task-1', [{ id: 'task-1', type: 'task', name: 'Task', status: 'todo' }])
    ).toBeNull();
    expect(getNotebookPageIdForListView(null, [])).toBeNull();
  });
});
