import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
  v8Delete: vi.fn(),
}));

import { V8MyWorkApi } from '@/services/api/v8/my-work';
import { v8Delete, v8Get, v8Post, v8Put } from '@/services/api/v8/client';

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
    expect(v8Delete).toHaveBeenCalledWith('/my-work/notebook/pages/note-1');
  });

  it('requests calendar unified data from the bounded V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ events: [] });

    await V8MyWorkApi.getCalendarUnified({
      start: '2026-03-01',
      end: '2026-04-01',
      sources: ['task', 'decision'],
      projectId: 'project-9',
    });

    expect(v8Get).toHaveBeenCalledWith('/my-work/calendar/unified', {
      start: '2026-03-01',
      end: '2026-04-01',
      sources: 'task,decision',
      projectId: 'project-9',
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
    });

    expect(v8Get).toHaveBeenCalledWith('/my-work/calendar/conflicts', { date: '2026-03-27' });
    expect(v8Post).toHaveBeenCalledWith('/my-work/calendar/events', {
      title: 'Calendar task',
      start: '2026-03-27',
      allDay: true,
      source: 'task',
    });
  });
});
