/**
 * @vitest-environment jsdom
 *
 * DRDMatrixSession — verifies the DRD assessment session's matrix surface:
 *  1. Renders (matrix present) from the canonical answers.drd.areas shape.
 *  2. Clicking a level calls onChange with the SAME answers shape DRDAssessmentEditor
 *     writes (answers.areas[areaId].achievedLevel) — NOT a scoreSummary (P28).
 *  3. Hydration: an area with achievedLevel N shows the color-graded cell (level N).
 *
 * Plus the Form <-> canonical adapter round-trip that keeps Form/Table/Matrix
 * interoperable on one source of truth.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DRDMatrixSession } from '../../../src/components/assessment/drd/DRDMatrixSession';
import {
  areasToFormData,
  formDataToAreas,
} from '../../../src/components/assessment/drd/drdAnswersAdapter';
import { DRDForm } from '../../../src/components/assessment/tools/DRDForm';
import { DRD_STRUCTURE, getQuestionsForAxis } from '../../../src/services/drdStructure';

// react-i18next: minimal stub so components using useTranslation render.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback ?? _k,
    i18n: { language: 'en' },
  }),
}));

// framer-motion: pass-through motion elements (avoid animation timers in jsdom).
vi.mock('framer-motion', () => {
  const MOTION_ONLY = new Set([
    'whileHover',
    'whileTap',
    'initial',
    'animate',
    'exit',
    'transition',
    'layout',
  ]);
  const passthrough = new Proxy(
    {},
    {
      get:
        (_t, tag: string) =>
        (props: any) => {
          const { children, ...rest } = props || {};
          const clean: Record<string, unknown> = {};
          for (const k of Object.keys(rest)) {
            if (!MOTION_ONLY.has(k)) clean[k] = rest[k];
          }
          return React.createElement(typeof tag === 'string' ? tag : 'div', clean, children);
        },
    }
  );
  return {
    motion: passthrough,
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  };
});

describe('DRDMatrixSession', () => {
  const axis1 = DRD_STRUCTURE[0];
  const firstArea = getQuestionsForAxis(axis1.id)[0];

  it('renders the matrix surface with the axis areas', () => {
    render(
      <DRDMatrixSession
        value={{ areas: {} }}
        onChange={vi.fn()}
        currentAxisId={axis1.id}
        onAxisChange={vi.fn()}
      />
    );
    // Matrix overview panel is present.
    expect(screen.getByText('Matrix overview')).toBeTruthy();
    // The first area label appears (matrix content rendered).
    expect(screen.getAllByText(new RegExp(firstArea.name, 'i')).length).toBeGreaterThan(0);
  });

  it('click on a level writes answers.areas[areaId].achievedLevel (canonical shape, no scoreSummary)', () => {
    const onChange = vi.fn();
    render(
      <DRDMatrixSession
        value={{ areas: {} }}
        onChange={onChange}
        currentAxisId={axis1.id}
        onAxisChange={vi.fn()}
      />
    );

    // MaturityMatrix renders each level of the selected area as a clickable button
    // whose title text is the level title. Click level 3's button.
    const level3 = firstArea.levels.find((l) => l.level === 3)!;
    // The level title is unique within the selected area's level grid.
    const levelButton = screen.getByText(level3.title);
    fireEvent.click(levelButton);

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    // Canonical shape.
    expect(next).toHaveProperty('areas');
    expect(next.areas[firstArea.id]).toEqual(
      expect.objectContaining({ achievedLevel: 3 })
    );
    // P28: never fabricate a scoreSummary here.
    expect(next).not.toHaveProperty('scoreSummary');
  });

  it('hydrates cell color from an existing achievedLevel', () => {
    const value = { areas: { [firstArea.id]: { achievedLevel: 4 } } };
    render(
      <DRDMatrixSession
        value={value}
        onChange={vi.fn()}
        currentAxisId={axis1.id}
        currentAreaId={firstArea.id}
        onAxisChange={vi.fn()}
      />
    );
    // The overview cell for the area shows its numeric achieved level (4) and
    // carries a level-ramp color class (bg-c-tag-*), proving color hydration.
    const overview = screen.getByText('Matrix overview').closest('aside')!;
    const cell = within(overview)
      .getAllByTitle(new RegExp(firstArea.name, 'i'))
      .find((el) => el.className.includes('bg-c-tag-'));
    expect(cell).toBeTruthy();
    expect(within(cell as HTMLElement).getByText('4')).toBeTruthy();
  });
});

describe('DRDForm (Piotr original) renders as the default DRD session surface', () => {
  it('renders without error and reflects hydrated area scores from the adapter', () => {
    const areaA = DRD_STRUCTURE[0].areas[0].id;
    const answers = { areas: { [areaA]: { achievedLevel: 3, targetLevel: 5 } } };
    render(
      <DRDForm data={areasToFormData(answers)} onChange={vi.fn()} showProgress />
    );
    // Axis tabs present (first axis name shown).
    expect(screen.getAllByText(new RegExp(DRD_STRUCTURE[0].name, 'i')).length).toBeGreaterThan(0);
    // Hydrated axis summary reflects the actual score (3/5).
    expect(screen.getByText('3/5')).toBeTruthy();
  });
});

describe('drdAnswersAdapter round-trip (Form <-> canonical)', () => {
  const areaA = DRD_STRUCTURE[0].areas[0].id; // axis 1 area
  const areaB = DRD_STRUCTURE[0].areas[1].id;

  it('areasToFormData maps achievedLevel/targetLevel into per-axis areaScores', () => {
    const answers = {
      areas: {
        [areaA]: { achievedLevel: 2, targetLevel: 4 },
        [areaB]: { achievedLevel: 3, targetLevel: 5 },
      },
    };
    const form = areasToFormData(answers);
    expect(form.processes?.areaScores?.[areaA]).toEqual([2, 4]);
    expect(form.processes?.areaScores?.[areaB]).toEqual([3, 5]);
    // Axis average recomputed like DRDForm does.
    expect(form.processes?.actual).toBeCloseTo(2.5, 5);
    expect(form.processes?.target).toBeCloseTo(4.5, 5);
  });

  it('formDataToAreas merges back and preserves richer per-area fields (notes)', () => {
    const prev = {
      areas: {
        [areaA]: { achievedLevel: 1, targetLevel: 2, levelNotes: { '1': 'evidence' } },
      },
    };
    const form = {
      processes: {
        actual: 3,
        target: 4,
        areaScores: { [areaA]: [3, 4] as [number, number] },
      },
    };
    const next = formDataToAreas(form, prev);
    expect(next.areas?.[areaA]).toEqual(
      expect.objectContaining({
        achievedLevel: 3,
        targetLevel: 4,
        levelNotes: { '1': 'evidence' }, // preserved from Table-authored data
      })
    );
  });

  it('round-trips canonical -> form -> canonical without loss of scores', () => {
    const answers = {
      areas: {
        [areaA]: { achievedLevel: 5, targetLevel: 5 },
        [areaB]: { achievedLevel: 2, targetLevel: 4 },
      },
    };
    const back = formDataToAreas(areasToFormData(answers), answers);
    expect(back.areas?.[areaA]).toEqual(
      expect.objectContaining({ achievedLevel: 5, targetLevel: 5 })
    );
    expect(back.areas?.[areaB]).toEqual(
      expect.objectContaining({ achievedLevel: 2, targetLevel: 4 })
    );
  });
});
