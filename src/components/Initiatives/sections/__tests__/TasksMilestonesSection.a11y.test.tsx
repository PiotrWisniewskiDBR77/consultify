/**
 * @vitest-environment jsdom
 *
 * CB-01 / RV-020 — the Tasks table's Status/Priority/Owner/Due/Source
 * header filters must each expose an accessible name describing what they
 * filter (not a bare unnamed `<select>`). PL/EN because the names are
 * built from translation keys.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { InitiativeContextValue } from '../InitiativeContext';
import type { SectionTypeInfo, TaskItem } from '../types';

const SECTION_TYPE: SectionTypeInfo = {
  id: 'tasks',
  key: 'tasks_milestones',
  name: 'Tasks & Milestones',
  namePl: 'Zadania i kamienie milowe',
  description: null,
  descriptionPl: null,
  category: 'content',
  columnPosition: 'left',
  defaultOrder: 0,
  icon: null,
  iconColor: null,
  iconBg: null,
  componentKey: 'TasksMilestonesSection',
  isSystem: true,
  isActive: true,
};

const TRANSLATIONS: Record<string, { en: string; pl: string }> = {
  'initiatives.tasksMilestonesSection.filterStatusLabel': {
    en: 'Filter tasks by status',
    pl: 'Filtruj zadania wg statusu',
  },
  'initiatives.tasksMilestonesSection.filterPriorityLabel': {
    en: 'Filter tasks by priority',
    pl: 'Filtruj zadania wg priorytetu',
  },
  'initiatives.tasksMilestonesSection.filterOwnerLabel': {
    en: 'Filter tasks by owner',
    pl: 'Filtruj zadania wg właściciela',
  },
  'initiatives.tasksMilestonesSection.filterDueLabel': {
    en: 'Filter tasks by due date',
    pl: 'Filtruj zadania wg terminu',
  },
  'initiatives.tasksMilestonesSection.filterSourceLabel': {
    en: 'Filter tasks by source',
    pl: 'Filtruj zadania wg źródła',
  },
};

function mockI18n(lang: 'en' | 'pl') {
  vi.doMock('react-i18next', () => ({
    useTranslation: () => ({
      t: (key: string, defaultOrOpts?: any) => {
        const entry = TRANSLATIONS[key];
        if (entry) return entry[lang];
        return typeof defaultOrOpts === 'string' ? defaultOrOpts : key;
      },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }));
}

const TASK: TaskItem = {
  id: 'task-1',
  title: 'Prepare rollout report',
  status: 'todo',
  priority: 'medium',
  source: 'manual',
};

const baseContext = {
  tasks: [TASK],
  setTasks: vi.fn(),
  tasksDone: false,
  isPolish: false,
  onOpenTask: vi.fn(),
  users: [{ id: 'u1', firstName: 'Ana', lastName: 'Kowalska' }],
  initiative: { id: 'init-1' },
  showCreateTask: false,
  setShowCreateTask: vi.fn(),
  tasksAiRequest: null,
  clearTasksAiRequest: vi.fn(),
} as unknown as InitiativeContextValue;

const renderSection = async () => {
  const { InitiativeContext } = await import('../InitiativeContext');
  const { TasksMilestonesSection } = await import('../TasksMilestonesSection');
  return render(
    <InitiativeContext.Provider value={baseContext}>
      <TasksMilestonesSection sectionType={SECTION_TYPE} expanded onToggle={vi.fn()} />
    </InitiativeContext.Provider>
  );
};

describe('TasksMilestonesSection — header filter accessible contract', () => {
  it('names all five filter selects (EN)', async () => {
    vi.resetModules();
    mockI18n('en');
    await renderSection();

    expect(screen.getByLabelText('Filter tasks by status')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter tasks by priority')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter tasks by owner')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter tasks by due date')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter tasks by source')).toBeInTheDocument();
  });

  it('names all five filter selects (PL)', async () => {
    vi.resetModules();
    mockI18n('pl');
    await renderSection();

    expect(screen.getByLabelText('Filtruj zadania wg statusu')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtruj zadania wg priorytetu')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtruj zadania wg właściciela')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtruj zadania wg terminu')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtruj zadania wg źródła')).toBeInTheDocument();
  });
});
