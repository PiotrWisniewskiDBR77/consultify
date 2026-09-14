import React from 'react';
import { createRoot } from 'react-dom/client';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nextProvider } from 'react-i18next';
import { InitiativeWorkReportView } from '@/components/Initiatives/InitiativeWorkReportView';
import '@/index.css';

i18n.use(initReactI18next).init({ lng: 'en', fallbackLng: 'en', resources: { en: { translation: {} } }, interpolation: { escapeValue: false } });
if (new URLSearchParams(location.search).get('theme') === 'dark') document.documentElement.classList.add('dark');
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes('/organizations/org-1/members')) return json([{ userId: 'owner-1', name: 'Olivia Owner', email: 'owner@example.test' }, { userId: 'manager-1', name: 'Martin Manager', email: 'manager@example.test' }]);
  if (url.endsWith('/report-definitions')) return json({ items: [{ definitionId: 'def-1' }] });
  if (url.includes('/report-definitions/def-1')) return json({ definitionId: 'def-1', currentVersion: 1, version: 3, versions: [{ definitionVersion: 1, state: 'PUBLISHED', name: 'Weekly initiative report', ownerId: 'owner-1', approverId: 'manager-1' }] });
  if (url.endsWith('/report-runs')) return json({ items: [{ reportRunId: 'run-1', version: 4, status: 'FROZEN', ownerId: 'owner-1', approverId: 'manager-1', audience: ['board@example.test'], updatedAt: '2026-09-14T07:00:00.000Z', workReport: { title: 'Weekly portfolio update', cadence: 'WEEKLY', templateId: 'WEEKLY_TEAM_UPDATE' } }, { reportRunId: 'run-2', version: 5, status: 'APPROVED', ownerId: 'owner-1', approverId: 'manager-1', audience: ['board@example.test'], updatedAt: '2026-09-13T07:00:00.000Z', workReport: { title: 'Decision backlog', cadence: 'ON_DEMAND', templateId: 'DECISION_BACKLOG' } }] });
  return json({});
};
createRoot(document.getElementById('root')!).render(<I18nextProvider i18n={i18n}><main className="min-h-screen bg-c-bg"><InitiativeWorkReportView currentProjectId="project-1" currentUserId="owner-1" currentOrganizationId="org-1" /></main></I18nextProvider>);
