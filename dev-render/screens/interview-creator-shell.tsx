import React, { useEffect } from 'react';

import { InsightCreatorModal } from '../../src/components/Interview/InsightCreatorModal';
import { Api } from '../../src/services/api';
import { V8InterviewApi } from '../../src/services/api/v8/interview';
import { INTERVIEW_CREATOR_SHELL_FLAG_KEYS } from '../../src/utils/interviewCreatorShellFlag';

const params = new URLSearchParams(window.location.search);
const requestedStep = Math.min(3, Math.max(1, Number(params.get('step') || '1')));
const scene = params.get('scene') || 'default';

const sessions = Array.from({ length: 12 }, (_, index) => ({
  id: `session-${index + 1}`,
  name: `Zatwierdzona sesja ${index + 1}`,
  status: 'completed',
  approvalStatus: 'approved',
  sourceScopeStatus: 'approved_only' as const,
  completedAt: `2026-08-${String(21 - index).padStart(2, '0')}T10:00:00.000Z`,
  respondentId: `person-${(index % 7) + 1}`,
  respondentName: [
    'Anna Nowak',
    'Marek Zieliński',
    'Katarzyna Wójcik',
    'Paweł Kaczmarek',
    'Tomasz Lewandowski',
    'Ewa Dąbrowska',
    'Grzegorz Kowalczyk',
  ][index % 7],
  respondentRole: 'Menedżer operacyjny',
  department: 'Operacje',
  answeredQuestions: 12,
  totalQuestions: 12,
}));

Object.assign(Api, {
  get: async (path: string) => {
    if (path === '/interview/sessions/completed') return scene === 'empty' ? [] : sessions;
    if (path === '/interview/insight-baskets') return { baskets: [] };
    return {};
  },
  post: async () => ({}),
  delete: async () => ({}),
});

Object.assign(V8InterviewApi, {
  listContextDocuments: async () => ({ documents: [] }),
  listInsights: async () => ({ insights: [] }),
  checkInsightSimilarity: async () => ({ matches: [] }),
  createInsight: async () => ({ id: 'day13-preview-insight' }),
});

function setNativeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export default function InterviewCreatorShellScreen() {
  window.localStorage.setItem(
    INTERVIEW_CREATOR_SHELL_FLAG_KEYS.localStorage,
    scene === 'off' ? 'false' : 'true'
  );

  useEffect(() => {
    if (requestedStep === 1) return;
    const timer = window.setTimeout(() => {
      const title = document.querySelector<HTMLInputElement>('input[required]');
      if (title) setNativeValue(title, 'Wąskie gardła w przepływie zleceń magazynowych');
      const next = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => /Next|Dalej/i.test(button.textContent || '')
      );
      next?.click();
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="h-screen w-screen bg-c-surface-raised">
      <InsightCreatorModal isOpen onClose={() => {}} onSuccess={() => {}} />
    </div>
  );
}
