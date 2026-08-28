import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8PostMultipart: vi.fn(),
  v8Put: vi.fn(),
  v8Delete: vi.fn(),
}));

import { V8MyWorkApi } from '@/services/api/v8/my-work';
import { v8Delete, v8Get, v8Post, v8PostMultipart, v8Put } from '@/services/api/v8/client';

describe('V8MyWorkApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests canonical inbox rows from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ items: [] });

    await V8MyWorkApi.getCanonicalInboxTable({
      status: 'pending',
      limit: 200,
      section: 'assigned_tasks',
    });

    expect(v8Get).toHaveBeenCalledWith('/my-work/inbox/canonical', {
      status: 'pending',
      limit: '200',
      section: 'assigned_tasks',
    });
  });

  it('requests canonical inbox stats from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      total: 12,
      byPriority: { critical: 4 },
      bySection: { assigned_tasks: 3 },
      byStatus: { pending: 9, resolved: 2, snoozed: 1 },
      bySlaStatus: { breached: 2 },
    });

    const data = await V8MyWorkApi.getCanonicalInboxStats();

    expect(v8Get).toHaveBeenCalledWith('/my-work/inbox/canonical/stats');
    expect(data.total).toBe(12);
  });

  it('materializes canonical inbox rows through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true, upserted: 3 });

    const data = await V8MyWorkApi.materializeCanonicalInbox();

    expect(v8Post).toHaveBeenCalledWith('/my-work/inbox/canonical/materialize');
    expect(data.success).toBe(true);
    expect(data.upserted).toBe(3);
  });

  it('requests inbox ai assist through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      result: {
        brief: 'Action needed soon.',
        bullets: ['Review owner', 'Confirm deadline'],
        recommendedAction: 'accept_today',
        recommendedReason: 'Due soon and actionable',
      },
    });

    const data = await V8MyWorkApi.aiAssistInboxItem({
      language: 'en',
      item: {
        title: 'Client escalation',
        description: 'Need response before EOD',
        type: 'escalation',
        section: 'blocked_escalations',
        urgency: 'high',
        receivedAt: '2026-03-25T10:00:00.000Z',
        reason: 'Escalated due to SLA risk',
      },
    });

    expect(v8Post).toHaveBeenCalledWith('/my-work/inbox/ai-assist', {
      language: 'en',
      item: {
        title: 'Client escalation',
        description: 'Need response before EOD',
        type: 'escalation',
        section: 'blocked_escalations',
        urgency: 'high',
        receivedAt: '2026-03-25T10:00:00.000Z',
        reason: 'Escalated due to SLA risk',
      },
    });
    expect(data.result.recommendedAction).toBe('accept_today');
  });

  it('requests notebook pages from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue([]);

    await V8MyWorkApi.getNotebookPages({
      projectId: 'project-1',
      status: 'active',
      pinned: true,
      sort: 'updated',
      q: 'signal',
      limit: 25,
    });

    expect(v8Get).toHaveBeenCalledWith('/my-work/notebook/pages', {
      projectId: 'project-1',
      status: 'active',
      pinned: '1',
      sort: 'updated',
      q: 'signal',
      limit: '25',
    });
  });

  it('writes notebook core mutations through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ id: 'note-1', title: 'New note', contentJson: {}, tags: [], status: 'active', pinned: false });
    vi.mocked(v8Put).mockResolvedValue({ id: 'note-1', status: 'archived' });
    vi.mocked(v8Delete).mockResolvedValue({ success: true, id: 'note-1' });

    await V8MyWorkApi.createNotebookPage({ title: 'New note' });
    await V8MyWorkApi.updateNotebookPage('note-1', { title: 'Updated note' });
    await V8MyWorkApi.pinNotebookPage('note-1');
    await V8MyWorkApi.setNotebookPageStatus('note-1', 'archived');
    await V8MyWorkApi.deleteNotebookPage('note-1');

    expect(v8Post).toHaveBeenCalledWith('/my-work/notebook/pages', { title: 'New note' });
    expect(v8Put).toHaveBeenCalledWith('/my-work/notebook/pages/note-1', { title: 'Updated note' });
    expect(v8Put).toHaveBeenCalledWith('/my-work/notebook/pages/note-1/pin');
    expect(v8Put).toHaveBeenCalledWith('/my-work/notebook/pages/note-1/status', { status: 'archived' });
    expect(v8Delete).toHaveBeenCalledWith('/my-work/notebook/pages/note-1', {
      extraHeaders: { 'Idempotency-Key': undefined },
    });
  });

  it('routes notebook capture upload through the V8 namespace', async () => {
    vi.mocked(v8PostMultipart).mockResolvedValue({
      pageId: 'captured-note-1',
      source: 'upload',
    });

    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    await V8MyWorkApi.notebookCaptureUpload(file);

    expect(v8PostMultipart).toHaveBeenCalledWith(
      '/my-work/notebook/capture/upload',
      expect.any(FormData)
    );
  });

  it('requests notebook classify through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      pageId: 'note-7',
      suggestedType: 'idea',
      reason: 'Contains exploratory/idea language',
      maturity: 'mature',
    });

    const data = await V8MyWorkApi.classifyNotebookPage('note-7');

    expect(v8Post).toHaveBeenCalledWith('/my-work/notebook/pages/note-7/classify');
    expect(data.suggestedType).toBe('idea');
  });

  it('routes notebook AI proposals through the V8 namespace', async () => {
    vi.mocked(v8Post)
      .mockResolvedValueOnce({
        id: 'proposal-1',
        pageId: 'note-7',
        actorId: 'user-1',
        proposalType: 'append',
        blockContent: { type: 'paragraph' },
        rationale: 'Add summary',
        status: 'proposed',
      })
      .mockResolvedValueOnce({
        id: 'proposal-1',
        pageId: 'note-7',
        actorId: 'user-1',
        proposalType: 'append',
        blockContent: { type: 'paragraph' },
        rationale: 'Add summary',
        status: 'accepted',
      });
    vi.mocked(v8Get).mockResolvedValue({
      proposals: [
        {
          id: 'proposal-1',
          pageId: 'note-7',
          actorId: 'user-1',
          proposalType: 'append',
          blockContent: { type: 'paragraph' },
          rationale: 'Add summary',
          status: 'proposed',
        },
      ],
    });

    const created = await V8MyWorkApi.createNotebookAIProposal('note-7', {
      proposalType: 'append',
      blockContent: { type: 'paragraph' },
      rationale: 'Add summary',
    });
    const listed = await V8MyWorkApi.getNotebookAIProposals('note-7', {
      status: 'proposed',
      limit: 20,
    });
    const resolved = await V8MyWorkApi.resolveNotebookAIProposal('proposal-1', 'accepted');

    expect(v8Post).toHaveBeenNthCalledWith(1, '/my-work/notebook/pages/note-7/ai-proposals', {
      proposalType: 'append',
      blockContent: { type: 'paragraph' },
      rationale: 'Add summary',
    });
    expect(v8Get).toHaveBeenCalledWith('/my-work/notebook/pages/note-7/ai-proposals', {
      status: 'proposed',
      limit: '20',
    });
    expect(v8Post).toHaveBeenNthCalledWith(
      2,
      '/my-work/notebook/ai-proposals/proposal-1/resolve',
      { action: 'accepted' },
    );
    expect(created.status).toBe('proposed');
    expect(listed.proposals).toHaveLength(1);
    expect(resolved.status).toBe('accepted');
  });

  it('routes notebook convert through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      id: 'initiative-7',
      type: 'initiative',
      title: 'Converted initiative',
      sourceSessionId: 'tool-9',
    });

    const data = await V8MyWorkApi.convertNotebookPage('note-7', 'initiative', {
      title: 'Converted initiative',
      description: 'Notebook summary',
    });

    expect(v8Post).toHaveBeenCalledWith('/my-work/notebook/pages/note-7/convert', {
      target: 'initiative',
      title: 'Converted initiative',
      description: 'Notebook summary',
    });
    expect(data.sourceSessionId).toBe('tool-9');
  });

  it('requests calendar unified data from the bounded V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ events: [] });

    await V8MyWorkApi.getCalendarUnified({
      start: '2026-03-01',
      end: '2026-04-01',
      sources: ['task', 'decision'],
      projectId: 'project-9',
      ownership: 'assignee',
    });

    expect(v8Get).toHaveBeenCalledWith('/my-work/calendar/unified', {
      start: '2026-03-01',
      end: '2026-04-01',
      sources: 'task,decision',
      projectId: 'project-9',
      ownership: 'assignee',
    });
  });

  it('writes calendar mutations through the bounded V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      date: '2026-03-27',
      tasks: [],
      decisions: [],
      totalItems: 0,
      hasConflicts: false,
      suggestion: null,
    });
    vi.mocked(v8Post).mockResolvedValue({
      id: 'task-99',
      source: 'task',
      message: 'Task created from calendar',
    });

    await V8MyWorkApi.getCalendarConflicts('2026-03-27');
    await V8MyWorkApi.createCalendarEvent({
      title: 'Calendar task',
      start: '2026-03-27',
      allDay: true,
      source: 'task',
      recurrence: { preset: 'weekly' },
    });
    await V8MyWorkApi.updateCalendarEvent('task', 'task-99', {
      start: '2026-03-28',
      allDay: true,
    });

    expect(v8Get).toHaveBeenCalledWith('/my-work/calendar/conflicts', { date: '2026-03-27' });
    expect(v8Post).toHaveBeenCalledWith('/my-work/calendar/events', {
      title: 'Calendar task',
      start: '2026-03-27',
      allDay: true,
      source: 'task',
      recurrence: { preset: 'weekly' },
    });
    expect(v8Put).toHaveBeenCalledWith('/my-work/calendar/events/task/task-99', {
      start: '2026-03-28',
      allDay: true,
    });
  });
});
