/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ArtifactRightPanel } from '../ArtifactRightPanel';

const actions = {
  id: 'actions',
  label: 'Akcje',
  defaultOpen: true,
  children: <button type="button">Zwykła akcja</button>,
};

describe('ArtifactRightPanel Teresa entry', () => {
  it('puts Teresa first in Actions', () => {
    render(<ArtifactRightPanel sections={[actions]} teresaEntry={{ label: 'Zapytaj Teresę o obiekt', onOpen: vi.fn() }} />);
    const section = document.querySelector('[data-artifact-section="actions"]');
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getAllByRole('button')[1]).toHaveAttribute('data-testid', 'teresa-entry');
    expect(within(section as HTMLElement).getAllByRole('button')[2]).toHaveTextContent('Zwykła akcja');
  });

  it('leaves Actions unchanged without the prop', () => {
    render(<ArtifactRightPanel sections={[actions]} />);
    expect(screen.queryByTestId('teresa-entry')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zwykła akcja' })).toBeInTheDocument();
  });
});
