/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EasySyncSetupShellPanel } from '../../../src/components/shared/EasySyncSetupShellPanel';

describe('EasySyncSetupShellPanel', () => {
  it('renders the canonical sync setup path and closure rules', () => {
    render(<EasySyncSetupShellPanel compact />);

    expect(screen.getByText('One canonical provider connect journey')).toBeInTheDocument();
    expect(screen.getByText('Choose provider')).toBeInTheDocument();
    expect(screen.getByText('Monitor and recover')).toBeInTheDocument();
    expect(screen.getByText('Setup closure rules')).toBeInTheDocument();
  });
});
