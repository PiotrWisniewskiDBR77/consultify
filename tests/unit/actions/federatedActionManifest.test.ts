import { describe, expect, it } from 'vitest';
import {
  buildFederatedActionManifest,
  validateFederatedActionManifest,
  type FederatedActionEntry,
} from '../../../shared/contracts/federatedActionManifest';
import { adaptChatActions, adaptIdeaActions } from '../../../src/actions/federatedActionAdapters';
import {
  adaptDynamicSwotActions,
  adaptExecutionActions,
} from '../../../server/src/services/teresa/federatedActionAdapters';

const executionPolicies = [
  { actionId: 'execution.task.complete', targetType: 'execution_task', destructive: false, minimumRole: 'MEMBER', runtimeState: 'IMPLEMENTED', auditRequired: true },
  { actionId: 'case.close', targetType: 'case_workspace', destructive: false, minimumRole: 'ADMIN', runtimeState: 'IMPLEMENTED', auditRequired: true },
] as const;

describe('federated Teresa/UI action manifest', () => {
  it('federates source registries without copying their entries', () => {
    const adapters = [adaptIdeaActions, adaptChatActions, adaptDynamicSwotActions, () => adaptExecutionActions(executionPolicies)];
    const generated = adapters.flatMap((adapter) => [...adapter()]);
    const denominator = generated.map((entry) => entry.mountedMutationId).filter((id): id is string => Boolean(id));
    const manifest = buildFederatedActionManifest(adapters, denominator);
    expect(manifest.entries.length).toBe(generated.length);
    expect(new Set(manifest.entries.map((entry) => entry.module))).toEqual(
      new Set(['IDEA', 'DYNAMIC_SWOT', 'CHAT', 'EXECUTION', 'CASE_WORKSPACE'])
    );
    expect(manifest.entries.filter((entry) => entry.mvpDisposition === 'NOT_SUPPORTED_IN_MVP')).toHaveLength(17);
    expect(manifest.entries.every((entry) => entry.mvpDisposition !== undefined)).toBe(true);
  });

  it('fails closed on duplicate action IDs, missing mutation evidence and uncovered mounted routes', () => {
    const valid = adaptExecutionActions(executionPolicies)[0];
    const broken: FederatedActionEntry = { ...valid, actionId: 'duplicate@1', receipt: null };
    expect(validateFederatedActionManifest([broken, { ...valid, actionId: 'duplicate@1' }], ['uncovered:POST:/x']))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'DUPLICATE_ACTION_ID', actionId: 'duplicate@1' }),
        expect.objectContaining({ code: 'MISSING_FIELD', field: 'receipt' }),
        expect.objectContaining({ code: 'MISSING_MOUNTED_MUTATION', actionId: 'uncovered:POST:/x' }),
      ]));
  });

  it('keeps UI and Teresa identified and makes every safety decision explicit', () => {
    const supported = [
      ...adaptIdeaActions(), ...adaptChatActions(), ...adaptDynamicSwotActions(), ...adaptExecutionActions(executionPolicies),
    ].filter((entry) => entry.mvpDisposition === 'SUPPORTED' && entry.effect !== 'READ');
    expect(supported.length).toBeGreaterThan(0);
    for (const entry of supported) {
      expect(entry.uiExecutor).toBeTruthy();
      expect(entry.teresaExecutor).toBeTruthy();
      expect(['REQUIRED', 'NOT_REQUIRED']).toContain(entry.preview);
      expect(['REQUIRED', 'NOT_REQUIRED']).toContain(entry.confirm);
      expect(entry.idempotency).toBeTruthy();
      expect(entry.receipt).toBeTruthy();
      expect(entry.auditEvent).toBeTruthy();
      expect(entry.compensation).not.toBe('');
    }
  });
});
