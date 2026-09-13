import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { RegisteredInitiativeReadModel } from '@/services/initiatives-execution/runtimeApi';

import { canonicalInitiativeSections } from '../canonicalInitiativeSections';
import { resolveInitiativeDocumentRecord } from '../initiativeDocumentSource';
import type { InitiativeContextValue } from '../sections/InitiativeContext';
import { InitiativeContext } from '../sections/InitiativeContext';
import { TimelineSection } from '../sections/TimelineSection';
import { getTimelineMode } from '../sections/types';

vi.mock('react-i18next', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-i18next')>();
  return {
    ...original,
    useTranslation: () => ({
      t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
    }),
  };
});

vi.mock('../sections/OperationalForecastEditor', () => ({
  OperationalForecastEditor: () => <div data-testid="operational-forecast-editor" />,
}));

vi.mock('../sections/TimelinePlanner', () => ({
  TimelinePlanner: () => <div data-testid="baseline-timeline-planner" />,
}));

vi.mock('../calendar', () => ({ InitiativeCalendar: () => null }));
vi.mock('../gantt', () => ({ InitiativeGantt: () => null }));

const nativeRegistration: RegisteredInitiativeReadModel = {
  version: 7,
  updatedAt: '2026-09-13T12:00:00.000Z',
  initiative: {
    initiativeId: 'native-scheduled-1',
    lifecycleState: 'SCHEDULED',
    title: 'Native scheduled Initiative',
    projectId: 'project-1',
    readiness: 'NOT_EVALUATED',
  },
};

function timelineContext(
  lifecycle: string,
  status: string,
  timelineLocked = false
): InitiativeContextValue {
  return {
    initiative: {
      id: 'native-scheduled-1',
      name: 'Native scheduled Initiative',
      lifecycle,
      documentOrigin: 'initiatives-runtime-v1',
    },
    initiativeId: 'native-scheduled-1',
    isPolish: false,
    status,
    startDate: '2026-10-01',
    setStartDate: vi.fn(),
    endDate: '2026-12-01',
    setEndDate: vi.fn(),
    targetDate: '2026-12-01',
    decisions: [],
    tasks: [],
    setTasks: vi.fn(),
    users: [],
    timelineMilestones: [],
    setTimelineMilestones: vi.fn(),
    timelinePhases: [],
    setTimelinePhases: vi.fn(),
    timelineLocked,
    baselineVersion: 3,
    estimatedDurationMonths: 2,
    raidItems: [],
    dependencies: [],
    timelineAiRequest: null,
    clearTimelineAiRequest: vi.fn(),
    fetchAll: vi.fn(async () => undefined),
  } as unknown as InitiativeContextValue;
}

function renderTimeline(lifecycle: string, status: string) {
  render(
    <InitiativeContext.Provider value={timelineContext(lifecycle, status)}>
      <TimelineSection sectionType={'timeline' as any} expanded onToggle={vi.fn()} />
    </InitiativeContext.Provider>
  );
}

describe('native canonical Initiative detail and Timeline reachability', () => {
  it('does not let the unified legacy-detail header shadow the richer runtime registration', async () => {
    const readRegisteredInitiative = vi.fn(async () => nativeRegistration);

    const record = await resolveInitiativeDocumentRecord('native-scheduled-1', {
      readPlanningInitiative: vi.fn(async () => {
        throw new Error('planning row absent');
      }),
      readLegacyInitiative: vi.fn(async () => ({
        id: 'native-scheduled-1',
        name: 'Native scheduled Initiative',
        status: 'SCHEDULED',
        lifecycleState: 'SCHEDULED',
        source: 'CANONICAL',
      })),
      readRegisteredInitiative,
      readInterviewInitiatives: vi.fn(async () => []),
    });

    expect(readRegisteredInitiative).toHaveBeenCalledWith('native-scheduled-1');
    expect(record).toMatchObject({
      id: 'native-scheduled-1',
      documentOrigin: 'initiatives-runtime-v1',
      canonicalVersion: 7,
      lifecycle: 'SCHEDULED',
    });
  });

  it('keeps the existing legacy status mapping while canonical lifecycle drives operational modes', () => {
    expect(getTimelineMode('EXECUTING')).toBe('CLOSED');
    expect(getTimelineMode('BLOCKED')).toBe('CLOSED');
    expect(getTimelineMode('APPROVED', 'SCHEDULED')).toBe('BASELINED');
    expect(getTimelineMode('IN_EXECUTION', 'IN_EXECUTION')).toBe('TRACKING');
  });

  it('renders only the operational forecast correction over a locked SCHEDULED baseline', () => {
    renderTimeline('SCHEDULED', 'APPROVED');

    expect(screen.getByTestId('operational-forecast-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('baseline-timeline-planner')).not.toBeInTheDocument();
    expect(
      screen.getByText('initiatives.timelineSection.timelineLockedBaseline')
    ).toBeInTheDocument();
  });

  it('keeps the real Timeline renderer mounted inside the canonical 26-card projection', () => {
    const nativeTimeline = {
      id: 'timeline',
      icon: () => null,
      label: { en: 'Timeline', pl: 'Harmonogram' },
      component: <TimelineSection sectionType={'timeline' as any} expanded onToggle={vi.fn()} />,
    } as any;
    const canonical = canonicalInitiativeSections(
      [nativeTimeline],
      () => null,
      (_key, fallback) => fallback
    );
    const timelineCard = canonical.find((section) => section.id === 'timeline');

    render(
      <InitiativeContext.Provider value={timelineContext('SCHEDULED', 'APPROVED')}>
        {timelineCard?.component}
      </InitiativeContext.Provider>
    );

    expect(timelineCard).toBeDefined();
    expect(screen.getByTestId('operational-forecast-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('baseline-timeline-planner')).not.toBeInTheDocument();
  });

  it('fails closed for an unknown future canonical lifecycle', () => {
    renderTimeline('FUTURE_UNRECOGNIZED_STATE', 'DRAFT');

    expect(screen.getByTestId('operational-forecast-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('baseline-timeline-planner')).not.toBeInTheDocument();
  });

  it('keeps the existing EXECUTING legacy timeline locked without changing its CLOSED mode', () => {
    const context = timelineContext('', 'EXECUTING');
    context.initiative.documentOrigin = 'v8-planning';
    render(
      <InitiativeContext.Provider value={context}>
        <TimelineSection sectionType={'timeline' as any} expanded onToggle={vi.fn()} />
      </InitiativeContext.Provider>
    );

    expect(getTimelineMode('EXECUTING')).toBe('CLOSED');
    expect(screen.getByTestId('operational-forecast-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('baseline-timeline-planner')).not.toBeInTheDocument();
  });
});
