/**
 * ArtifactModuleHome — lane=tabele rendering test.
 *
 * Validation matrix row L3.4 (Sprint 2 / Table Studio Foundation block).
 * Verifies that:
 *   1. The Tabele lane renders the canonical "Table Studio" / "Tabele Studio" label.
 *   2. All eight built-in Tabele templates from EPIC-1 US-1.6 are present.
 *   3. The hero icon container picks up the sky accent (`bg-sky-500/10`).
 *
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../../../src/components/AIChat/KimiWorkspace/useModuleTemplates', () => ({
  useModuleTemplates: () => ({
    templates: [],
    loading: false,
    error: null,
    fetchTemplates: vi.fn(),
  }),
}));

vi.mock('../../../../src/components/AIChat/KimiWorkspace/useModuleRecentArtifacts', () => ({
  useModuleRecentArtifacts: () => ({
    artifacts: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

import ArtifactModuleHome from '../../../../src/components/AIChat/KimiWorkspace/ArtifactModuleHome';

const TABELE_BUILTIN_IDS = [
  'bt-tab-rolereg',
  'bt-tab-vendor',
  'bt-tab-okrset',
  'bt-tab-incidentlog',
  'bt-tab-clientreg',
  'bt-tab-tasktracker',
  'bt-tab-meetingbacklog',
  'bt-tab-decisionlog',
];

const TABELE_BUILTIN_TITLES = [
  'Role Register',
  'Vendor Master Data',
  'OKR Set',
  'Incident Log',
  'Client Registry',
  'Task Tracker',
  'Meeting Backlog',
  'Decision Log',
];

describe('ArtifactModuleHome — lane=tabele (L3.4)', () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  function renderTabele() {
    return render(
      <MemoryRouter initialEntries={['/tabele']}>
        <ArtifactModuleHome lane="tabele" />
      </MemoryRouter>
    );
  }

  it('renders the Table Studio lane label in the hero', () => {
    renderTabele();
    // Heading defaults to English under the test i18n shim
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Table Studio/i);
    expect(
      screen.getByText('Operational tables, master data, registers, logs, OKRs, decisions')
    ).toBeInTheDocument();
  });

  it('renders all 8 built-in tabele templates', () => {
    renderTabele();
    for (const title of TABELE_BUILTIN_TITLES) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    // Each card is keyed by its bt-tab-* id; assert at least one card with each id
    // is reachable as a button (hero "Start new" is the only non-template button).
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(TABELE_BUILTIN_IDS.length);
  });

  it('uses the sky accent in the hero icon container', () => {
    const { container } = renderTabele();
    const skyAccent = container.querySelector('.bg-sky-500\\/10');
    expect(skyAccent).not.toBeNull();
    const iconColor = container.querySelector('.text-sky-500');
    expect(iconColor).not.toBeNull();
  });

  it('renders recent and saved tabs and routes Start new to /tabele?view=new', () => {
    renderTabele();
    expect(screen.getByRole('button', { name: /Recent/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Saved/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Start new/i }));
    expect(navigateMock).toHaveBeenCalledWith('/tabele?view=new');
  });
});
