/**
 * CriterionWorkspaceGate — flag switch between V1 (`CriterionWorkspace`) and
 * V2 (`v2/CriterionWorkspaceV2`), DEC-88. Mocks BOTH shells to a trivial
 * marker (this is a routing/gate test, not a re-test of either shell's own
 * behaviour — that lives in `CriterionWorkspace.test.tsx` /
 * `v2/__tests__/CriterionWorkspaceV2.test.tsx`) and mocks the flag reader so
 * the test controls ON/OFF directly instead of poking query/localStorage.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../CriterionWorkspace', () => ({
  CriterionWorkspace: () => <div data-testid="v1-marker">V1</div>,
}));
vi.mock('../v2/CriterionWorkspaceV2', () => ({
  CriterionWorkspaceV2: () => <div data-testid="v2-marker">V2</div>,
}));

const mockIsEnabled = vi.fn(() => false);
vi.mock('@/utils/criterionWorkspaceV2Flag', () => ({
  isCriterionWorkspaceV2Enabled: () => mockIsEnabled(),
}));

import { CriterionWorkspaceGate } from '../CriterionWorkspaceGate';

describe('CriterionWorkspaceGate', () => {
  afterEach(() => {
    mockIsEnabled.mockReset();
    mockIsEnabled.mockReturnValue(false);
  });

  it('renders V1 unchanged when the flag is OFF (default)', () => {
    mockIsEnabled.mockReturnValue(false);
    render(<CriterionWorkspaceGate />);
    expect(screen.getByTestId('v1-marker')).toBeInTheDocument();
    expect(screen.queryByTestId('v2-marker')).not.toBeInTheDocument();
  });

  it('renders V2 when ff_criterionWorkspaceV2 resolves ON', () => {
    mockIsEnabled.mockReturnValue(true);
    render(<CriterionWorkspaceGate />);
    expect(screen.getByTestId('v2-marker')).toBeInTheDocument();
    expect(screen.queryByTestId('v1-marker')).not.toBeInTheDocument();
  });
});
