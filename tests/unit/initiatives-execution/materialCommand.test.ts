import { describe, expect, it } from 'vitest';

import {
  executeMaterialCommand,
  MaterialCommandConflictError,
  type AuditAppend,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
  type OutboxAppend,
  type StoredCommandReceipt,
} from '../../../server/src/domain/initiatives-execution/materialCommand';

interface Store {
  version: number;
  value: string;
  audits: AuditAppend[];
  outbox: OutboxAppend[];
  receipts: Map<string, StoredCommandReceipt<unknown>>;
  aggregates?: Map<string, unknown>;
}

function createUnitOfWork(
  store: Store,
  failAt?: 'audit' | 'outbox' | 'receipt'
): MaterialCommandUnitOfWork {
  return {
    async transaction<T>(
      work: (transaction: MaterialCommandTransaction) => Promise<T>
    ): Promise<T> {
      const snapshot: Store = {
        version: store.version,
        value: store.value,
        audits: [...store.audits],
        outbox: [...store.outbox],
        receipts: new Map(store.receipts),
        aggregates: new Map(store.aggregates),
      };
      const transaction: MaterialCommandTransaction = {
        async adoptAcceptedClassicInitiative() {
          throw new Error('not used by material command unit tests');
        },
        async findReceipt<TResponse>(_organizationId, clientRequestId) {
          return (store.receipts.get(clientRequestId) as StoredCommandReceipt<TResponse>) ?? null;
        },
        async getAggregateVersion() {
          return store.version;
        },
        async getAggregatePayload(_organizationId, aggregateType, aggregateId) {
          return store.aggregates?.get(`${aggregateType}:${aggregateId}`) ?? null;
        },
        async persistAggregate(_org, _type, _id, fromVersion, toVersion, mutation) {
          expect(store.version).toBe(fromVersion);
          store.version = toVersion;
          store.value = String(mutation);
        },
        async getRelatedAggregateForUpdate() {
          return null;
        },
        async persistRelatedAggregate() {},
        async claimRelation() {},
        async getSourceProposalForUpdate() {
          return null;
        },
        async markSourceProposalRegistered() {},
        async markSourceProposalDisposition() {},
        async isCanonicalInitiativeCard() {
          return false;
        },
        async listCanonicalInitiativeCardKeys() {
          return [];
        },
        async replaceInitiativeCardSelection() {},
        async getInitiativeCardVersionForUpdate() {
          return 0;
        },
        async getLatestInitiativeCardForUpdate() {
          return null;
        },
        async publishInitiativeCardVersion() {},
        async reviewInitiativeCardVersion() {},
        async appendAudit(entry) {
          if (failAt === 'audit') throw new Error('audit write failed');
          store.audits.push(entry);
        },
        async appendOutbox(entry) {
          if (failAt === 'outbox') throw new Error('outbox write failed');
          store.outbox.push(entry);
        },
        async saveReceipt(receipt) {
          if (failAt === 'receipt') throw new Error('receipt write failed');
          store.receipts.set(receipt.clientRequestId, receipt as StoredCommandReceipt<unknown>);
        },
      };
      try {
        return await work(transaction);
      } catch (error) {
        store.version = snapshot.version;
        store.value = snapshot.value;
        store.audits = snapshot.audits;
        store.outbox = snapshot.outbox;
        store.receipts = snapshot.receipts;
        store.aggregates = snapshot.aggregates;
        throw error;
      }
    },
  };
}

const envelope = {
  organizationId: 'org-a',
  actorId: 'actor-a',
  aggregateType: 'initiative',
  aggregateId: 'initiative-a',
  expectedVersion: 0,
  clientRequestId: 'request-a',
  correlationId: 'correlation-a',
  policyId: 'standard-industrial',
  policyVersion: 2,
  commandType: 'initiative.definition.publish',
  payload: { title: 'ACO' },
};

const prepare = async () => ({
  mutation: 'ACO',
  response: { title: 'ACO' },
  eventType: 'initiative.card.versioned',
  eventPayload: { cardKey: 'summary-scope' },
  auditPayload: { before: null, after: 'ACO' },
});

describe('material command atomic contract', () => {
  it('persists mutation, audit, outbox and receipt as one unit', async () => {
    const store: Store = { version: 0, value: '', audits: [], outbox: [], receipts: new Map() };
    const result = await executeMaterialCommand(createUnitOfWork(store), envelope, prepare);

    expect(result).toMatchObject({ status: 'APPLIED', aggregateVersion: 1 });
    expect(store).toMatchObject({ version: 1, value: 'ACO' });
    expect(store.audits).toHaveLength(1);
    expect(store.outbox).toHaveLength(1);
    expect(store.receipts.size).toBe(1);
  });

  it('replays the stored response without applying a duplicate effect', async () => {
    const store: Store = { version: 0, value: '', audits: [], outbox: [], receipts: new Map() };
    const unitOfWork = createUnitOfWork(store);
    await executeMaterialCommand(unitOfWork, envelope, prepare);
    const replay = await executeMaterialCommand(unitOfWork, envelope, async () => {
      throw new Error('prepare must not execute on replay');
    });

    expect(replay).toMatchObject({ status: 'REPLAYED', aggregateVersion: 1 });
    expect(store.audits).toHaveLength(1);
    expect(store.outbox).toHaveLength(1);
  });

  it('rejects stale versions before invoking business preparation', async () => {
    const store: Store = {
      version: 2,
      value: 'newer',
      audits: [],
      outbox: [],
      receipts: new Map(),
    };
    await expect(
      executeMaterialCommand(createUnitOfWork(store), envelope, async () => {
        throw new Error('prepare must not execute on conflict');
      })
    ).rejects.toMatchObject<MaterialCommandConflictError>({
      expectedVersion: 0,
      currentVersion: 2,
    });
  });

  it.each(['audit', 'outbox', 'receipt'] as const)(
    'rolls back every effect when %s persistence fails',
    async (failAt) => {
      const store: Store = { version: 0, value: '', audits: [], outbox: [], receipts: new Map() };
      await expect(
        executeMaterialCommand(createUnitOfWork(store, failAt), envelope, prepare)
      ).rejects.toThrow();
      expect(store).toMatchObject({ version: 0, value: '', audits: [], outbox: [] });
      expect(store.receipts.size).toBe(0);
    }
  );

  it('rejects reuse of a request id for another aggregate', async () => {
    const store: Store = { version: 0, value: '', audits: [], outbox: [], receipts: new Map() };
    const unitOfWork = createUnitOfWork(store);
    await executeMaterialCommand(unitOfWork, envelope, prepare);

    await expect(
      executeMaterialCommand(unitOfWork, { ...envelope, aggregateId: 'initiative-b' }, prepare)
    ).rejects.toBeInstanceOf(MaterialCommandConflictError);
  });

  it('rejects reuse of a request id with a different payload', async () => {
    const store: Store = { version: 0, value: '', audits: [], outbox: [], receipts: new Map() };
    const unitOfWork = createUnitOfWork(store);
    await executeMaterialCommand(unitOfWork, envelope, prepare);

    await expect(
      executeMaterialCommand(
        unitOfWork,
        { ...envelope, payload: { title: 'Different initiative' } },
        prepare
      )
    ).rejects.toBeInstanceOf(MaterialCommandConflictError);
    expect(store.audits).toHaveLength(1);
    expect(store.outbox).toHaveLength(1);
  });

  it('fails closed for direct and dependent commands linked to an archived Initiative', async () => {
    const aggregates = new Map<string, unknown>([
      ['initiative:initiative-a', { initiativeId: 'initiative-a', lifecycleState: 'ARCHIVED' }],
      [
        'execution_task:task-a',
        { taskId: 'task-a', initiativeId: 'initiative-a', executionCaseId: 'case-a' },
      ],
    ]);
    const direct: Store = {
      version: 0,
      value: '',
      audits: [],
      outbox: [],
      receipts: new Map(),
      aggregates,
    };
    await expect(
      executeMaterialCommand(createUnitOfWork(direct), envelope, prepare)
    ).rejects.toThrow('Archived Initiative is read-only');
    expect(direct).toMatchObject({ version: 0, value: '', audits: [], outbox: [] });

    const dependent: Store = {
      version: 0,
      value: '',
      audits: [],
      outbox: [],
      receipts: new Map(),
      aggregates,
    };
    await expect(
      executeMaterialCommand(
        createUnitOfWork(dependent),
        {
          ...envelope,
          aggregateType: 'execution_task',
          aggregateId: 'task-a',
          commandType: 'execution.task.update',
          payload: { patch: { title: 'forbidden' } },
        },
        prepare
      )
    ).rejects.toThrow('Archived Initiative is read-only');
    expect(dependent.receipts.size).toBe(0);
  });

  it('allows the explicit archive transition but rejects a forged restore', async () => {
    const closed = new Map<string, unknown>([
      ['initiative:initiative-a', { initiativeId: 'initiative-a', lifecycleState: 'CLOSED' }],
    ]);
    const archiveStore: Store = {
      version: 0,
      value: '',
      audits: [],
      outbox: [],
      receipts: new Map(),
      aggregates: closed,
    };
    await expect(
      executeMaterialCommand(
        createUnitOfWork(archiveStore),
        { ...envelope, aggregateType: 'archive_manifest', commandType: 'initiative.archive' },
        prepare
      )
    ).resolves.toMatchObject({ status: 'APPLIED' });

    const archivedStore: Store = {
      version: 1,
      value: 'ARCHIVED',
      audits: [],
      outbox: [],
      receipts: new Map(),
      aggregates: new Map([
        ['initiative:initiative-a', { initiativeId: 'initiative-a', lifecycleState: 'ARCHIVED' }],
      ]),
    };
    await expect(
      executeMaterialCommand(
        createUnitOfWork(archivedStore),
        { ...envelope, expectedVersion: 1, commandType: 'initiative.restore' },
        prepare
      )
    ).rejects.toThrow('restore is not supported');
    expect(archivedStore.receipts.size).toBe(0);
  });
});
