/**
 * @vitest-environment jsdom
 *
 * Voice is a third, equal input channel. When the browser has no speech
 * support (true for jsdom — no `navigator.mediaDevices`), the control must
 * show an explicit, controlled degradation message instead of silently
 * disappearing.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { VoiceAnswerChannel } from '../VoiceAnswerChannel';

describe('VoiceAnswerChannel', () => {
  it('shows an explicit degradation message when speech APIs are unsupported', () => {
    render(<VoiceAnswerChannel onTranscript={vi.fn()} />);
    const degraded = screen.getByTestId('voice-channel-degraded');
    expect(degraded).toBeInTheDocument();
    expect(degraded).toHaveTextContent('Mowa niedostępna w tej przeglądarce');
    // The control is not silently gone — the toggle button is absent, replaced
    // by an explanatory status, never an empty gap.
    expect(screen.queryByTestId('voice-channel-toggle')).not.toBeInTheDocument();
  });
});
