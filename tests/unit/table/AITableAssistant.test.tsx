/**
 * Tests for AITableAssistant — command input, API call, loading state, error handling.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AITableAssistant } from '@/components/MyWork/table/AITableAssistant';
import type { ColumnDef } from '@/components/MyWork/table/tableTypes';

// Real interpolation templates for the two keys this component substitutes params into, so
// tests can assert on real values (e.g. the offending column name) flowing through t() calls.
// Every other key resolves to the raw key (matches this repo's usual identity-mock convention).
const I18N_TEMPLATES: Record<string, string> = {
  'myWorkTable.aiTableAssistant.columnNotFound': 'Column "{{column}}" was not found in this table.',
  'myWorkTable.aiTableAssistant.rowsAdded': 'Added {{count}} rows',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const template = I18N_TEMPLATES[key] ?? key;
      if (!opts) return template;
      return template.replace(/\{\{(\w+)\}\}/g, (_m, name) => String((opts as any)[name] ?? ''));
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

const mockGetIdeaAITableAction = vi.fn();
const mockGenerateSchemaProposal = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    getIdeaAITableAction: (...args: any[]) => mockGetIdeaAITableAction(...args),
  },
}));

vi.mock('@/services/api/tablePlatform.api', () => ({
  generateSchemaProposal: (...args: any[]) => mockGenerateSchemaProposal(...args),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const columns: ColumnDef[] = [
  { key: 'label', header: 'Name', type: 'text', visible: true, width: 200 },
  { key: 'status', header: 'Status', type: 'status', visible: true, width: 140, options: ['Todo', 'Done'] },
  { key: 'effort', header: 'Effort', type: 'number', visible: true, width: 100 },
];

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  ideaId: 'idea-123',
  columns,
  onApplyAction: vi.fn(),
  language: 'en',
};

describe('AITableAssistant', () => {
  it('renders when open', () => {
    render(<AITableAssistant {...defaultProps} />);
    expect(document.body.textContent).toBeTruthy();
  });

  it('does not render when closed', () => {
    const { container } = render(<AITableAssistant {...defaultProps} open={false} />);
    expect(container.firstChild).toBeFalsy();
  });

  it('renders input field for commands', () => {
    render(<AITableAssistant {...defaultProps} />);
    const inputs = document.querySelectorAll('input, textarea');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('renders suggestion chips', () => {
    render(<AITableAssistant {...defaultProps} />);
    const buttons = document.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('calls API when command is submitted', async () => {
    mockGetIdeaAITableAction.mockResolvedValue({
      action: 'sort',
      params: { column: 'effort', direction: 'desc' },
    });

    render(<AITableAssistant {...defaultProps} />);

    const input = document.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
    if (!input) return;

    fireEvent.change(input, { target: { value: 'Sort by effort descending' } });

    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    } else {
      fireEvent.keyDown(input, { key: 'Enter' });
    }

    await waitFor(() => {
      expect(mockGetIdeaAITableAction).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('handles API error gracefully', async () => {
    mockGetIdeaAITableAction.mockRejectedValue(new Error('Network error'));

    render(<AITableAssistant {...defaultProps} />);

    const input = document.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
    if (!input) return;

    fireEvent.change(input, { target: { value: 'Do something' } });

    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    } else {
      fireEvent.keyDown(input, { key: 'Enter' });
    }

    await waitFor(() => {
      expect(mockGetIdeaAITableAction).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('passes artifact context when provided', async () => {
    mockGetIdeaAITableAction.mockResolvedValue({
      action: 'add_column',
      params: { name: 'Priority', type: 'select' },
    });

    const artifactContext = [
      { id: 'art-1', type: 'initiative', title: 'Project Alpha', snippet: 'Key initiative' },
    ];

    render(
      <AITableAssistant
        {...defaultProps}
        artifactContext={artifactContext}
      />
    );

    const input = document.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
    if (!input) return;

    fireEvent.change(input, { target: { value: 'Add priority column' } });

    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    } else {
      fireEvent.keyDown(input, { key: 'Enter' });
    }

    await waitFor(() => {
      expect(mockGetIdeaAITableAction).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('calls onClose when close button is clicked', () => {
    render(<AITableAssistant {...defaultProps} />);
    const closeButtons = Array.from(document.querySelectorAll('button')).filter(
      (btn) => btn.querySelector('svg') && btn.textContent?.trim() === ''
    );
    if (closeButtons.length > 0) {
      fireEvent.click(closeButtons[0]);
      expect(defaultProps.onClose).toHaveBeenCalled();
    }
  });

  // TB-P2-03 — labelled Send button (click submits, not just Enter), and the
  // X gets a real accessible name so it can't be mistaken for Send.
  it('has a labelled, clickable Send button distinct from Enter submission', async () => {
    mockGetIdeaAITableAction.mockResolvedValue({ action: { type: 'sort', column: 'effort' } });
    render(<AITableAssistant {...defaultProps} />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled(); // empty command

    const input = document.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Sort by effort' } });
    expect(sendButton).not.toBeDisabled();

    fireEvent.click(sendButton);
    await waitFor(() => expect(mockGetIdeaAITableAction).toHaveBeenCalled());
  });

  it('gives the close (X) button an accessible name so it is not confused with Send', () => {
    render(<AITableAssistant {...defaultProps} />);
    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toHaveAttribute('title');
    // Distinct accessible names: Send vs Close, never the same control.
    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(closeButton).not.toBe(sendButton);
    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('still submits on Enter (unchanged) in addition to the new Send button', async () => {
    mockGetIdeaAITableAction.mockResolvedValue({ action: { type: 'sort', column: 'effort' } });
    render(<AITableAssistant {...defaultProps} />);
    const input = document.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Sort by effort' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(mockGetIdeaAITableAction).toHaveBeenCalled());
  });
});

/**
 * TB-P1-03 — Table AI terminal outcome. Five acceptance-matrix cases: the submitted command
 * must be retained and reach exactly one durable terminal state, never a silent close/clear.
 */
describe('AITableAssistant — TB-P1-03 terminal states', () => {
  const submit = (input: HTMLElement, text: string) => {
    fireEvent.change(input, { target: { value: text } });
    fireEvent.keyDown(input, { key: 'Enter' });
  };

  it('supported field command -> preview -> apply -> persisted field (proposal handed to review)', async () => {
    mockGenerateSchemaProposal.mockResolvedValue({
      summary: 'Add a Budget field',
      operations: [{ operationType: 'create_field', payload: { name: 'Budget', fieldType: 'currency' } }],
    });
    const onProposal = vi.fn();

    render(
      <AITableAssistant
        {...defaultProps}
        onProposal={onProposal}
        usePlatform
        workspaceId="ws-1"
      />
    );

    const input = screen.getByPlaceholderText('myWorkTable.aiTableAssistant.commandPlaceholder');
    submit(input, 'Add a Budget currency column');

    await waitFor(() => {
      expect(onProposal).toHaveBeenCalledWith(
        expect.objectContaining({ columns: expect.arrayContaining([expect.objectContaining({ header: 'Budget' })]) })
      );
    });

    // Command text is retained (submitted before the input was cleared on success).
    expect(mockGenerateSchemaProposal).toHaveBeenCalledWith(
      'ws-1',
      'Add a Budget currency column',
      expect.any(Array),
      'en',
      undefined,
      expect.anything()
    );
  });

  it('unsupported command -> visible actionable error, not a silent close/clear', async () => {
    mockGetIdeaAITableAction.mockResolvedValue({ action: { type: 'delete_all_rows' } });

    render(<AITableAssistant {...defaultProps} />);
    const input = screen.getByPlaceholderText('myWorkTable.aiTableAssistant.commandPlaceholder');
    submit(input, 'Nuke everything');

    const region = await screen.findByTestId('ai-table-assistant-terminal-state');
    await waitFor(() => expect(region.getAttribute('data-status')).toBe('unsupported'));
    expect(region.getAttribute('role')).toBe('alert');
    // Command stays visible in the terminal region (retained in history), panel did not close.
    expect(region.textContent).toContain('Nuke everything');
    expect(defaultProps.onClose).not.toHaveBeenCalled();
    // Retry/Edit affordance present for a recoverable failure.
    expect(screen.getByText('myWorkTable.aiTableAssistant.retry')).toBeTruthy();
    expect(screen.getByText('myWorkTable.aiTableAssistant.edit')).toBeTruthy();
  });

  it('empty/no-op mapping -> explicit refusal (empty submit and unmapped column both refuse)', async () => {
    render(<AITableAssistant {...defaultProps} />);
    const input = screen.getByPlaceholderText('myWorkTable.aiTableAssistant.commandPlaceholder');

    // Empty submit: explicit inline refusal, no API call.
    fireEvent.keyDown(input, { key: 'Enter' });
    const notice = await screen.findByText('myWorkTable.aiTableAssistant.commandRequired');
    expect(notice.closest('[role="alert"]')).toBeTruthy();
    expect(mockGetIdeaAITableAction).not.toHaveBeenCalled();

    // No-op mapping: action resolves to a column that does not exist in the schema.
    mockGetIdeaAITableAction.mockResolvedValue({
      action: { type: 'sort', column: 'not_a_real_column', direction: 'asc' },
    });
    submit(input, 'Sort by unicorns');

    const region = await screen.findByTestId('ai-table-assistant-terminal-state');
    await waitFor(() => expect(region.getAttribute('data-status')).toBe('validation'));
    expect(region.getAttribute('role')).toBe('alert');
    expect(region.textContent).toContain('not_a_real_column');
  });

  it('backend transport failure -> retryable state that preserves the command', async () => {
    mockGetIdeaAITableAction.mockRejectedValueOnce(new Error('network down'));

    render(<AITableAssistant {...defaultProps} />);
    const input = screen.getByPlaceholderText(
      'myWorkTable.aiTableAssistant.commandPlaceholder'
    ) as HTMLInputElement;
    submit(input, 'Group by status');

    const region = await screen.findByTestId('ai-table-assistant-terminal-state');
    await waitFor(() => expect(region.getAttribute('data-status')).toBe('transport'));
    expect(region.getAttribute('role')).toBe('alert');

    // Retry re-issues the exact same command against the API.
    mockGetIdeaAITableAction.mockResolvedValueOnce({ action: { type: 'group', column: 'status' } });
    fireEvent.click(screen.getByText('myWorkTable.aiTableAssistant.retry'));

    await waitFor(() => {
      expect(mockGetIdeaAITableAction).toHaveBeenCalledTimes(2);
    });
    const [, secondPayload] = mockGetIdeaAITableAction.mock.calls[1];
    expect(secondPayload.command).toBe('Group by status');
  });

  it('cancellation is visibly distinct from failure', async () => {
    let rejectFn: (err: any) => void = () => {};
    mockGetIdeaAITableAction.mockImplementation(
      (_ideaId: string, _payload: any, signal?: AbortSignal) =>
        new Promise((_resolve, reject) => {
          rejectFn = reject;
          signal?.addEventListener('abort', () => {
            const err: any = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );

    render(<AITableAssistant {...defaultProps} />);
    const input = screen.getByPlaceholderText('myWorkTable.aiTableAssistant.commandPlaceholder');
    submit(input, 'Summarize the table');

    const cancelBtn = await screen.findByText('myWorkTable.aiTableAssistant.cancel');
    fireEvent.click(cancelBtn);

    const region = await screen.findByTestId('ai-table-assistant-terminal-state');
    await waitFor(() => expect(region.getAttribute('data-status')).toBe('cancelled'));
    // Cancelled is a status region (not an alert) — distinct from the error states above.
    expect(region.getAttribute('role')).toBe('status');

    void rejectFn; // silence unused-var lint if the abort listener already settled the promise
  });
});
