import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  buildRoiCaseViewsColumns,
  buildRoiCaseViewsPreview,
  type RoiCaseViewRowVm,
} from '../../../../src/components/ResultsVNext/roi/roiCaseFullToolPresenters';

function row(
  benefitsRealizationPct: NonNullable<
    RoiCaseViewRowVm['benefitsRealization']
  >['benefitsRealizationPct']
): RoiCaseViewRowVm {
  return {
    id: 'benefits-realization',
    compare: null,
    benefitsRealization: {
      caseId: 'case-1',
      approvedFinancialBenefits: 200_000,
      actualFinancialBenefits: 125_000,
      benefitsRealizationPct,
    },
  };
}

describe('ROI benefits-realization slot presentation', () => {
  it('renders the canonical available slot as a percentage, never as an object string', () => {
    const summary = buildRoiCaseViewsColumns(false)[1]?.render?.(
      row({ status: 'available', value: 62.5 })
    );
    render(<>{summary}</>);

    expect(screen.getByText('62.5%')).toBeInTheDocument();
    expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument();
  });

  it('preserves the server reason when no Actual has been recorded', () => {
    const summary = buildRoiCaseViewsColumns(false)[1]?.render?.(
      row({ status: 'not_yet_available', reason: 'no_actual_recorded' })
    );
    render(<>{summary}</>);

    expect(screen.getByText('No actual recorded yet')).toBeInTheDocument();
  });

  it('uses the same slot mapping in the preview readback', () => {
    const preview = buildRoiCaseViewsPreview(
      row({ status: 'available', value: 62.5 }),
      false,
      () => undefined
    );
    const pct = preview.details?.properties?.find((property) => property.id === 'pct');
    render(<>{pct?.value}</>);

    expect(screen.getByText('62.5%')).toBeInTheDocument();
  });
});
