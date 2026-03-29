/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CommunicationSurfaceModelPanel } from '../../../src/components/shared/CommunicationSurfaceModelPanel';

describe('CommunicationSurfaceModelPanel', () => {
  it('renders the canonical communication flows and surface rules', () => {
    render(<CommunicationSurfaceModelPanel compact />);

    expect(screen.getByText('One governed communication family, not a chat clone')).toBeInTheDocument();
    expect(screen.getByText('Internal discussion -> work')).toBeInTheDocument();
    expect(screen.getByText('External delivery -> context')).toBeInTheDocument();
    expect(screen.getByText('Surface family rules')).toBeInTheDocument();
  });
});
