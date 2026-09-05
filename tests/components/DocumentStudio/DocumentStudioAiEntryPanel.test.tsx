/**
 * FAZA B1 (2026-07-27) — `DocumentStudioAiEntryPanel` unit tests.
 *
 * ★ PRZYWRÓCONE 2026-09-05 — wyjątek właściciela od „JEDNA TERESA, W SWOIM
 * OKNIE" (patrz nagłówek komponentu). Odbiór na żywo `document-studio-ai-teresa`
 * pokazał, że 01.09 zdjęło tu osadzony czat na rzecz pola briefu + przycisku
 * do globalnego okna; właściciel wprost odrzucił to dla TEGO ekranu: „tutaj
 * praca się dzieje z Teresą; tu nie ma po co dodawać kolejnego okna." Ten
 * plik wraca do kontraktu sprzed 01.09 (czat = `UnifiedChatPanel.onModuleIntent`),
 * zamiast pinować pole briefu jako kanarka regresji.
 *
 * Kontrakt N11/N12 (Harvard/wdrozenie-100/_NAGRANIE_PIOTRA_WIZJA_MATERIALY_2026-07-27.md):
 *   - ZERO pól starego formularza intake (Type/Density/Goal/Audience) —
 *     nie zniknęły z systemu, tylko z EKRANU (buduje je rodzic, patrz
 *     DocumentStudioView.zaiTeresa.test.tsx);
 *   - czat (`UnifiedChatPanel.onModuleIntent`) jest wejściem: PIERWSZA
 *     wystarczająco długa wiadomość (>=10 znaków, ten sam próg co dawne pole
 *     opisu) odpala `onFirstMessage` dokładnie raz i zwraca `handled: true`,
 *     żeby normalny pipeline odpowiedzi Teresy nie odpowiedział też na nią;
 *   - za krótka wiadomość NIE odpala generacji (przechodzi do normalnego
 *     czatu zamiast twardo blokować jak stare wymagane/minLength pole).
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
  it('renders no intake-form fields (Description/Type/Density/Goal/Audience) — only the document placeholder + embedded Teresa chat', () => {
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

  it('passes split-mode/minimal-chrome props to the embedded chat (owner exception, not the global window)', () => {
    render(<DocumentStudioAiEntryPanel onFirstMessage={vi.fn()} />);

    expect(capturedChatProps).toEqual(
      expect.objectContaining({
        mode: 'split',
        showModeToggle: false,
        showHistoryTrigger: false,
        showFocusMode: false,
      })
    );
  });

  it('fires onFirstMessage exactly once for the first long-enough chat message, and reports handled:true', () => {
    const onFirstMessage = vi.fn();
    render(<DocumentStudioAiEntryPanel onFirstMessage={onFirstMessage} />);

    expect(capturedChatProps?.onModuleIntent).toBeInstanceOf(Function);

    const result = capturedChatProps.onModuleIntent(
      'Przygotuj raport dla zarządu z wynikami audytu Q3.'
    );
    expect(result).toEqual(expect.objectContaining({ handled: true, reply: expect.any(String) }));
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

  it('disables the chat while a generation is busy', () => {
    const { rerender } = render(
      <DocumentStudioAiEntryPanel onFirstMessage={vi.fn()} busy={false} />
    );
    expect(capturedChatProps?.disabled).toBe(false);

    rerender(<DocumentStudioAiEntryPanel onFirstMessage={vi.fn()} busy />);
    expect(capturedChatProps?.disabled).toBe(true);
  });

  it('shows the "back to modes" link only when onBackToModes is provided', () => {
    const { rerender } = render(<DocumentStudioAiEntryPanel onFirstMessage={vi.fn()} />);
    expect(screen.queryByText(/wybór trybu/i)).not.toBeInTheDocument();

    rerender(<DocumentStudioAiEntryPanel onFirstMessage={vi.fn()} onBackToModes={vi.fn()} />);
    expect(screen.getByText(/wybór trybu/i)).toBeInTheDocument();
  });

  it('surfaces a passed-in error banner', () => {
    render(<DocumentStudioAiEntryPanel onFirstMessage={vi.fn()} error="Coś poszło nie tak." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Coś poszło nie tak.');
  });
});
