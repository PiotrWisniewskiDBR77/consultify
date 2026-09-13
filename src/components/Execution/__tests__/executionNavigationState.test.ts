import { describe, expect, it } from 'vitest';

import {
  executionInitiativeIdFromDocument,
  executionNavigationTarget,
  parseExecutionNavigationState,
  serializeExecutionNavigationState,
  shouldPreserveExecutionNavigationInput,
} from '../executionNavigationState';

const parse = (search: string, summaryOneLookEnabled = true) =>
  parseExecutionNavigationState(search, { summaryOneLookEnabled });

describe('Execution navigation state', () => {
  it('historyczny resources otwiera Praca / Zasoby i zachowuje preset, initiativeId oraz executionCaseId', () => {
    const state = parse(
      '?tab=resources&preset=capacity&initiativeId=initiative-7&executionCaseId=case-9'
    );
    expect(state).toMatchObject({
      functionId: 'work',
      subview: 'resources',
      surfaceTab: 'resources',
      preset: 'capacity',
      initiativeId: 'initiative-7',
      executionCaseId: 'case-9',
      issue: null,
    });
  });

  it('summary przy fladze ON otwiera Raporty / Kokpit z tym samym kokpit presetem', () => {
    expect(parse('?tab=summary&kokpit=rozstrzygniecia', true)).toMatchObject({
      functionId: 'reports',
      subview: 'summary',
      surfaceTab: 'summary',
      preset: 'rozstrzygniecia',
      issue: null,
    });
  });

  it('summary przy fladze OFF pozostaje w Raportach i zwraca jawny SUMMARY_DISABLED zamiast Bank fallbacku', () => {
    const disabled = parse('?tab=summary&kokpit=ryzyka', false);
    expect(disabled).toMatchObject({
      functionId: 'reports',
      subview: 'summary',
      surfaceTab: 'reports',
      preset: 'ryzyka',
      issue: 'SUMMARY_DISABLED',
    });
    expect(
      parseExecutionNavigationState(serializeExecutionNavigationState(disabled), {
        summaryOneLookEnabled: false,
      })
    ).toMatchObject({ functionId: 'reports', surfaceTab: 'reports', issue: 'SUMMARY_DISABLED' });
  });

  it('rollout i /rollout adapter otwierają Raporty / Rollout bez piątej funkcji i zachowują record/query/hash', () => {
    for (const input of [
      '/execution?tab=rollout&initiativeId=i-1&filter=risk#record-4',
      '/rollout?initiativeId=i-1&filter=risk#record-4',
    ]) {
      const state = parse(input);
      expect(state).toMatchObject({
        functionId: 'reports',
        subview: 'rollout',
        surfaceTab: 'rollout',
        initiativeId: 'i-1',
        hash: '#record-4',
      });
      expect(state.params.get('filter')).toBe('risk');
      expect(
        executionNavigationTarget(serializeExecutionNavigationState(state), {
          pathname: '/execution',
          hash: state.hash,
        })
      ).toMatchObject({ pathname: '/execution', hash: '#record-4' });
    }
  });

  it('cold URL z initiativeId odtwarza tę samą kartę po usunięciu open i mode', () => {
    const state = parse('?tab=work&initiativeId=initiative-44&executionCaseId=case-3');
    expect(state.documentIdentity).toEqual({ kind: 'initiative', id: 'initiative-44' });
    const next = serializeExecutionNavigationState(state, state.params);
    expect(next.get('initiativeId')).toBe('initiative-44');
    expect(next.get('executionCaseId')).toBe('case-3');
    expect(next.has('open')).toBe(false);
    expect(next.has('mode')).toBe(false);
  });

  it('open plus mode ma pierwszeństwo tylko jako transient, a serializer zachowuje initiativeId, executionCaseId i return context', () => {
    const state = parse(
      '?tab=reports&open=initiative-new&mode=doc&initiativeId=initiative-old&executionCaseId=case-2&returnContext=bank-row-8'
    );
    expect(state).toMatchObject({
      functionId: 'list',
      initiativeId: 'initiative-new',
      executionCaseId: 'case-2',
      returnContext: 'bank-row-8',
      documentIdentity: { kind: 'initiative', id: 'initiative-new' },
    });
    const next = serializeExecutionNavigationState(state, state.params);
    expect(next.get('initiativeId')).toBe('initiative-new');
    expect(next.get('executionCaseId')).toBe('case-2');
    expect(next.get('returnContext')).toBe('bank-row-8');
    expect(next.has('open')).toBe(false);
    expect(next.has('mode')).toBe(false);
  });

  it('dokument work nie jest serializowany jako initiativeId', () => {
    expect(executionInitiativeIdFromDocument('work:case-7:task-2')).toBeNull();
    expect(executionInitiativeIdFromDocument('report:weekly')).toBeNull();
    expect(executionInitiativeIdFromDocument('initiative-7')).toBe('initiative-7');

    const params = serializeExecutionNavigationState(
      {
        ...parse('?initiativeId=initiative-old'),
        initiativeId: null,
        documentIdentity: { kind: 'work', id: 'work:case-7:task-2' },
      },
      new URLSearchParams('?initiativeId=initiative-old')
    );
    expect(params.has('initiativeId')).toBe(false);
    expect(params.get('documentKind')).toBe('work');
    expect(params.get('documentId')).toBe('work:case-7:task-2');
    expect(
      parseExecutionNavigationState(params, { summaryOneLookEnabled: true }).documentIdentity
    ).toEqual({ kind: 'work', id: 'work:case-7:task-2' });
    expect(
      parse('?initiativeId=initiative-old&documentKind=work&documentId=work%3Acase-7%3Atask-2')
    ).toMatchObject({
      initiativeId: null,
      documentIdentity: { kind: 'work', id: 'work:case-7:task-2' },
    });
  });

  it('nieznany tab i nieobsługiwany entityType zwracają jawny problem nawigacji bez sfabrykowanej Initiative', () => {
    expect(parse('?tab=does-not-exist')).toMatchObject({
      functionId: 'list',
      issue: 'UNKNOWN_TAB',
      documentIdentity: null,
    });
    expect(parse('?open=entity-1&mode=doc&entityType=decision')).toMatchObject({
      issue: 'UNSUPPORTED_ENTITY',
      initiativeId: null,
      documentIdentity: null,
    });
    expect(parse('?initiativeId=entity-2&entityType=decision')).toMatchObject({
      issue: 'UNSUPPORTED_ENTITY',
      initiativeId: null,
      documentIdentity: null,
    });
    expect(parse('?documentKind=decision&documentId=decision-3')).toMatchObject({
      issue: 'UNSUPPORTED_ENTITY',
      initiativeId: null,
      documentIdentity: null,
    });
    expect(parse('?documentId=untyped-4')).toMatchObject({
      issue: 'UNSUPPORTED_ENTITY',
      initiativeId: null,
      documentIdentity: null,
    });
    expect(shouldPreserveExecutionNavigationInput('UNKNOWN_TAB')).toBe(true);
    expect(shouldPreserveExecutionNavigationInput('UNKNOWN_SUBVIEW')).toBe(true);
    expect(shouldPreserveExecutionNavigationInput('UNSUPPORTED_ENTITY')).toBe(true);
    expect(shouldPreserveExecutionNavigationInput('SUMMARY_DISABLED')).toBe(false);
  });

  it('historyczne grid ma jawny alias, a table, kanban, calendar i gantt zachowują identyczną tożsamość i filtry', () => {
    const expected = new Map([
      ['table', 'table'],
      ['grid', 'kanban'],
      ['kanban', 'kanban'],
      ['calendar', 'calendar'],
      ['timeline', 'gantt'],
      ['gantt', 'gantt'],
    ]);
    for (const [input, output] of expected) {
      const state = parse(
        `?tab=list&view=${input}&initiativeId=initiative-1&executionCaseId=case-1&filter=red`
      );
      expect(state.view).toBe(output);
      expect(state.initiativeId).toBe('initiative-1');
      expect(state.executionCaseId).toBe('case-1');
      expect(state.params.get('filter')).toBe('red');
    }
  });

  it('serializer zachowuje filtry sort scroll selection oraz hash i kanonizuje alias podwidoku', () => {
    const state = parse(
      '/execution?tab=resources&view=grid&preset=capacity&filters=red&sort=due&scroll=840&selection=i-8&initiativeId=i-8#row-i-8'
    );
    const next = serializeExecutionNavigationState(state, state.params);
    expect(next.toString()).toContain('tab=work');
    expect(next.get('subview')).toBe('resources');
    expect(next.get('view')).toBe('kanban');
    expect(next.get('filters')).toBe('red');
    expect(next.get('sort')).toBe('due');
    expect(next.get('scroll')).toBe('840');
    expect(next.get('selection')).toBe('i-8');
    expect(state.hash).toBe('#row-i-8');
  });

  it('powrót z karty odtwarza function subview view preset filters sort scroll i selection', () => {
    const beforeOpen = parse(
      '/execution?tab=resources&view=grid&preset=capacity&filters=red&sort=due&scroll=840&selection=i-8#row-i-8'
    );
    const opened = parseExecutionNavigationState(
      serializeExecutionNavigationState({
        ...beforeOpen,
        initiativeId: 'initiative-8',
        documentIdentity: { kind: 'initiative', id: 'initiative-8' },
      }),
      { summaryOneLookEnabled: true }
    );
    const returned = parseExecutionNavigationState(
      serializeExecutionNavigationState({
        ...opened,
        initiativeId: null,
        documentIdentity: null,
      }),
      { summaryOneLookEnabled: true }
    );

    expect(returned).toMatchObject({
      functionId: 'work',
      subview: 'resources',
      surfaceTab: 'resources',
      view: 'kanban',
      preset: 'capacity',
      initiativeId: null,
      documentIdentity: null,
    });
    expect(returned.params.get('filters')).toBe('red');
    expect(returned.params.get('sort')).toBe('due');
    expect(returned.params.get('scroll')).toBe('840');
    expect(returned.params.get('selection')).toBe('i-8');
  });
});
