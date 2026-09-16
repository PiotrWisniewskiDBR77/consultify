/** @vitest-environment jsdom */

import { Buffer } from 'node:buffer';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../../public/locales/en/translation.json';
import plTranslation from '../../../../public/locales/pl/translation.json';

const api = vi.hoisted(() => ({
  getTasks: vi.fn(),
  getInitiatives: vi.fn(),
  listExecutionCases: vi.fn(),
}));
const locale = vi.hoisted(() => ({ language: 'en' }));

const catalogs: Record<string, unknown> = { en: enTranslation, pl: plTranslation };
const fromB64 = (value: string): string => Buffer.from(value, 'base64').toString('utf8');
const resolveKey = (language: string, key: string): string | undefined => {
  const value = key.split('.').reduce<unknown>((node, part) => {
    return node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
  }, catalogs[language]);
  return typeof value === 'string' ? value : undefined;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) =>
      resolveKey(locale.language, key) ??
      (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? key)),
    i18n: {
      get language() {
        return locale.language;
      },
    },
  }),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (store: unknown) => unknown) =>
    selector({ currentUser: { id: 'user-1' }, currentOrganization: { id: 'org-1' } }),
}));

vi.mock('@/hooks/useOrganizationMemberNames', () => ({
  useOrganizationMemberNames: () => (id: string) =>
    id === 'person-1' ? fromB64('UGlvdHIgV2nFm25pZXdza2k=') : null,
  memberNameOrUnknown: (_resolver: unknown, id: string) => id,
  readMemberId: () => '',
  readMemberLabel: () => null,
}));

vi.mock('@/services/api/organizations.api', () => ({
  OrganizationApi: { getOrganizationMembers: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getTasks: api.getTasks,
    getInitiatives: api.getInitiatives,
    get: vi.fn().mockResolvedValue({ data: { statuses: [], transitions: {} } }),
    updateTask: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listExecutionCases: api.listExecutionCases,
  readExecutionCaseBundles: vi.fn(),
  readExecutionWork: vi.fn(),
  readExecutionCase: vi.fn(),
  readExecutionMilestones: vi.fn(),
  createExecutionTask: vi.fn(),
  updateExecutionTask: vi.fn(),
  completeExecutionTask: vi.fn(),
  createExecutionDecision: vi.fn(),
  requestExecutionDecision: vi.fn(),
  decideExecutionDecision: vi.fn(),
  createExecutionMilestone: vi.fn(),
}));

import { ExecutionWorkSurface } from '../ExecutionWorkSurface';

const task = {
  id: 'task-1',
  title: fromB64(
    'W1NUQUdJTkddIEJVRzogQnJhayBtb8W8bGl3b8WbY2kg4oCUIHphcGlzeiB3c3p5c3RraWUgcG93aWFkb21pZW5pYQ=='
  ),
  status: 'IN_PROGRESS',
  assigneeId: 'person-1',
  initiativeId: 'initiative-1',
  dueDate: '2026-10-01T00:00:00.000Z',
  description: fromB64('QnJhayBkYW55Y2ggd2VqxZtjaW93eWNoIOKAlCB6YXBpc3ogdXpnb2RuaWVuaWUu'),
};
const roleTask = {
  ...task,
  id: 'task-role',
  title: fromB64('RW5nbGlzaC1vbmx5IGNvbnRyb2wgdGFzaw=='),
  assigneeId: 'execution-manager',
  description: '',
};

const mount = () =>
  render(
    <MemoryRouter>
      <ExecutionWorkSurface />
    </MemoryRouter>
  );

beforeEach(() => {
  api.getTasks.mockResolvedValue([task, roleTask]);
  api.getInitiatives.mockResolvedValue([
    { id: 'initiative-1', name: fromB64('UHJvZ3JhbSDFgcOzZMW6IOKAlCB3ZHJvxbxlbmll') },
  ]);
  api.listExecutionCases.mockResolvedValue({ cases: [] });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('FEEDBACK-1/1e — UI language and persisted-data boundary', () => {
  it.each([
    {
      language: 'en',
      statusKey: 'execution.work.status.in_progress',
    },
    {
      language: 'pl',
      statusKey: 'execution.work.status.in_progress',
    },
  ])(
    'renders real $language chrome while preserving persisted content',
    async ({ language, statusKey }) => {
      locale.language = language;
      mount();

      await waitFor(() => expect(screen.getByText(task.title)).toBeInTheDocument());
      const headers = [
        'execution.work.columns.title',
        'execution.work.columns.initiative',
        'execution.work.columns.person',
        'execution.work.columns.due',
        'execution.work.columns.status',
        'execution.work.columns.daysOverdue',
      ].map((key) => resolveKey(language, key));
      const renderedHeaders = Array.from(
        document.querySelectorAll<HTMLElement>('th[data-column-id]')
      ).map((node) => node.textContent?.trim() ?? '');
      for (const header of headers) {
        expect(renderedHeaders, `rendered headers: ${JSON.stringify(renderedHeaders)}`).toContain(
          header
        );
      }
      expect(screen.getAllByText(resolveKey(language, statusKey) as string)).not.toHaveLength(0);

      const userContent = Array.from(
        document.querySelectorAll<HTMLElement>('[data-language-source="user-content"]')
      );
      expect(userContent.map((node) => node.textContent)).toEqual(
        expect.arrayContaining([
          task.title,
          fromB64('UHJvZ3JhbSDFgcOzZMW6IOKAlCB3ZHJvxbxlbmll'),
          fromB64('UGlvdHIgV2nFm25pZXdza2k='),
        ])
      );
      expect(userContent.every((node) => node.getAttribute('translate') === 'no')).toBe(true);
      const roleLabel = screen.getByText(
        resolveKey(language, 'execution.review.roles.executionManager') as string
      );
      expect(roleLabel.closest('[data-language-source="user-content"]')).toBeNull();

      if (language === 'en') {
        const chrome = document.querySelector('section')!.cloneNode(true) as HTMLElement;
        chrome
          .querySelectorAll('[data-language-source="user-content"]')
          .forEach((node) => node.remove());
        expect(chrome.textContent).not.toMatch(
          new RegExp(fromB64('W8SFxIfEmcWCxYTDs8WbxbrFvF0='), 'i')
        );
        expect(chrome.textContent).not.toMatch(
          new RegExp(fromB64('XGIoPzp6YXBpc3p8YnJha3x3c3p5c3RraWV8cG93aWFkb21pZW5pYSlcYg=='), 'i')
        );
      }

      fireEvent.click(screen.getByRole('row', { name: new RegExp('STAGING.*BUG') }));
      await waitFor(() => {
        const headerTitle = document.querySelector(
          '[data-preview-block="header"] [data-language-source="user-content"]'
        );
        expect(headerTitle).toHaveTextContent(task.title);
      });
      const previewDescription = Array.from(
        document.querySelectorAll<HTMLElement>('[data-language-source="user-content"]')
      ).find((node) => node.textContent?.includes(task.description));
      expect(previewDescription).toBeDefined();

      if (language === 'en') {
        const chromeWithPreview = document.querySelector('section')!.cloneNode(true) as HTMLElement;
        chromeWithPreview
          .querySelectorAll('[data-language-source="user-content"]')
          .forEach((node) => node.remove());
        expect(chromeWithPreview.textContent).not.toMatch(
          new RegExp(fromB64('W8SFxIfEmcWCxYTDs8WbxbrFvF0='), 'i')
        );
        expect(chromeWithPreview.textContent).not.toMatch(
          new RegExp(fromB64('XGIoPzp6YXBpc3p8YnJha3x3c3p5c3RraWV8cG93aWFkb21pZW5pYSlcYg=='), 'i')
        );
      }
    }
  );
});
