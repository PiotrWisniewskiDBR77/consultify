/**
 * RN-G3 lane (KPI full tool, klasa L) — unit tests for the pure label/tone
 * helpers in `src/components/ResultsVNext/kpiTool/kpiToolMappers.ts`.
 *
 * These map the REAL enum values from the server (`DEVIATION_CASE_STATUSES`
 * etc. in `kpiDeviationTypes.ts` / `kpiInitiativeImpactTypes.ts`) — this
 * suite asserts every enum member has a mapping (no silent fallthrough that
 * would render `undefined`/a raw key to the user) and that PL/EN differ
 * where the underlying copy differs.
 */
import { describe, expect, it } from 'vitest';
import {
  correctiveActionStatusLabel,
  CORRECTIVE_ACTION_STATUS_TONE,
  dataQualityStatusLabel,
  DATA_QUALITY_STATUS_TONE,
  deviationCaseStatusLabel,
  deviationSeverityLabel,
  DEVIATION_CASE_STATUS_TONE,
  DEVIATION_SEVERITY_TONE,
  effectivenessVerificationStatusLabel,
  EFFECTIVENESS_VERIFICATION_STATUS_TONE,
  escalatedOverlayLabel,
  initiativeKpiImpactStatusLabel,
  INITIATIVE_KPI_IMPACT_STATUS_TONE,
  kpiApprovalStatusLabel,
  KPI_APPROVAL_STATUS_TONE,
  kpiTargetGeometryLabel,
  performanceStatusLabel,
  PERFORMANCE_STATUS_TONE,
} from '../../../src/components/ResultsVNext/kpiTool/kpiToolMappers';
import { DEVIATION_CASE_STATUSES, DEVIATION_SEVERITIES, CORRECTIVE_ACTION_STATUSES, EFFECTIVENESS_VERIFICATION_STATUSES } from '../../../src/components/ResultsVNext/kpiTool/kpiDeviationApi';
import { INITIATIVE_KPI_IMPACT_STATUSES } from '../../../src/components/ResultsVNext/kpiTool/kpiInitiativeImpactApi';
import { KPI_APPROVAL_STATUSES, KPI_PERFORMANCE_STATUSES, KPI_DATA_QUALITY_STATUSES, KPI_TARGET_GEOMETRIES } from '../../../src/components/ResultsVNext/kpiApi';

describe('kpiToolMappers — deviation case status (9-state machine, KPI_E003_DESIGN.md L75-78)', () => {
  it('has exactly 9 states — never a 10th (escalated is a separate overlay)', () => {
    expect(DEVIATION_CASE_STATUSES).toHaveLength(9);
    expect(DEVIATION_CASE_STATUSES).not.toContain('escalated');
  });

  it('maps every status to a non-empty PL and EN label, and PL/EN differ', () => {
    for (const status of DEVIATION_CASE_STATUSES) {
      const pl = deviationCaseStatusLabel(status, true);
      const en = deviationCaseStatusLabel(status, false);
      expect(pl.length).toBeGreaterThan(0);
      expect(en.length).toBeGreaterThan(0);
      expect(pl).not.toBe(en);
    }
  });

  it('maps every status to a tone (no undefined lookups)', () => {
    for (const status of DEVIATION_CASE_STATUSES) {
      expect(DEVIATION_CASE_STATUS_TONE[status]).toBeDefined();
    }
  });

  it('escalated overlay has its own distinct label, separate from any status label', () => {
    const pl = escalatedOverlayLabel(true);
    const en = escalatedOverlayLabel(false);
    expect(pl).toBe('Eskalowana');
    expect(en).toBe('Escalated');
    for (const status of DEVIATION_CASE_STATUSES) {
      expect(deviationCaseStatusLabel(status, true)).not.toBe(pl);
    }
  });
});

describe('kpiToolMappers — deviation severity', () => {
  it('maps both severities in both languages', () => {
    for (const severity of DEVIATION_SEVERITIES) {
      expect(deviationSeverityLabel(severity, true).length).toBeGreaterThan(0);
      expect(deviationSeverityLabel(severity, false).length).toBeGreaterThan(0);
      expect(DEVIATION_SEVERITY_TONE[severity]).toBeDefined();
    }
  });

  it('critical is the more alarming tone than warning', () => {
    expect(DEVIATION_SEVERITY_TONE.critical).toBe('danger');
    expect(DEVIATION_SEVERITY_TONE.warning).toBe('warning');
  });
});

describe('kpiToolMappers — corrective action status', () => {
  it('maps every CORRECTIVE_ACTION_STATUSES member', () => {
    for (const status of CORRECTIVE_ACTION_STATUSES) {
      expect(correctiveActionStatusLabel(status, true).length).toBeGreaterThan(0);
      expect(correctiveActionStatusLabel(status, false).length).toBeGreaterThan(0);
      expect(CORRECTIVE_ACTION_STATUS_TONE[status]).toBeDefined();
    }
  });
});

describe('kpiToolMappers — effectiveness verification status', () => {
  it('maps every EFFECTIVENESS_VERIFICATION_STATUSES member', () => {
    for (const status of EFFECTIVENESS_VERIFICATION_STATUSES) {
      expect(effectivenessVerificationStatusLabel(status, true).length).toBeGreaterThan(0);
      expect(effectivenessVerificationStatusLabel(status, false).length).toBeGreaterThan(0);
      expect(EFFECTIVENESS_VERIFICATION_STATUS_TONE[status]).toBeDefined();
    }
  });

  it('ineffective is danger tone, effective is success tone — never conflated', () => {
    expect(EFFECTIVENESS_VERIFICATION_STATUS_TONE.ineffective).toBe('danger');
    expect(EFFECTIVENESS_VERIFICATION_STATUS_TONE.effective).toBe('success');
  });
});

describe('kpiToolMappers — initiative KPI impact status', () => {
  it('maps every INITIATIVE_KPI_IMPACT_STATUSES member', () => {
    for (const status of INITIATIVE_KPI_IMPACT_STATUSES) {
      expect(initiativeKpiImpactStatusLabel(status, true).length).toBeGreaterThan(0);
      expect(initiativeKpiImpactStatusLabel(status, false).length).toBeGreaterThan(0);
      expect(INITIATIVE_KPI_IMPACT_STATUS_TONE[status]).toBeDefined();
    }
  });
});

describe('kpiToolMappers — KPI performance / data-quality (independent dimensions, plan §4.3/§4.4)', () => {
  it('maps every performance status', () => {
    for (const status of KPI_PERFORMANCE_STATUSES) {
      expect(performanceStatusLabel(status, true).length).toBeGreaterThan(0);
      expect(PERFORMANCE_STATUS_TONE[status]).toBeDefined();
    }
  });

  it('maps every data-quality status, independently of performance', () => {
    for (const status of KPI_DATA_QUALITY_STATUSES) {
      expect(dataQualityStatusLabel(status, true).length).toBeGreaterThan(0);
      expect(DATA_QUALITY_STATUS_TONE[status]).toBeDefined();
    }
  });

  it('performance and data-quality enums do not overlap (two independent vocabularies)', () => {
    const overlap = KPI_PERFORMANCE_STATUSES.filter((p) => (KPI_DATA_QUALITY_STATUSES as readonly string[]).includes(p));
    expect(overlap).toHaveLength(0);
  });
});

// RN-G6 UI fix (task 3, 2026-08-12) — the Contract section now renders the
// real `getKpiCurrentDefinitionVersion` payload (approvalStatus/targetGeometry)
// instead of only the raw currentDefinitionVersionId; these two maps are the
// helpers that make that readable. Same "every enum member mapped, PL/EN
// differ" discipline as the rest of this file.
describe('kpiToolMappers — KPI approval status (Contract section, RN-G6 P0-D)', () => {
  it('maps every KPI_APPROVAL_STATUSES member to a non-empty PL/EN label + tone', () => {
    for (const status of KPI_APPROVAL_STATUSES) {
      const pl = kpiApprovalStatusLabel(status, true);
      const en = kpiApprovalStatusLabel(status, false);
      expect(pl.length).toBeGreaterThan(0);
      expect(en.length).toBeGreaterThan(0);
      expect(pl).not.toBe(en);
      expect(KPI_APPROVAL_STATUS_TONE[status]).toBeDefined();
    }
  });

  it('approved is success tone, rejected is danger tone — never conflated', () => {
    expect(KPI_APPROVAL_STATUS_TONE.approved).toBe('success');
    expect(KPI_APPROVAL_STATUS_TONE.rejected).toBe('danger');
  });
});

describe('kpiToolMappers — KPI target geometry label (Contract section)', () => {
  it('maps every KPI_TARGET_GEOMETRIES member to a non-empty PL/EN label', () => {
    for (const geometry of KPI_TARGET_GEOMETRIES) {
      const pl = kpiTargetGeometryLabel(geometry, true);
      const en = kpiTargetGeometryLabel(geometry, false);
      expect(pl.length).toBeGreaterThan(0);
      expect(en.length).toBeGreaterThan(0);
      expect(pl).not.toBe(en);
    }
  });
});
