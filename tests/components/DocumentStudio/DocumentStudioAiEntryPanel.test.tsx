/**
 * FAZA B1 (2026-07-27) — `DocumentStudioAiEntryPanel` unit tests.
 *
 * Pins the contract this component exists for (N11/N12 —
 * Harvard/wdrozenie-100/_NAGRANIE_PIOTRA_WIZJA_MATERIALY_2026-07-27.md):
 *   - no intake-form fields anywhere in this component (Type/Density/Goal/
 *     Audience are gone from the SCREEN, not from the system — the parent
 *     builds them, see DocumentStudioView.zaiTeresa.test.tsx);
 *   - the chat panel's `onModuleIntent` is the trigger: the FIRST message
 *     long enough (>=10 chars, same floor as the old form's description
 *     field) fires `onFirstMessage` exactly once and reports `handled: true`
 *     so Teresa's own reply pipeline doesn't also answer it;
 *   - a too-short message does NOT fire generation (falls through to normal
 *     chat instead of hard-blocking like the old required/minLength input).
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

let capturedChatProps: any = null;

vi.mock('@/components/AIChat/UnifiedChatPanel', () => ({
  UnifiedChatPanel: (props: any) => {
    capturedChatProps = props;
    return <div data-testid="mock-unified-chat" />;
  },
}));

import { DocumentStudioAiEntryPanel } from '@/components/DocumentStudio/DocumentStudioAiEntryPanel';

describe('DocumentStudioAiEntryPanel', () => {
  it('renders no intake-form fields (Description/Type/Density/Goal/Audience) — only the document placeholder + chat', () => {
    const onFirstMessage = vi.fn();
    render(<DocumentStudioAiEntryPanel onFirstMessage={onFirstMessage} />);

    expect(screen.getByTestId('document-studio-ai-entry-panel')).toBeInTheDocument();
    expect(screen.getByTestId('mock-unified-chat')).toBeInTheDocument();
    // Canary: none of the old form's field labels/roles are present.
    expect(screen.queryByText(/document type/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/density/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^goal$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/audience/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('fires onFirstMessage exactly once for the first long-enough chat message, and reports handled:true', () => {
    const onFirstMessage = vi.fn();
    render(<DocumentStudioAiEntryPanel onFirstMessage={onFirstMessage} />);

    expect(capturedChatProps?.onModuleIntent).toBeInstanceOf(Function);

    const result = capturedChatProps.onModuleIntent(
      'Przygotuj raport dla zarządu z wynikami audytu Q3.'
    );
    expect(result).toEqual(
      expect.objectContaining({ handled: true, reply: expect.any(String) })
    );
    expect(onFirstMessage).toHaveBeenCalledTimes(1);
    expect(onFirstMessage).toHaveBeenCalledWith(
      'Przygotuj raport dla zarządu z wynikami audytu Q3.'
    );

    // A second message must NOT re-trigger generation.
    const second = capturedChatProps.onModuleIntent('Jeszcze jedna wiadomość, też długa.');
    expect(second).toBe(false);
    expect(onFirstMessage).toHaveBeenCalledTimes(1);
  });

  it('does not fire onFirstMessage for a too-short message (falls through to normal chat)', () => {
    const onFirstMessage = vi.fn();
    render(<DocumentStudioAiEntryPanel onFirstMessage={onFirstMessage} />);

    const result = capturedChatProps.onModuleIntent('cześć');
    expect(result).toBe(false);
    expect(onFirstMessage).not.toHaveBeenCalled();
  });

  it('shows the "back to modes" link only when onBackToModes is provided', () => {
    const { rerender } = render(<DocumentStudioAiEntryPanel onFirstMessage={vi.fn()} />);
    expect(screen.queryByText(/wybór trybu/i)).not.toBeInTheDocument();

    rerender(
      <DocumentStudioAiEntryPanel onFirstMessage={vi.fn()} onBackToModes={vi.fn()} />
    );
    expect(screen.getByText(/wybór trybu/i)).toBeInTheDocument();
  });

  it('surfaces a passed-in error banner', () => {
    render(
      <DocumentStudioAiEntryPanel onFirstMessage={vi.fn()} error="Coś poszło nie tak." />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Coś poszło nie tak.');
  });
});
