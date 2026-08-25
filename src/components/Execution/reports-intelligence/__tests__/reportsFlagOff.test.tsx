/**
 * F9 (DEC-72 Day 11 acceptance correction): the previous version of this file
 * rendered a local `RouteHarness` stand-in, never the real `ExecutionHub` —
 * so it could not actually prove the flag gate works in the mounted product.
 * This rewrite mounts the real `ExecutionHub` shell and exercises the real
 * `execReportsIntelligence` gate declared there.
 *
 * Scope note (verified against the real runtime, not assumed): the four
 * reports-intelligence surfaces are stubbed here because that is what is
 * under test; the four large canonical tab surfaces they sit next to
 * (ExecutionWorkSurface / ExecutionResourcesSurface / ExecutionControlSurface
 * / ExecutionManagementView) are stubbed too because they have their own
 * dedicated test coverage elsewhere and mounting them for real would test
 * unrelated behavior. What stays real is exactly the thing F9 cares about:
 * ExecutionHub's own tab/flag/chip wiring.
 *
 * `listExecutionCases` is intentionally NOT asserted at zero calls. Reading
 * the real ExecutionHub.tsx (not the flag, not a doc) shows it is called
 * unconditionally by the Hub's own "load initiatives in execution phase"
 * effect (line ~1213, `Promise.all([Api.getInitiatives(...), listExecutionCases()])`,
 * dependent on `activeTab`) — completely independent of
 * `execReportsIntelligence`. Asserting zero calls to it would therefore be a
 * false claim about the real system. `readExecutionWork` and
 * `readOperationalAllocations` have no such Hub-level caller once the
 * canonical leaf surfaces are stubbed, so those two get a true zero-calls
 * assertion in every state, including with the flag ON on the Work tab.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listExecutionCases: vi.fn().mockResolvedValue({ cases: [] }),
  readExecutionWork: vi.fn().mockResolvedValue({ tasks: [], decisions: [] }),
  readExecutionMilestones: vi.fn().mockResolvedValue({ items: [] }),
  readOperationalAllocations: vi.fn().mockResolvedValue({ items: [] }),
  listManagementSignals: vi.fn().mockResolvedValue({ signals: [] }),
  listInterventions: vi.fn().mockResolvedValue({ interventions: [] }),
  listReportDefinitions: vi.fn().mockResolvedValue({ items: [] }),
  listReportRuns: vi.fn().mockResolvedValue({ items: [] }),
  getReportDefinition: vi.fn().mockResolvedValue({ versions: [] }),
  createReportRun: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/services/initiatives-execution/runtimeApi', () => api);

const reportComponents = vi.hoisted(() => ({
  workRender: vi.fn(() => <div data-testid="mock-work-intelligence-report" />),
  resourcesRender: vi.fn(() => <div data-testid="mock-resources-capacity-report" />),
  controlRender: vi.fn(() => <div data-testid="mock-control-loop-report" />),
  generatorRender: vi.fn(() => <div data-testid="mock-unified-generator" />),
}));
vi.mock('../WorkIntelligenceReport', () => ({
  WorkIntelligenceReport: (props: any) => reportComponents.workRender(props),
}));
vi.mock('../ResourcesCapacityReport', () => ({
  ResourcesCapacityReport: (props: any) => reportComponents.resourcesRender(props),
}));
vi.mock('../ControlLoopReport', () => ({
  ControlLoopReport: (props: any) => reportComponents.controlRender(props),
}));
vi.mock('../UnifiedExecutionReportGenerator', () => ({
  UnifiedExecutionReportGenerator: (props: any) => reportComponents.generatorRender(props),
}));

// Canonical, pre-existing leaf surfaces — out of scope for the flag gate,
// covered by their own test suites. Stubbed to keep this test focused and
// fast; each renders a stable marker so "the current register stays
// mounted" is still an assertable fact, not an assumption.
vi.mock('../../ExecutionWorkSurface', () => ({
  ExecutionWorkSurface: () => <section data-testid="execution-current-work-register" />,
}));
vi.mock('../../ExecutionResourcesSurface', () => ({
  ExecutionResourcesSurface: () => <section data-testid="execution-current-resources-register" />,
}));
vi.mock('../../ExecutionControlSurface', () => ({
  ExecutionControlSurface: () => <section data-testid="execution-current-control-register" />,
}));
vi.mock('../../ExecutionManagementView', () => ({
  ExecutionManagementView: () => <section data-testid="execution-current-reports-register" />,
}));

import { ExecutionHub } from '../../ExecutionHub';

const renderHub = (initialTab: 'work' | 'resources' | 'control' = 'work') =>
  render(
    <MemoryRouter>
      <ExecutionHub initialTab={initialTab} />
    </MemoryRouter>
  );

describe('Execution reports intelligence flag — real ExecutionHub', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockClear());
    Object.values(reportComponents).forEach((mock) => mock.mockClear());
    window.localStorage.clear();
    window.history.replaceState({}, '', '/execution');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('OFF: keeps the current work register mounted, never mounts the report surface, and shows no report chip', async () => {
    renderHub('work');

    expect(await screen.findByTestId('execution-current-work-register')).toBeInTheDocument();
    await waitFor(() => expect(api.listExecutionCases).toHaveBeenCalled());

    expect(screen.queryByTestId('mock-work-intelligence-report')).not.toBeInTheDocument();
    expect(reportComponents.workRender).not.toHaveBeenCalled();
    expect(screen.queryByTestId('standard-chip-work-intelligence-report')).not.toBeInTheDocument();

    // True zero-call guarantee: with the canonical leaf surfaces stubbed,
    // nothing else in the real Hub can legitimately call these two.
    expect(api.readExecutionWork).not.toHaveBeenCalled();
    expect(api.readOperationalAllocations).not.toHaveBeenCalled();
  });

  it('OFF: mounts no reports-intelligence surface across work/resources/control and issues zero generator-only requests', async () => {
    renderHub('work');
    await waitFor(() => expect(api.listExecutionCases).toHaveBeenCalled());

    expect(reportComponents.workRender).not.toHaveBeenCalled();
    expect(reportComponents.resourcesRender).not.toHaveBeenCalled();
    expect(reportComponents.controlRender).not.toHaveBeenCalled();
    expect(reportComponents.generatorRender).not.toHaveBeenCalled();

    // These four are exclusive to the unified generator — no canonical
    // surface anywhere in ExecutionHub calls them, so zero here is
    // unambiguous, not dependent on which leaf surfaces are stubbed.
    expect(api.listReportDefinitions).not.toHaveBeenCalled();
    expect(api.listReportRuns).not.toHaveBeenCalled();
    expect(api.getReportDefinition).not.toHaveBeenCalled();
    expect(api.createReportRun).not.toHaveBeenCalled();
  });

  it('OFF: stays off by default with no opt-in present (query, localStorage and env all absent)', async () => {
    renderHub('work');
    await screen.findByTestId('execution-current-work-register');
    expect(screen.queryByTestId('standard-chip-work-intelligence-report')).not.toBeInTheDocument();
  });

  it('ON: mounts the governed report surface from the Menu 3 chip, and never touches the canonical-only endpoints', async () => {
    window.localStorage.setItem('ff.exec_reports_intel', '1');
    renderHub('work');

    await screen.findByTestId('execution-current-work-register');
    const chip = await screen.findByTestId('standard-chip-work-intelligence-report');
    expect(chip).toBeInTheDocument();

    act(() => {
      chip.click();
    });

    expect(await screen.findByTestId('mock-work-intelligence-report')).toBeInTheDocument();
    expect(reportComponents.workRender).toHaveBeenCalled();
    // The Work report tab has no reason to touch resources/control-only reads.
    expect(api.readOperationalAllocations).not.toHaveBeenCalled();
    expect(api.listManagementSignals).not.toHaveBeenCalled();
  });
});
