import { describe, expect, it } from 'vitest';
import { deliveryEvidenceFindings } from '../../../server/src/domain/initiatives-execution/deliveryAcceptance';
describe('Delivery acceptance evidence', () => {
  it('fails closed without benefits ownership and KPI contract', () => {
    expect(
      deliveryEvidenceFindings({
        baselineRef: { ref: 'b', version: 1 },
        scopeRef: { ref: 's', version: 1 },
        deliverableRefs: [{ ref: 'd', version: 1 }],
        operationalHandoverRef: { ref: 'o', version: 1 },
        benefitOwnerId: '',
        kpiMeasurementContractRefs: [],
      })
    ).toEqual(['BENEFIT_OWNER_MISSING', 'KPI_MEASUREMENT_CONTRACT_MISSING']);
  });
});
