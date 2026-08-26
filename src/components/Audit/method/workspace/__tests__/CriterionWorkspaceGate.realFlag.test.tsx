/**
 * CriterionWorkspaceGate — real-flag-module coverage (DEC-97: default ON).
 *
 * `CriterionWorkspaceGate.test.tsx` mocks `isCriterionWorkspaceV2Enabled`
 * directly, so it never exercises the actual default resolved by
 * `criterionWorkspaceV2Flag.ts`. This file uses the REAL flag module (only
 * the V1/V2 shells are mocked, same trivial markers as the sibling test) to
 * pin the DEC-97 contract end to end: with no override at all, the gate
 * renders V2; an explicit `off` still renders V1 UNCHANGED.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../CriterionWorkspace', () => ({
  CriterionWorkspace: () => <div data-testid="v1-marker">V1</div>,
}));
vi.mock('../v2/CriterionWorkspaceV2', () => ({
  CriterionWorkspaceV2: () => <div data-testid="v2-marker">V2</div>,
}));

import { CriterionWorkspaceGate } from '../CriterionWorkspaceGate';
import {
  CRITERION_WORKSPACE_V2_FLAG_KEYS,
  resetCriterionWorkspaceV2FlagCache,
} from '@/utils/criterionWorkspaceV2Flag';

const ORIGINAL_LOCATION = window.location;

function setLocationSearch(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...ORIGINAL_LOCATION, search },
  });
}

describe('CriterionWorkspaceGate — real flag module (DEC-97)', () => {
  beforeEach(() => {
    setLocationSearch('');
    window.localStorage.clear();
    resetCriterionWorkspaceV2FlagCache();
  });

  afterEach(() => {
    setLocationSearch('');
    window.localStorage.clear();
    resetCriterionWorkspaceV2FlagCache();
  });

  it('renders V2 with no override at all (real default is ON)', () => {
    render(<CriterionWorkspaceGate />);
    expect(screen.getByTestId('v2-marker')).toBeInTheDocument();
    expect(screen.queryByTestId('v1-marker')).not.toBeInTheDocument();
  });

  it('renders V1 UNCHANGED when explicitly disabled via localStorage "off"', () => {
    window.localStorage.setItem(CRITERION_WORKSPACE_V2_FLAG_KEYS.localStorage, 'off');
    resetCriterionWorkspaceV2FlagCache();
    render(<CriterionWorkspaceGate />);
    expect(screen.getByTestId('v1-marker')).toBeInTheDocument();
    expect(screen.queryByTestId('v2-marker')).not.toBeInTheDocument();
  });

  it('renders V1 UNCHANGED when explicitly disabled via query "?ff_criterionWorkspaceV2=off"', () => {
    setLocationSearch(`?${CRITERION_WORKSPACE_V2_FLAG_KEYS.query}=off`);
    resetCriterionWorkspaceV2FlagCache();
    render(<CriterionWorkspaceGate />);
    expect(screen.getByTestId('v1-marker')).toBeInTheDocument();
    expect(screen.queryByTestId('v2-marker')).not.toBeInTheDocument();
  });
});
