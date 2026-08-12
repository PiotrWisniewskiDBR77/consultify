/**
 * RolloutRegisterEditModal — Modal.tsx regression check (RN-G5 platform lane,
 * 2026-08-12).
 *
 * This consumer has NO pre-existing test coverage in the repo (confirmed by
 * `find tests -iname "*RolloutRegisterEditModal*"` returning nothing before
 * this file). It is one of 25+ real consumers of the shared
 * `src/components/ui/primitives/Modal.tsx`, whose focus-return behavior on
 * Esc changed in this lane (P1 nr 2). It also matches the "conditional
 * mount" pattern exercised generically in `Modal.focusReturn.test.tsx`
 * (`RoiTransitionDialog` pattern): the caller (`RolloutTab.tsx`) only
 * renders `<RolloutRegisterEditModal target={...} />` once a row is
 * selected, and inside this component `<Modal open onClose={onClose}>` is
 * unconditional — the Modal fiber's first-ever render already has
 * `open=true`. This test proves the generic fix also holds for this real,
 * unmocked consumer, not just the harness in Modal.focusReturn.test.tsx.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  RolloutRegisterEditModal,
  type RolloutEditTarget,
  type RolloutKpiRow,
} from '../../../src/components/Execution/RolloutRegisterEditModal';

const kpiRow: RolloutKpiRow = {
  id: 'kpi-1',
  name: 'Adoption rate',
  baseline: 10,
  target: 90,
  current_value: 40,
  unit: '%',
};

/** Harness: a persistent row "Edit" trigger outside the modal, like RolloutTab renders per row. */
const Harness: React.FC = () => {
  const [target, setTarget] = useState<RolloutEditTarget | null>(null);
  return (
    <div>
      <button type="button" data-testid="edit-trigger" onClick={() => setTarget({ kind: 'kpi', row: kpiRow })}>
        Edit
      </button>
      <RolloutRegisterEditModal
        target={target}
        onClose={() => setTarget(null)}
        onSaveKpi={vi.fn()}
        onSaveRisk={vi.fn()}
        onSaveChange={vi.fn()}
        onSaveClosure={vi.fn()}
      />
    </div>
  );
};

describe('RolloutRegisterEditModal · Modal.tsx focus-return regression (real, untested consumer)', () => {
  it('returns focus to the row trigger on Escape, not <body>', () => {
    render(<Harness />);
    const trigger = screen.getByTestId('edit-trigger');
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
    expect(document.activeElement).not.toBe(document.body);
  });
});
