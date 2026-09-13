import { describe, expect, it } from 'vitest';

import {
  executionNavigationCommit,
  parseExecutionNavigationState,
  serializeExecutionNavigationState,
} from '../../../src/components/Execution/executionNavigationState';

const options = { summaryOneLookEnabled: true };

describe('R14 T33-TABLE-T14 — rollout routing and browser history', () => {
  it('historyczny deep link rollout otwiera bezpośrednio Raporty / Rollout', () => {
    expect(parseExecutionNavigationState('?tab=rollout', options)).toMatchObject({
      functionId: 'reports',
      subview: 'rollout',
      surfaceTab: 'rollout',
      issue: null,
    });
  });

  it('przejście z Raportów do Rollout nie przechodzi przez Kokpit', () => {
    const reports = parseExecutionNavigationState('?tab=reports&view=table', options);
    const rollout = parseExecutionNavigationState(
      serializeExecutionNavigationState({
        ...reports,
        functionId: 'reports',
        subview: 'rollout',
        surfaceTab: 'rollout',
      }),
      options
    );

    expect(rollout).toMatchObject({
      functionId: 'reports',
      subview: 'rollout',
      surfaceTab: 'rollout',
    });
    expect(rollout.subview).not.toBe('summary');
  });

  it('akcja użytkownika tworzy wpis historii, a synchronizacja URL zastępuje bieżący wpis', () => {
    const rollout = parseExecutionNavigationState('?tab=rollout&view=kanban', options);
    const params = serializeExecutionNavigationState(rollout);
    const location = { pathname: '/execution', hash: '#risk-4' };

    expect(executionNavigationCommit(params, location, 'user')).toMatchObject({
      to: { pathname: '/execution', hash: '#risk-4' },
      options: { replace: false },
    });
    expect(executionNavigationCommit(params, location, 'url-sync')).toMatchObject({
      to: { pathname: '/execution', hash: '#risk-4' },
      options: { replace: true },
    });
  });
});
