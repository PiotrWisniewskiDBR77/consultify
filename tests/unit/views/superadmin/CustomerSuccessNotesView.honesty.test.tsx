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

describe('CustomerSuccessNotesView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed note loads as an empty notes list', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getCustomerSuccessNotes).mockRejectedValue(new Error('Notes API down'));

    render(<CustomerSuccessNotesView />);

    await screen.findByText('Customer success notes unavailable');
    expect(document.body.textContent || '').not.toContain('SQLSTATE');
    expect(document.body.textContent || '').not.toContain('/var/');
    expect(screen.queryByText('No notes found')).not.toBeInTheDocument();
  });

  it('does not claim note creation success when read-back is stale', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getCustomerSuccessNotes).mockResolvedValue([]);
    vi.mocked(Api.createCustomerSuccessNote).mockResolvedValue({ success: true, id: 'note-created-1' });

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

    await screen.findByRole('alert');
    expect(document.body.textContent || '').toContain('Could not create customer success note.');

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
      success: true,
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
      expect(screen.queryByRole('button', { name: /Create/i })).not.toBeInTheDocument();
    });
    expect(screen.getByText('QBR notes')).toBeInTheDocument();
  });

  it('does not render malformed notes payloads as an empty notes list', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getCustomerSuccessNotes).mockResolvedValue({ unexpected: true });

    render(<CustomerSuccessNotesView />);

    await screen.findByText('Customer success notes unavailable');
    expect(document.body.textContent || '').not.toContain('SQLSTATE');
    expect(document.body.textContent || '').not.toContain('/var/');
    expect(screen.queryByText('No notes found')).not.toBeInTheDocument();
  });

  it('renders accessible fail-closed alert and machine code when notes load fails with internal details', async () => {
    const err: any = new Error('internal: SQLSTATE[HY000] /var/app/secrets');
    err.code = 'CS_NOTES_READ_FAILED';
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getCustomerSuccessNotes).mockRejectedValue(err);

    render(<CustomerSuccessNotesView />);

    await screen.findByText('Customer success notes unavailable');
    expect(document.body.textContent || '').not.toContain('SQLSTATE');
    expect(document.body.textContent || '').not.toContain('/var/');
  });

  it('renders accessible fail-closed alert and machine code when organization bootstrap fails', async () => {
    const err: any = new Error('internal: SQLSTATE[HY000] /var/app/secrets');
    err.code = 'ORG_READ_FAILED';
    vi.mocked(Api.getOrganizations).mockRejectedValue(err);

    render(<CustomerSuccessNotesView />);

    await screen.findByText('Customer success notes unavailable');
    expect(document.body.textContent || '').not.toContain('SQLSTATE');
    expect(document.body.textContent || '').not.toContain('/var/');
  });

  it('renders fail-closed alert when note creation fails and does not leak internal details', async () => {
    const err: any = new Error('internal: SQLSTATE[HY000] /var/app/secrets');
    err.code = 'CS_NOTE_CREATE_FAILED';
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getCustomerSuccessNotes).mockResolvedValue([]);
    vi.mocked(Api.createCustomerSuccessNote).mockRejectedValue(err);

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
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(document.body.textContent || '').not.toContain('SQLSTATE');
      expect(document.body.textContent || '').not.toContain('/var/');
    });
    expect(toast.error).toHaveBeenCalledWith('Could not create customer success note.');
  });
});
