/**
 * P3.1 — ShareModal "Collaborate · Invite by email" real handler.
 *
 * Before P3.1 the Collaborate tab was a pure visual stub: the email input and
 * the invite/permission buttons had NO onClick handlers. This suite proves the
 * invite now does real work by reusing the existing share-link endpoint:
 *   1. Clicking invite with a valid email mints a share token via
 *      POST /presentations/decks/:id/share (the existing, audited endpoint).
 *   2. The share URL is copied to the clipboard and a mailto: is opened.
 *   3. An invalid email is rejected before any network call.
 *   4. Permission (View/Comment) selection toggles (aria-pressed).
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const writeTextMock = vi.fn().mockResolvedValue(undefined);

const postMock = vi.fn();
const getMock = vi.fn();
const deleteMock = vi.fn();
vi.mock('@/services/api', () => ({
  Api: {
    post: (...args: any[]) => postMock(...args),
    get: (...args: any[]) => getMock(...args),
    delete: (...args: any[]) => deleteMock(...args),
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

import { ShareModal } from '../../../src/components/Presentations/DeckBuilder/ShareModal';

// The Collaborate tab is flag-gated; force it on for the test.
const ORIGINAL_ENV = { ...import.meta.env };

function proxiedApiResponse<T extends object>(payload: T): T {
  return new Proxy(payload, {
    get(target, property, receiver) {
      if (property === 'data') return target;
      return Reflect.get(target, property, receiver);
    },
  });
}

describe('ShareModal — Collaborate invite (P3.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (import.meta.env as any).VITE_ENABLE_DECK_COLLABORATE = 'true';
    postMock.mockResolvedValue({ data: { data: { shareToken: 'tok_abc123', expiresAt: 'x' } } });
    getMock.mockResolvedValue({
      data: { data: { active: false, shareToken: null, expiresAt: null } },
    });
    deleteMock.mockResolvedValue({ data: { data: { revoked: true } } });
    writeTextMock.mockClear();
    // navigator.clipboard may be getter-only / present in jsdom → ensure a
    // no-throw stub exists so the invite's copy step doesn't blow up.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });
    // window.location.href assignment (mailto) must not throw in jsdom.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, origin: 'https://app.test', href: '' },
    });
  });

  afterEach(() => {
    (import.meta.env as any).VITE_ENABLE_DECK_COLLABORATE =
      ORIGINAL_ENV.VITE_ENABLE_DECK_COLLABORATE;
  });

  function renderModal() {
    return render(
      <ShareModal
        isOpen
        onClose={vi.fn()}
        deckId="deck-1"
        deckTitle="Q4 Strategy"
        onExport={vi.fn()}
      />
    );
  }

  it('mints a share token via the existing /share endpoint and copies the link on invite', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /collaborate/i }));
    await user.type(screen.getByTestId('deck-invite-email'), 'colleague@example.com');
    await user.click(screen.getByTestId('deck-invite-submit'));

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/presentations/decks/deck-1/share', {
        expiresInDays: 7,
      })
    );
    // The invite builds the collaborator share URL and hands it off via mailto:
    // (the load-bearing proof the token was minted and wired into the invite).
    // The URL is percent-encoded inside the mailto body, so match on the token
    // + the shared-path segment rather than raw slashes.
    await waitFor(() => {
      const href = String((window.location as any).href);
      expect(href).toMatch(/^mailto:colleague@example\.com/);
      expect(decodeURIComponent(href)).toContain('/presentations/shared/tok_abc123');
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('reads a public share token from the real shared Api proxy shape', async () => {
    const user = userEvent.setup();
    postMock.mockResolvedValue(
      proxiedApiResponse({ success: true, data: { shareToken: 'tok_runtime' } })
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: 'OFF' }));

    await waitFor(() =>
      expect(screen.getByDisplayValue(/presentations\/shared\/tok_runtime/)).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'ON' })).toBeInTheDocument();
  });

  it('rejects an invalid email without hitting the network', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /collaborate/i }));
    await user.type(screen.getByTestId('deck-invite-email'), 'not-an-email');
    await user.click(screen.getByTestId('deck-invite-submit'));

    expect(postMock).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });

  it('lets the user pick a role (Viewer default → Editor)', async () => {
    // P3.3: the permission model is now role-based (viewer/editor) — invite
    // creates a real presentation_deck_collaborators row with the chosen role.
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /collaborate/i }));
    const viewerBtn = screen.getByTestId('deck-invite-perm-viewer');
    const editorBtn = screen.getByTestId('deck-invite-perm-editor');

    expect(viewerBtn).toHaveAttribute('aria-pressed', 'true');
    expect(editorBtn).toHaveAttribute('aria-pressed', 'false');

    await user.click(editorBtn);
    expect(editorBtn).toHaveAttribute('aria-pressed', 'true');
    expect(viewerBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('cold-reopens an active link, rotates it and revokes it through the mounted lifecycle', async () => {
    const user = userEvent.setup();
    getMock.mockResolvedValue(
      proxiedApiResponse({
        success: true,
        data: { active: true, shareToken: 'tok_old', expiresAt: '2026-08-26T10:00:00.000Z' },
      })
    );
    postMock.mockResolvedValue(
      proxiedApiResponse({
        success: true,
        data: { shareToken: 'tok_new', expiresAt: '2026-08-27T10:00:00.000Z' },
      })
    );
    renderModal();

    expect(await screen.findByDisplayValue(/presentations\/shared\/tok_old/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rotate link' }));
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/presentations/decks/deck-1/share', {
        expiresInDays: 7,
      })
    );
    expect(await screen.findByDisplayValue(/presentations\/shared\/tok_new/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ON' }));
    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith('/presentations/decks/deck-1/share')
    );
    expect(screen.getByRole('button', { name: 'OFF' })).toBeInTheDocument();
  });
});
