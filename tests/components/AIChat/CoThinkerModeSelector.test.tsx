import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setAIConfigMock = vi.fn();
let aiConfigState: any = { coThinkerMode: null };

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    aiConfig: aiConfigState,
    setAIConfig: setAIConfigMock,
  }),
}));

import { CoThinkerModeBadge, CoThinkerModeSelector } from '../../../src/components/AIChat/CoThinkerModeSelector';

describe('CoThinkerModeSelector (L2)', () => {
  beforeEach(() => {
    setAIConfigMock.mockReset();
    aiConfigState = { coThinkerMode: null };
  });

  it('renders all mode buttons (with fallback labels)', () => {
    render(<CoThinkerModeSelector />);

    expect(screen.getByRole('button', { name: /multi consultant/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /idea maker/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /competitive analyst/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /risk challenger/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /executive editor/i })).toBeInTheDocument();
  });

  it('selects a mode; clicking again toggles it off', () => {
    const { rerender } = render(<CoThinkerModeSelector />);

    fireEvent.click(screen.getByRole('button', { name: /idea maker/i }));
    expect(setAIConfigMock).toHaveBeenCalledWith({ coThinkerMode: 'idea_maker' });

    aiConfigState = { coThinkerMode: 'idea_maker' };
    rerender(<CoThinkerModeSelector />);

    fireEvent.click(screen.getByRole('button', { name: /idea maker/i }));
    expect(setAIConfigMock).toHaveBeenCalledWith({ coThinkerMode: null });
  });

  it('shows clear UI when active and clears on click', () => {
    aiConfigState = { coThinkerMode: 'risk_challenger' };
    render(<CoThinkerModeSelector />);

    expect(screen.getByText(/active mode/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(setAIConfigMock).toHaveBeenCalledWith({ coThinkerMode: null });
  });

  it('badge renders for known mode and hides for null/unknown', () => {
    const { rerender } = render(<CoThinkerModeBadge mode={null} />);
    expect(screen.queryByText(/idea maker/i)).not.toBeInTheDocument();

    rerender(<CoThinkerModeBadge mode="unknown" />);
    expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument();

    rerender(<CoThinkerModeBadge mode="idea_maker" />);
    expect(screen.getByText(/idea maker/i)).toBeInTheDocument();
  });
});

