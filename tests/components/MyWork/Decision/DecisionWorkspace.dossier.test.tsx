/**
 * MW-DEC-001 — DecisionWorkspace dossier CRUD tests (comments, alternatives,
 * risks). Real-mounts the actual `DecisionWorkspace` tree; only the HTTP
 * boundary (`Api.get/post/put/delete/getUsers`) is mocked. See
 * DecisionWorkspace.test.tsx for the lifecycle/decide-bar coverage and the
 * shared rationale for the local react-i18next mock.
 *
 * Covers:
 *  6. Comment save — success (appears only after POST resolves).
 *  7. Comment save — failure (inline error, draft preserved, no false entry).
 *  8. Alternative save — success + failure, same pattern.
 *  9. Risk save — success + failure, same pattern.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiError, makeAlternative, makeComment, makeDetail, makeRisk, makeUsers } from './fixtures';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg2?: unknown, arg3?: unknown) => {
      let template: string = key;
      let opts: Record<string, unknown> | undefined;
      if (typeof arg2 === 'string') {
        template = arg2;
        opts = (arg3 as Record<string, unknown>) || undefined;
      } else if (arg2 && typeof arg2 === 'object') {
        const o = arg2 as Record<string, unknown>;
        template = typeof o.defaultValue === 'string' ? o.defaultValue : key;
        opts = o;
      }
      if (opts) {
        for (const k of Object.keys(opts)) {
          if (k === 'defaultValue') continue;
          template = template.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(opts[k]));
        }
      }
      return template;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
  Trans: ({ children }: { children?: React.ReactNode }) => children,
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({ currentUser: { id: 'user-1', role: 'MEMBER' } }),
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), loading: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: mockToast, toast: mockToast }));

const { mockGet, mockPost, mockPut, mockDelete, mockGetUsers } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
  mockGetUsers: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    getUsers: (...args: unknown[]) => mockGetUsers(...args),
  },
}));

import { DecisionWorkspace } from '@/components/MyWork/Decision';

function renderWorkspace() {
  return render(
    <MemoryRouter>
      <DecisionWorkspace decisionId="dec-1" onClose={vi.fn()} onSaved={vi.fn()} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUsers.mockResolvedValue(makeUsers());
  // decisionOwnerId === 'user-1' so canEditDossier/canDecide are true.
  mockGet.mockResolvedValue(makeDetail({ status: 'PENDING' }));
});

describe('DecisionWorkspace — comment save', () => {
  it('success: appears in the list only after POST resolves, with the right body', async () => {
    renderWorkspace();
    await screen.findByText('Adopt Vendor X for billing');

    let resolvePost: (v: unknown) => void;
    const pending = new Promise((resolve) => {
      resolvePost = resolve;
    });
    mockPost.mockReturnValueOnce(pending);

    fireEvent.change(screen.getByPlaceholderText('Add a comment…'), {
      target: { value: 'Please double-check the SLA clause.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/ }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/decisions/dec-1/comments', {
        body: 'Please double-check the SLA clause.',
      })
    );

    // Not yet in the DOM as a rendered comment — the POST hasn't resolved.
    // (The draft textarea itself still holds this text — testing-library's
    // text matcher reads a `<textarea>`'s value — so scope to the `<p>` a
    // real rendered comment body uses, same as the failure-path test below.)
    expect(
      screen.queryByText('Please double-check the SLA clause.', { selector: 'p' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('No comments yet.')).toBeInTheDocument();

    resolvePost!(
      makeComment({ id: 'comment-new', body: 'Please double-check the SLA clause.' })
    );

    await screen.findByText('Please double-check the SLA clause.', { selector: 'p' });
    // Draft cleared on success.
    expect(
      (screen.getByPlaceholderText('Add a comment…') as HTMLTextAreaElement).value
    ).toBe('');
  });

  it('failure: shows an inline error, preserves the draft, and posts nothing to the list', async () => {
    renderWorkspace();
    await screen.findByText('Adopt Vendor X for billing');

    mockPost.mockRejectedValueOnce(apiError(500, { error: 'DB unavailable' }));

    fireEvent.change(screen.getByPlaceholderText('Add a comment…'), {
      target: { value: 'This will fail.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/ }));

    await screen.findByText(/could not post your comment/i);

    // Draft preserved.
    expect(
      (screen.getByPlaceholderText('Add a comment…') as HTMLTextAreaElement).value
    ).toBe('This will fail.');
    // Nothing false-succeeded into the list.
    expect(screen.queryByText('This will fail.', { selector: 'p' })).not.toBeInTheDocument();
    expect(screen.getByText('No comments yet.')).toBeInTheDocument();
  });
});

describe('DecisionWorkspace — alternative save', () => {
  it('success: appears only after POST resolves, with the right body', async () => {
    renderWorkspace();
    await screen.findByText('Adopt Vendor X for billing');

    fireEvent.click(screen.getByRole('button', { name: 'Add alternative' }));
    fireEvent.change(screen.getByPlaceholderText('Alternative title'), {
      target: { value: 'Build in-house' },
    });

    let resolvePost: (v: unknown) => void;
    const pending = new Promise((resolve) => {
      resolvePost = resolve;
    });
    mockPost.mockReturnValueOnce(pending);

    fireEvent.click(screen.getByRole('button', { name: 'Add alternative' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/decisions/dec-1/alternatives',
        expect.objectContaining({ title: 'Build in-house' })
      )
    );

    expect(screen.queryByText('Build in-house')).not.toBeInTheDocument();

    resolvePost!(makeAlternative({ id: 'alt-new', title: 'Build in-house' }));

    await screen.findByText('Build in-house');
  });

  it('failure: shows an inline form error, keeps the draft, does not add a row', async () => {
    renderWorkspace();
    await screen.findByText('Adopt Vendor X for billing');

    fireEvent.click(screen.getByRole('button', { name: 'Add alternative' }));
    fireEvent.change(screen.getByPlaceholderText('Alternative title'), {
      target: { value: 'Build in-house' },
    });

    mockPost.mockRejectedValueOnce(apiError(500, { error: 'boom' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add alternative' }));

    await screen.findByText('Could not save this alternative.');

    // Draft kept (form still open with the typed title).
    expect(
      (screen.getByPlaceholderText('Alternative title') as HTMLInputElement).value
    ).toBe('Build in-house');
    expect(screen.queryByText('Build in-house', { selector: 'span' })).not.toBeInTheDocument();
  });
});

describe('DecisionWorkspace — risk save', () => {
  it('success: appears only after POST resolves, with the right body', async () => {
    renderWorkspace();
    await screen.findByText('Adopt Vendor X for billing');

    fireEvent.click(screen.getByRole('button', { name: 'Add risk' }));
    fireEvent.change(screen.getByPlaceholderText('Risk description'), {
      target: { value: 'Data migration could lose records.' },
    });

    let resolvePost: (v: unknown) => void;
    const pending = new Promise((resolve) => {
      resolvePost = resolve;
    });
    mockPost.mockReturnValueOnce(pending);

    fireEvent.click(screen.getByRole('button', { name: 'Add risk' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/decisions/dec-1/risks',
        expect.objectContaining({ description: 'Data migration could lose records.' })
      )
    );

    // The rendered risk row uses a `<p>` for its description; the draft
    // textarea (same text, not yet saved) would otherwise match too.
    expect(
      screen.queryByText('Data migration could lose records.', { selector: 'p' })
    ).not.toBeInTheDocument();

    resolvePost!(makeRisk({ id: 'risk-new', description: 'Data migration could lose records.' }));

    await screen.findByText('Data migration could lose records.', { selector: 'p' });
  });

  it('failure: shows an inline form error, keeps the draft, does not add a row', async () => {
    renderWorkspace();
    await screen.findByText('Adopt Vendor X for billing');

    fireEvent.click(screen.getByRole('button', { name: 'Add risk' }));
    fireEvent.change(screen.getByPlaceholderText('Risk description'), {
      target: { value: 'Data migration could lose records.' },
    });

    mockPost.mockRejectedValueOnce(apiError(500, { error: 'boom' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add risk' }));

    await screen.findByText('Could not save this risk.');

    expect(
      (screen.getByPlaceholderText('Risk description') as HTMLTextAreaElement).value
    ).toBe('Data migration could lose records.');
    // No row was actually added (the add-form's own draft textarea is the
    // only match for this text — scoping to `<p>`, the real row element,
    // proves nothing false-succeeded into the list).
    expect(
      screen.queryByText('Data migration could lose records.', { selector: 'p' })
    ).not.toBeInTheDocument();
  });
});
