import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
  }),
}));

import { TableRealtimeStatusIndicator } from '@/components/MyWork/table/PresenceIndicators';

describe('TableRealtimeStatusIndicator', () => {
  it('renders a connecting state while realtime is joining', () => {
    render(<TableRealtimeStatusIndicator connectionState="connecting" enabled={true} />);

    expect(screen.getByText('Realtime connecting')).toBeInTheDocument();
    expect(screen.queryByText('Single-user mode')).not.toBeInTheDocument();
  });

  it('renders a degraded single-user state after disconnect', () => {
    render(<TableRealtimeStatusIndicator connectionState="degraded" enabled={true} />);

    expect(screen.getByText('Realtime degraded')).toBeInTheDocument();
    expect(screen.getByText('Single-user mode')).toBeInTheDocument();
  });

  it('renders a reconnecting recovery state while realtime is returning', () => {
    render(<TableRealtimeStatusIndicator connectionState="reconnecting" enabled={true} />);

    expect(screen.getByText('Realtime reconnecting')).toBeInTheDocument();
    expect(screen.getByText('Recovery in progress')).toBeInTheDocument();
  });

  it('stays hidden while idle or fully connected', () => {
    const idle = render(<TableRealtimeStatusIndicator connectionState="idle" enabled={true} />);
    expect(idle.container).toBeEmptyDOMElement();
    idle.unmount();

    const connected = render(
      <TableRealtimeStatusIndicator connectionState="connected" enabled={true} />
    );
    expect(connected.container).toBeEmptyDOMElement();
  });
});
