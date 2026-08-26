import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';

import { ChatSignalsFeed } from '../../src/components/AIChat/signalsFeed/ChatSignalsFeed';
import type { SignalDTO } from '../../src/components/AIChat/signalsFeed/signalTypes';
import i18n from '../../src/i18n';

const query = new URLSearchParams(location.search);
const dark = query.get('theme') === 'dark';
document.documentElement.classList.toggle('dark', dark);
document.body.className = 'm-0 bg-c-surface';
void i18n.changeLanguage('pl');

const types = [
  ['task_overdue', 'EXECUTION', 'warning'],
  ['task_blocked_stale', 'EXECUTION', 'critical'],
  ['initiative_no_baseline', 'EXECUTION', 'blocker'],
  ['decision_pending_stale', 'DECISION', 'warning'],
  ['decision_blocking_dependents', 'DECISION', 'critical'],
  ['kpi_threshold_breached', 'RESULTS', 'critical'],
  ['budget_overspend', 'FINANCE', 'blocker'],
  ['task_due_soon_not_started', 'EXECUTION', 'info'],
  ['kpi_threshold_breached', 'RESULTS', 'warning'],
] as const;

const signals: SignalDTO[] = types.map(([type, domain, severity], index) => ({
  key: `signal-${index + 1}`,
  type,
  title:
    index === 7
      ? 'Bardzo długi sygnał testujący bezpieczne przycięcie tekstu w kanonicznej tabeli feedu organizacyjnego Metalpol'
      : '',
  body: `Metalpol: ${index % 2 ? 'Marek Nowak' : 'Anna Kowalska'} wymaga reakcji właściciela procesu.`,
  severity: severity === 'info' ? 'INFO' : severity === 'warning' ? 'WARNING' : 'CRITICAL',
  severityRaw: severity,
  createdAt: `2026-08-${20 + (index % 6)}T08:00:00Z`,
  projectId: 'metalpol-transformacja',
  projectName: 'Metalpol — transformacja operacyjna',
  entityType: type.startsWith('task')
    ? 'TASK'
    : type.startsWith('decision')
      ? 'DECISION'
      : type.includes('kpi')
        ? 'KPI'
        : 'INITIATIVE',
  entityId: `metalpol-${index + 1}`,
  domain,
  origin: index === 5 || index === 8 ? 'INTERPRETED' : 'DETERMINISTIC',
  source: {
    evidence:
      index === 4
        ? []
        : [
            {
              ref: `metalpol-${index + 1}`,
              refType: 'Rekord',
              version: 1,
              observedValue: index + 3,
              observedAt: '2026-08-26T12:15:00Z',
            },
          ],
    ruleId: type.replaceAll('_', '.'),
    ruleVersion: 1,
  },
  freshness: {
    lastObservedAt: '2026-08-26T12:15:00Z',
    runAt: '2026-08-26T12:15:00Z',
    nextRunAt: null,
  },
  destination: {
    kind: 'route',
    route: `/objects/${index + 1}`,
    params: {},
    permission: 'read',
    allowed: index % 3 === 0 ? null : index % 3 === 1,
  },
  ...(index === 5
    ? {
        provenance: {
          provider: 'OpenAI',
          model: 'gpt-budget',
          promptVersion: 1,
          templateVersion: 1,
          confidence: 'MEDIUM',
          basedOnSignalIds: ['signal-1', 'signal-2'],
        },
      }
    : {}),
  isMine: index % 2 === 0,
  titleKey: `signals.${type === 'task_overdue' ? 'exec.task.overdue' : type === 'task_blocked_stale' ? 'exec.task.blocked_stale' : type === 'initiative_no_baseline' ? 'exec.initiative.no_baseline' : type === 'decision_pending_stale' ? 'dec.pending_stale' : type === 'decision_blocking_dependents' ? 'dec.blocking_dependents' : type === 'kpi_threshold_breached' ? 'res.kpi_threshold_breached' : type === 'budget_overspend' ? 'fin.budget_overspend' : 'exec.task.due_soon_not_started'}.title`,
  titleParams: {},
  bodyKey: undefined,
  bodyParams: {},
  firstObservedAt: `2026-08-${20 + (index % 6)}T08:00:00Z`,
  status: 'OPEN',
}));

const state = query.get('stan') ?? 'pelny';
const response =
  state === 'pelny'
    ? {
        signals,
        nextCursor: query.get('podglad') === '1' ? null : 'opaque-cursor',
        producerEnabled: true,
      }
    : { signals: [], nextCursor: null, producerEnabled: state === 'producent-off' ? false : true };

// FIX-11 (dyżur 26 chat-signals-front, odbiór P2.11) — stan dławienia (6) nie
// jest już wstrzykiwany przez harnessowy prop w kodzie produkcyjnym. Zamiast
// tego ten harness (dev-render, NIE kod produkcyjny) symuluje realny 429 przez
// istniejące DI `api.post` i sam klika „Odśwież" tuż po zamontowaniu — to samo
// zdarzenie, które w apce wywołuje prawdziwy klik użytkownika.
const throttled = state === 'dlawienie';
const api = {
  get: async () => response,
  post: async (path: string) => {
    if (throttled && path === '/signals/refresh') {
      throw { status: 429, data: { retryAfterSeconds: 45 } };
    }
    return { producerEnabled: true };
  },
};

if (throttled) {
  window.setTimeout(() => {
    document.querySelector<HTMLButtonElement>('[data-testid="chat-signals-refresh"]')?.click();
  }, 50);
}

export default function ChatSignalsFeedScreen() {
  return (
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <div className="h-screen p-6">
          <div className="mx-auto h-full max-w-[1320px] overflow-hidden rounded-xl border border-c-border bg-c-surface shadow-xl">
            <ChatSignalsFeed
              initialResponse={response}
              api={api}
              initialSelectedId={query.get('podglad') === '1' ? 'signal-1' : null}
            />
          </div>
        </div>
      </MemoryRouter>
    </I18nextProvider>
  );
}
