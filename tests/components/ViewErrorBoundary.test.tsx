/**
 * @vitest-environment jsdom
 */
import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ViewErrorBoundary } from '../../src/components/MyWork/table/ViewErrorBoundary';

const Thrower = ({ message }: { message: string }) => {
  throw new Error(message);
};

describe('ViewErrorBoundary', () => {
  it('hides runtime error details and exposes one alert', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ViewErrorBoundary viewName="Kanban" onSwitchToGrid={() => {}}>
        <Thrower message="INTERNAL_SECRET_XYZ" />
      </ViewErrorBoundary>
    );

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent('Runtime details are hidden for safety');
    expect(screen.queryByText('INTERNAL_SECRET_XYZ')).not.toBeInTheDocument();
  });

  it('retries and renders children after failure clears', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();

    const Harness = () => {
      const [shouldThrow, setShouldThrow] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setShouldThrow(false)}>
            heal
          </button>
          <ViewErrorBoundary viewName="Table" onSwitchToGrid={() => {}}>
            {shouldThrow ? <Thrower message="temporary failure" /> : <div>Recovered view</div>}
          </ViewErrorBoundary>
        </>
      );
    };

    render(<Harness />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'heal' }));
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByText('Recovered view')).toBeInTheDocument();
  });
});
