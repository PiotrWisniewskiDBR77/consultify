import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setAIConfigMock = vi.fn();
let aiConfigState: any = {};

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    aiConfig: aiConfigState,
    setAIConfig: setAIConfigMock,
  }),
}));

import { CoThinkerActivePill, CoThinkerMenu } from '../../../src/components/AIChat/CoThinkerMenu';

describe('CoThinkerMenu (L2)', () => {
  beforeEach(() => {
    setAIConfigMock.mockReset();
    aiConfigState = {
      coThinkerMode: null,
      marketResearch: false,
      webSearch: false,
    };
  });

  it('selects a persona and maps it to coThinkerMode', () => {
    render(<CoThinkerMenu />);

    fireEvent.click(screen.getByTestId('chat-cothinker-button'));
    fireEvent.click(screen.getByRole('menuitem', { name: /idea creator/i }));

    expect(setAIConfigMock).toHaveBeenCalledWith({
      coThinkerMode: 'idea_maker',
      marketResearch: false,
    });
  });

  it('selects Market Researcher and enables marketResearch + webSearch', () => {
    render(<CoThinkerMenu />);

    fireEvent.click(screen.getByTestId('chat-cothinker-button'));
    fireEvent.click(screen.getByRole('menuitem', { name: /market researcher/i }));

    expect(setAIConfigMock).toHaveBeenCalledWith({
      coThinkerMode: null,
      marketResearch: true,
      webSearch: true,
    });
  });

  it('clicking an active persona toggles it off', () => {
    aiConfigState = { coThinkerMode: 'idea_maker', marketResearch: false, webSearch: true };
    render(<CoThinkerMenu />);

    fireEvent.click(screen.getByTestId('chat-cothinker-button'));
    fireEvent.click(screen.getByRole('menuitem', { name: /idea creator/i }));

    expect(setAIConfigMock).toHaveBeenCalledWith({ coThinkerMode: null, marketResearch: false });
  });

  it('renders active pill for coThinkerMode and for marketResearch', () => {
    const { rerender } = render(<CoThinkerActivePill />);
    expect(screen.queryByTestId('cothinker-active-pill')).not.toBeInTheDocument();

    aiConfigState = { coThinkerMode: 'risk_challenger', marketResearch: false };
    rerender(<CoThinkerActivePill />);
    expect(screen.getByTestId('cothinker-active-pill')).toBeInTheDocument();
    expect(screen.getByText(/auditor/i)).toBeInTheDocument();

    aiConfigState = { coThinkerMode: null, marketResearch: true };
    rerender(<CoThinkerActivePill />);
    expect(screen.getByText(/market researcher/i)).toBeInTheDocument();
  });

  it('shows active persona name next to the icon on the button', () => {
    aiConfigState = { coThinkerMode: 'competitive_analyst', marketResearch: false };
    render(<CoThinkerMenu />);

    expect(screen.getByTestId('chat-cothinker-active-label')).toBeInTheDocument();
    expect(screen.getByText(/analyst/i)).toBeInTheDocument();
  });

  it('renders persona descriptions in menu rows', () => {
    render(<CoThinkerMenu />);
    fireEvent.click(screen.getByTestId('chat-cothinker-button'));

    expect(screen.getByText(/broad strategy framing/i)).toBeInTheDocument();
    expect(screen.getByText(/web-backed market signals/i)).toBeInTheDocument();
  });
});

