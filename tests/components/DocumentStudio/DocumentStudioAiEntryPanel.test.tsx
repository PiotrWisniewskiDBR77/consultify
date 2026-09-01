/**
 * FAZA B1 (2026-07-27) — `DocumentStudioAiEntryPanel` unit tests.
 *
 * ★ PRZEPISANE 2026-09-01 — „JEDNA TERESA, W SWOIM OKNIE".
 * Kontrakt N11/N12 zmienił się w JEDNYM miejscu: brief nie jest już pierwszą
 * wiadomością osadzonego czatu (`UnifiedChatPanel.onModuleIntent`), tylko
 * jawnym polem + przyciskiem. Reszta kontraktu stoi bez zmian:
 *   - ZERO pól starego formularza intake (Type/Density/Goal/Audience) —
 *     nie zniknęły z systemu, tylko z EKRANU (buduje je rodzic, patrz
 *     DocumentStudioView.zaiTeresa.test.tsx);
 *   - próg 10 znaków ten sam co dawne `description.trim().length >= 10`;
 *   - `onFirstMessage` odpala się DOKŁADNIE RAZ;
 *   - za krótki brief NIE odpala generacji i mówi DLACZEGO (zamiast milczącego
 *     wyłączonego przycisku);
 *   - w panelu NIE MA osadzonego czatu, jest wejście do jednego okna Teresy
 *     (`data-testid="teresa-entry"`).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const openChatWithContext = vi.fn();
vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => openChatWithContext,
  default: () => openChatWithContext,
}));

import { DocumentStudioAiEntryPanel } from '@/components/DocumentStudio/DocumentStudioAiEntryPanel';

const BRIEF = 'Przygotuj raport dla zarządu z wynikami audytu Q3.';

const typeBrief = (value: string) => {
  fireEvent.change(screen.getByTestId('docstudio-ai-entry-brief'), { target: { value } });
};

describe('DocumentStudioAiEntryPanel', () => {
  it('nie renderuje osadzonego czatu — jest pole briefu i wejście do jednego okna Teresy', () => {
    render(<DocumentStudioAiEntryPanel onFirstMessage={vi.fn()} />);

    expect(screen.getByTestId('document-studio-ai-entry-panel')).toBeInTheDocument();
    expect(screen.getByTestId('docstudio-ai-entry-brief')).toBeInTheDocument();
    expect(screen.getByTestId('teresa-entry')).toBeInTheDocument();
    // Kanarek regresji: gdyby ktoś wstawił czat z powrotem, pole pisania
    // czatu przyszłoby razem z nim — a tu ma być DOKŁADNIE jeden textbox.
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    // Kanarek starego formularza intake.
    expect(screen.queryByText(/document type/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/density/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^goal$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/audience/i)).not.toBeInTheDocument();
  });

  it('odpala onFirstMessage dokładnie raz — drugie kliknięcie nie generuje ponownie', () => {
    const onFirstMessage = vi.fn();
    render(<DocumentStudioAiEntryPanel onFirstMessage={onFirstMessage} />);

    typeBrief(BRIEF);
    const submit = screen.getByTestId('docstudio-ai-entry-submit');
    fireEvent.click(submit);
    expect(onFirstMessage).toHaveBeenCalledTimes(1);
    expect(onFirstMessage).toHaveBeenCalledWith(BRIEF);

    fireEvent.click(submit);
    expect(onFirstMessage).toHaveBeenCalledTimes(1);
  });

  it('za krótki brief nie generuje i mówi dlaczego', () => {
    const onFirstMessage = vi.fn();
    render(<DocumentStudioAiEntryPanel onFirstMessage={onFirstMessage} />);

    typeBrief('cześć');
    expect(screen.getByTestId('docstudio-ai-entry-submit')).toBeDisabled();
    expect(screen.getByText(/przynajmniej jedno zdanie/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('docstudio-ai-entry-submit'));
    expect(onFirstMessage).not.toHaveBeenCalled();
  });

  it('wejście do Teresy otwiera JEDNO okno z kontekstem dokumentu, nie drugi czat', () => {
    render(<DocumentStudioAiEntryPanel onFirstMessage={vi.fn()} />);
    openChatWithContext.mockClear();

    typeBrief(BRIEF);
    fireEvent.click(screen.getByTestId('teresa-entry'));

    expect(openChatWithContext).toHaveBeenCalledTimes(1);
    expect(openChatWithContext).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'document',
        contextData: expect.objectContaining({ stage: 'intake', brief: BRIEF }),
      })
    );
  });

  it('pokazuje link „wybór trybu" tylko gdy podano onBackToModes', () => {
    const { rerender } = render(<DocumentStudioAiEntryPanel onFirstMessage={vi.fn()} />);
    expect(screen.queryByText(/wybór trybu/i)).not.toBeInTheDocument();

    rerender(<DocumentStudioAiEntryPanel onFirstMessage={vi.fn()} onBackToModes={vi.fn()} />);
    expect(screen.getByText(/wybór trybu/i)).toBeInTheDocument();
  });

  it('pokazuje przekazany błąd generacji', () => {
    render(<DocumentStudioAiEntryPanel onFirstMessage={vi.fn()} error="Coś poszło nie tak." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Coś poszło nie tak.');
  });
});
