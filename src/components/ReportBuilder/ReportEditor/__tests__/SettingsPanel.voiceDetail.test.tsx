/**
 * RB-1 (Wpis 76 / przepis Wpis 44): brakujące pokrętła silnika dostają żywą
 * kontrolkę w SettingsPanel (zakładka „intent", karta „Voice & Detail").
 * Przed naprawą jedyną kontrolkę miał martwy IntentStep.tsx (zero importów),
 * więc verbosity/writingStyle/illustrationLevel/customTone nie dało się ustawić
 * z produktu. Ten test renderuje PRAWDZIWY SettingsPanel i dowodzi, że:
 *  1. karta jest zwinięta (defaultOpen=false) i otwiera się po kliknięciu,
 *  2. po otwarciu renderują się wszystkie cztery kontrolki z etykietami EN,
 *  3. zmiana selecta/inputa woła onIntentChange z właściwym payloadem
 *     (shape zgodny z config.intent, który czyta buildStyleGuidance).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReportIntent, ReportStyling } from '../ReportEditor';
import { SettingsPanel } from '../SettingsPanel';

const baseIntent: ReportIntent = {
  audience: 'executive',
  goal: 'diagnosis',
  language: 'en',
  tone: 'consulting',
  scope: 'full',
};

const baseStyling: ReportStyling = {
  theme: 'professional',
  primaryColor: '#85182F',
  accentColor: '#85182F',
} as ReportStyling;

const renderPanel = (onIntentChange: (u: Partial<ReportIntent>) => void) =>
  render(
    <SettingsPanel
      intent={baseIntent}
      styling={baseStyling}
      sourceType={null}
      sourceName={null}
      onIntentChange={onIntentChange}
      onStylingChange={vi.fn()}
      activeSection="intent"
      onSectionChange={vi.fn()}
    />
  );

type IntentChangeSpy = ReturnType<typeof makeIntentChangeSpy>;
const makeIntentChangeSpy = () => vi.fn<(updates: Partial<ReportIntent>) => void>();

// Etykiety w tej karcie to <label> bez htmlFor (konwencja pliku), więc kontrolkę
// znajdujemy przez wspólny kontener <div> etykiety.
const controlFor = (labelText: string): HTMLElement => {
  const label = screen.getByText(labelText);
  const control = label.parentElement?.querySelector('select, input');
  if (!control) throw new Error(`No control next to label "${labelText}"`);
  return control as HTMLElement;
};

describe('RB-1 — SettingsPanel „Voice & Detail" eksponuje pokrętła silnika', () => {
  let onIntentChange: IntentChangeSpy;

  beforeEach(() => {
    onIntentChange = makeIntentChangeSpy();
  });

  it('karta jest domyślnie zwinięta, a pokrętła pojawiają się po otwarciu', () => {
    renderPanel(onIntentChange);
    // Karta zwinięta — kontrolki jeszcze nieobecne.
    expect(screen.queryByText('Verbosity')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Voice & Detail/i }));

    expect(screen.getByText('Verbosity')).toBeInTheDocument();
    expect(screen.getByText('Writing style')).toBeInTheDocument();
    expect(screen.getByText('Examples')).toBeInTheDocument();
    expect(screen.getByText('Custom tone (optional)')).toBeInTheDocument();
    expect(controlFor('Verbosity').tagName).toBe('SELECT');
    expect(controlFor('Custom tone (optional)').tagName).toBe('INPUT');
  });

  it('zmiana pokręteł woła onIntentChange z payloadem config.intent', () => {
    renderPanel(onIntentChange);
    fireEvent.click(screen.getByRole('button', { name: /Voice & Detail/i }));

    fireEvent.change(controlFor('Verbosity'), { target: { value: 'detailed' } });
    expect(onIntentChange).toHaveBeenCalledWith({ verbosity: 'detailed' });

    fireEvent.change(controlFor('Writing style'), { target: { value: 'persuasive' } });
    expect(onIntentChange).toHaveBeenCalledWith({ writingStyle: 'persuasive' });

    fireEvent.change(controlFor('Examples'), { target: { value: 'extensive' } });
    expect(onIntentChange).toHaveBeenCalledWith({ illustrationLevel: 'extensive' });

    fireEvent.change(controlFor('Custom tone (optional)'), {
      target: { value: 'direct and data-driven' },
    });
    expect(onIntentChange).toHaveBeenCalledWith({ customTone: 'direct and data-driven' });
  });
});
