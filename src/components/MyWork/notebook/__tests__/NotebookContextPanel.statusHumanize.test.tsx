/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

// FIX-18 (Day 3 layer-2 acceptance): the notebook context panel showed a raw
// `in_progress` status next to humanized ones — `capitalize` CSS on a raw
// underscore-joined string only uppercases the first character of the whole
// string ("In_progress"), since the underscore is not a word boundary. Route
// through the app's canonical `statusChip.*` dictionary (EntityStatusChip)
// instead.

vi.mock('@/components/ReportsAndPresentations/useRapData', () => ({
  useArtifactOutputsForInitiatives: () => ({ rows: [], loading: false, error: null }),
  useArtifactOutputsForOrigins: () => ({ rows: [], loading: false, error: null }),
  useAssessmentOutputsForOrigins: () => ({ rows: [], loading: false, error: null }),
}));

vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));

const apiMock = vi.hoisted(() => ({
  suggestMyIdeas: vi.fn().mockResolvedValue([]),
  getMyIdeas: vi.fn().mockResolvedValue([]),
  get: vi.fn((url: string) => {
    if (url.startsWith('/my-work/tasks')) {
      return Promise.resolve({
        tasks: [{ id: 'task-1', title: 'Migrate exports', status: 'in_progress' }],
      });
    }
    if (url.startsWith('/initiatives')) return Promise.resolve({ initiatives: [] });
    if (url.startsWith('/decisions')) return Promise.resolve({ decisions: [] });
    return Promise.resolve([]);
  }),
  getLinkGraphBacklinks: vi.fn().mockResolvedValue([]),
  notebookResolveEmbedChips: vi.fn().mockResolvedValue({ chips: [] }),
}));

vi.mock('@/services/api', () => ({
  Api: apiMock,
  default: apiMock,
}));

import { NotebookContextPanel } from '../NotebookContextPanel';

describe('NotebookContextPanel status humanization', () => {
  it('never renders a raw underscore-joined status like "In_progress"', async () => {
    render(
      <NotebookContextPanel
        open
        onClose={vi.fn()}
        editor={null}
        noteId="note-1"
        noteTitle="Export cutover"
        noteTags={[]}
        allNotes={[]}
      />
    );

    await waitFor(() => expect(screen.getByText('Migrate exports')).toBeInTheDocument());

    // The literal bug: CSS `capitalize` on "in_progress" rendered "In_progress".
    expect(screen.queryByText('In_progress')).not.toBeInTheDocument();
    expect(screen.queryByText('in_progress')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('In_progress');

    // Humanized via the canonical statusChip.* dictionary (EntityStatusChip).
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });
});
