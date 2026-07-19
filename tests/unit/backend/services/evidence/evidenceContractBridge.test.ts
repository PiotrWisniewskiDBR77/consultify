/**
 * HP-17 bridge — `evidenceContractBridge.ts` maps the generator-facing HP-14/16
 * `EvidenceContract` (sources/assumptions:string[]/risks:string[]/confidence:
 * label/toVerify:string[]) onto the persisted `UpsertEnvelopeInput` shape
 * (`evidenceEnvelopeService.ts`) and writes it via an injected writer — this is
 * the piece `presentationGeneratorService.generateDeck` (deck),
 * `generateDeliverable.ts` (canvas) and `documentStudioService.
 * materializeDocumentArtifact` (document) all now call so their inline
 * EvidenceContract stops being computed-and-discarded.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  emptyEvidenceContract,
  type EvidenceContract,
} from '../../../../../server/src/services/evidence/evidenceContract.js';
import {
  mapEvidenceContractToEnvelopeInput,
  safePersistEvidenceContract,
} from '../../../../../server/src/services/evidence/evidenceContractBridge.js';

describe('mapEvidenceContractToEnvelopeInput', () => {
  it('maps sources/assumptions/toVerify/confidence into the envelope shape', () => {
    const contract: EvidenceContract = {
      sources: [
        { type: 'kpi_roi', ref: 'kpi-1', title: 'Revenue growth', snippet: '12%' },
        { type: 'raid', title: 'Risk register' }, // no ref — falls back to title
        { type: 'ignored' }, // neither ref nor title — dropped
      ],
      assumptions: ['Benchmark segment = SaaS default'],
      risks: ['2/5 slides have no source ref'],
      confidence: 'medium',
      toVerify: ['Confirm KPI baseline with client'],
    };

    const input = mapEvidenceContractToEnvelopeInput(contract, {
      organizationId: 'org-1',
      artifactType: 'deck',
      artifactId: 'deck-1',
      service: 'testGenerator',
      createdBy: 'user-1',
    });

    expect(input.organizationId).toBe('org-1');
    expect(input.artifactType).toBe('deck');
    expect(input.artifactId).toBe('deck-1');
    expect(input.createdBy).toBe('user-1');

    expect(input.sources).toHaveLength(2);
    expect(input.sources?.[0]).toMatchObject({ type: 'kpi_roi', ref: 'kpi-1', snippet: '12%' });
    expect(input.sources?.[1]).toMatchObject({ type: 'raid', ref: 'Risk register' });

    expect(input.assumptions).toHaveLength(1);
    expect(input.assumptions?.[0]).toMatchObject({
      key: 'assumption_1',
      value: 'Benchmark segment = SaaS default',
      source_type: 'imported',
    });

    // 'medium' -> confidenceToNumeric -> 0.55
    expect(input.confidence).toBe(0.55);

    // toVerify + risks (prefixed "Ryzyko:") both fold into the envelope's toVerify,
    // since the envelope column has no dedicated `risks` slot (decision D-2).
    expect(input.toVerify).toHaveLength(2);
    expect(input.toVerify?.[0].claim).toBe('Confirm KPI baseline with client');
    expect(input.toVerify?.[1].claim).toBe('Ryzyko: 2/5 slides have no source ref');

    expect(input.computedBy?.service).toBe('testGenerator');
  });

  it('maps the empty/low-confidence contract to numeric 0.25 and empty arrays', () => {
    const input = mapEvidenceContractToEnvelopeInput(emptyEvidenceContract(), {
      organizationId: 'org-1',
      artifactType: 'canvas',
      artifactId: 'canvas-1',
      service: 'testGenerator',
    });

    expect(input.sources).toEqual([]);
    expect(input.assumptions).toEqual([]);
    expect(input.toVerify).toEqual([]);
    expect(input.confidence).toBe(0.25);
    expect(input.createdBy ?? null).toBeNull();
  });
});

describe('safePersistEvidenceContract', () => {
  it('calls the injected writer.upsertEnvelope with the mapped input and returns true', async () => {
    const upsertEnvelope = vi.fn().mockResolvedValue({ id: 'envelope-1' });
    const contract: EvidenceContract = {
      sources: [{ type: 'document', ref: 'doc-1' }],
      assumptions: [],
      risks: [],
      confidence: 'high',
      toVerify: [],
    };

    const ok = await safePersistEvidenceContract(contract, {
      organizationId: 'org-2',
      artifactType: 'document',
      artifactId: 'doc-artifact-1',
      service: 'documentContentGenerator',
    }, { writer: { upsertEnvelope } });

    expect(ok).toBe(true);
    expect(upsertEnvelope).toHaveBeenCalledTimes(1);
    const input = upsertEnvelope.mock.calls[0][0];
    expect(input.artifactType).toBe('document');
    expect(input.artifactId).toBe('doc-artifact-1');
    expect(input.confidence).toBe(0.85);
  });

  it('never throws and returns false when the writer rejects (fail-safe)', async () => {
    const upsertEnvelope = vi.fn().mockRejectedValue(new Error('db unavailable'));
    const warn = vi.fn();

    const ok = await safePersistEvidenceContract(
      emptyEvidenceContract(),
      {
        organizationId: 'org-3',
        artifactType: 'canvas',
        artifactId: 'canvas-2',
        service: 'canvasGraphLlm',
      },
      { writer: { upsertEnvelope }, logger: { warn } }
    );

    expect(ok).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('H5.5 regression: logs via the real logger when no options.logger is passed (as every current caller does)', async () => {
    const upsertEnvelope = vi.fn().mockRejectedValue(new Error('db unavailable'));
    const defaultLoggerModule = await import('../../../../../server/src/utils/Logger.js');
    const warnSpy = vi.spyOn(defaultLoggerModule.default, 'warn').mockImplementation(() => {});

    try {
      const ok = await safePersistEvidenceContract(
        emptyEvidenceContract(),
        {
          organizationId: 'org-4',
          artifactType: 'initiative',
          artifactId: 'initiative-1',
          service: 'assessmentInitiativeService',
        },
        // Mirrors every real call site (InterviewInsightService,
        // presentationGeneratorService, assessmentInitiativeService,
        // documentStudioService, ai/tools/generateDeliverable): no `logger`
        // passed at all. Before the H5.5 fix, this meant the failure vanished
        // with zero trace anywhere — `options?.logger?.warn(...)` was a no-op.
        { writer: { upsertEnvelope } }
      );

      expect(ok).toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('initiative/initiative-1');
    } finally {
      warnSpy.mockRestore();
    }
  });
});
