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
    const axis1 = DRD_STRUCTURE[0]; // "Digital Processes" — levelCount 7 (ASM-001A fixture)
    const areaA = axis1.areas[0].id;
    const answers = { areas: { [areaA]: { achievedLevel: 3, targetLevel: 5 } } };
    render(
      <DRDForm data={areasToFormData(answers)} onChange={vi.fn()} showProgress />
    );
    // Axis tabs present (first axis name shown).
    expect(screen.getAllByText(new RegExp(axis1.name, 'i')).length).toBeGreaterThan(0);
    // ASM-001A: axis summary denominator must be the AXIS's own levelCount (7
    // for "Digital Processes"), never a hardcoded /5. Before the fix this
    // rendered "3/5" (wrong denominator for a 7-level axis).
    expect(axis1.levelCount).toBe(7);
    expect(screen.getByText(`3/${axis1.levelCount}`)).toBeTruthy();
    expect(screen.queryByText('3/5')).toBeNull();
  });
});

describe('DRDForm — per-axis levelCount (ASM-001A fix: no hardcoded 1-5)', () => {
  // Real fixture from drdStructure.ts: Axis 1 "Digital Processes" has
  // levelCount: 7 (confirmed 7 areas x 7 levels each, e.g. area "1A").
  const axis7Levels = DRD_STRUCTURE.find((a) => a.levelCount === 7)!;
  // A levelCount:5 axis whose name doesn't collide with one of its own area
  // names (axis "Digital Products" has an area ALSO named "Digital Products",
  // which would make text queries ambiguous) — resolves to "Digital Business
  // Models" (axis 3).
  const axis5Levels = DRD_STRUCTURE.find(
    (a) => a.levelCount === 5 && !a.areas.some((ar) => ar.name === a.name)
  )!;

  it(`offers levels 1-${axis7Levels.levelCount} for "${axis7Levels.name}" (levelCount ${axis7Levels.levelCount}) and writes level 6/7 to onChange`, () => {
    const onChange = vi.fn();
    const area = axis7Levels.areas[0];
    render(<DRDForm data={{}} onChange={onChange} showProgress={false} />);

    // Axis 1 is the default active tab — expand its first area.
    fireEvent.click(screen.getByText(area.name));

    // "Current Level" text also appears in the always-visible axis summary
    // <p> block — scope to the expanded area's <label> (the level-selector one).
    const currentLevelLabel = screen
      .getAllByText('Current Level')
      .find((el) => el.tagName === 'LABEL') as HTMLElement;
    const selector = currentLevelLabel.parentElement as HTMLElement;
    const buttons = within(selector).getAllByRole('button');

    // Exactly levelCount buttons — not clamped to 5, not overflowing either.
    expect(buttons.map((b) => b.textContent)).toEqual(
      Array.from({ length: axis7Levels.levelCount }, (_, i) => String(i + 1))
    );

    // Level 6 is selectable (would not exist under the old [1,2,3,4,5] hardcode).
    fireEvent.click(within(selector).getByText('6'));
    expect(onChange).toHaveBeenCalledTimes(1);
    let next = onChange.mock.calls[0][0];
    // DRDForm's native onChange shape: { [axisKey]: { areaScores: { [areaId]: [actual, target] } } }.
    const axisKey = Object.keys(next)[0];
    expect(next[axisKey].areaScores[area.id]).toEqual([6, 0]);

    // Level 7 is also selectable.
    onChange.mockClear();
    fireEvent.click(within(selector).getByText('7'));
    expect(onChange).toHaveBeenCalledTimes(1);
    next = onChange.mock.calls[0][0];
    expect(next[axisKey].areaScores[area.id]).toEqual([7, 0]);
  });

  it(`regression: "${axis5Levels.name}" (levelCount ${axis5Levels.levelCount}) still offers exactly ${axis5Levels.levelCount} levels, unchanged`, () => {
    const onChange = vi.fn();
    const area = axis5Levels.areas[0];
    render(<DRDForm data={{}} onChange={onChange} showProgress={false} />);

    // Switch to the axis-under-test's tab (not the default axis 1). Scoped to
    // role=button so this can't accidentally match an area card whose name
    // happens to equal the axis name (e.g. axis "Digital Products" / area "2A
    // Digital Products") — a button's accessible name there is longer
    // (id + score text), so only the tab itself matches. Regex (not exact
    // string) because the tab's accessible name also folds in the mobile-only
    // "<axis.id>" span text (jsdom ignores the `sm:hidden` Tailwind class).
    fireEvent.click(screen.getByRole('button', { name: new RegExp(axis5Levels.name) }));
    fireEvent.click(screen.getByText(area.name));

    // "Current Level" text also appears in the always-visible axis summary
    // <p> block — scope to the expanded area's <label> (the level-selector one).
    const currentLevelLabel = screen
      .getAllByText('Current Level')
      .find((el) => el.tagName === 'LABEL') as HTMLElement;
    const selector = currentLevelLabel.parentElement as HTMLElement;
    const buttons = within(selector).getAllByRole('button');

    expect(buttons).toHaveLength(5);
    expect(buttons.map((b) => b.textContent)).toEqual(['1', '2', '3', '4', '5']);
  });
});

describe('DRDForm <-> DRDMatrixSession parity for a levelCount=7 axis (ASM-001A reopen scenario)', () => {
  it('achievedLevel:6/targetLevel:7 on a 7-level axis renders as "6" (Matrix) and "6/7" (Form axis summary) — never "6/5" or clamped', () => {
    const axis7Levels = DRD_STRUCTURE.find((a) => a.levelCount === 7)!;
    const area = axis7Levels.areas[0];
    const answers = { areas: { [area.id]: { achievedLevel: 6, targetLevel: 7 } } };

    // --- Form side: same reopen data flows through the real adapter. ---
    const { unmount } = render(
      <DRDForm data={areasToFormData(answers)} onChange={vi.fn()} showProgress={false} />
    );
    expect(screen.getByText(`6/${axis7Levels.levelCount}`)).toBeTruthy();
    expect(screen.queryByText('6/5')).toBeNull();
    unmount();

    // --- Matrix side: same canonical answers, no adapter needed. ---
    render(
      <DRDMatrixSession
        value={answers}
        onChange={vi.fn()}
        currentAxisId={axis7Levels.id}
        currentAreaId={area.id}
        onAxisChange={vi.fn()}
      />
    );
    const overview = screen.getByText('Matrix overview').closest('aside')!;
    const cell = within(overview)
      .getAllByTitle(new RegExp(area.name, 'i'))
      .find((el) => el.className.includes('bg-c-tag-'));
    expect(cell).toBeTruthy();
    // Achieved level shown as the raw number 6 (not clamped, not "6/5").
    expect(within(cell as HTMLElement).getByText('6')).toBeTruthy();
    // Target level (TO-BE) chip shows 7.
    expect(within(cell as HTMLElement).getByText('7')).toBeTruthy();
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
