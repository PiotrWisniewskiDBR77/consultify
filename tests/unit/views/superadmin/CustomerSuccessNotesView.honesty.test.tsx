import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { CustomerSuccessNotesView } from '@/views/superadmin/support/CustomerSuccessNotesView';

vi.mock('@/services/api', () => ({
  Api: {
    createCustomerSuccessNote: vi.fn(),
    getCustomerSuccessNotes: vi.fn(),
    getOrganizations: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/components/Admin/AdminState', () => ({
  DegradedState: ({ title, description }: { title: string; description: string }) => (
    <div role="alert">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

describe('CustomerSuccessNotesView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed note loads as an empty notes list', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getCustomerSuccessNotes).mockRejectedValue(new Error('Notes API down'));

    render(<CustomerSuccessNotesView />);

    await waitFor(() => {
      expect(screen.getByText('Customer success notes unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Notes API down')).toBeInTheDocument();
    expect(screen.queryByText('No notes found')).not.toBeInTheDocument();
  });

  it('does not claim note creation success when read-back is stale', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getCustomerSuccessNotes).mockResolvedValue([]);
    vi.mocked(Api.createCustomerSuccessNote).mockResolvedValue({ success: true });

    render(<CustomerSuccessNotesView />);

    await screen.findByText('No notes found');
    fireEvent.click(screen.getByRole('button', { name: /Add Note/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. QBR notes'), {
      target: { value: 'QBR notes' },
    });
    fireEvent.change(screen.getByPlaceholderText('Write the note...'), {
      target: { value: 'Customer is healthy.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Customer success note creation was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('uses safe note dates', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getCustomerSuccessNotes).mockResolvedValue([
      {
        id: 'note-1',
        title: 'Bad date note',
        content: 'Body',
        created_at: 'not-a-date',
      },
    ]);

    render(<CustomerSuccessNotesView />);

    expect(await screen.findByText('Unknown date')).toBeInTheDocument();
  });

  it('accepts wrapped organization and notes payloads with nested create responses', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue({
      data: { data: { organizations: [{ id: 'org-1', name: 'Org One' }] } },
    });
    vi.mocked(Api.getCustomerSuccessNotes)
      .mockResolvedValueOnce({
        data: {
          data: {
            notes: [
              {
                id: 'note-1',
                title: 'Wrapped note',
                content: 'Body',
                created_at: 'not-a-date',
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            notes: [
              {
                id: 'note-1',
                title: 'Wrapped note',
                content: 'Body',
                created_at: 'not-a-date',
              },
              {
                id: 'note-2',
                title: 'QBR notes',
                content: 'Customer is healthy.',
                created_at: '2026-04-26T00:00:00.000Z',
              },
            ],
          },
        },
      });
    vi.mocked(Api.createCustomerSuccessNote).mockResolvedValue({
      data: { data: { note: { id: 'note-2' } } },
    });

    render(<CustomerSuccessNotesView />);

    expect(await screen.findByText('Wrapped note')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add Note/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. QBR notes'), {
      target: { value: 'QBR notes' },
    });
    fireEvent.change(screen.getByPlaceholderText('Write the note...'), {
      target: { value: 'Customer is healthy.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create/i }));

    await waitFor(() => {
      expect(screen.queryByText('Add CS Note')).not.toBeInTheDocument();
    });
    expect(screen.getByText('QBR notes')).toBeInTheDocument();
  });

  it('does not render malformed notes payloads as an empty notes list', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getCustomerSuccessNotes).mockResolvedValue({ unexpected: true });

    render(<CustomerSuccessNotesView />);

    await waitFor(() => {
      expect(screen.getByText('Customer success notes unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Customer success notes response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No notes found')).not.toBeInTheDocument();
  });
});
