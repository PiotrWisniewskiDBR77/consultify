/**
 * @vitest-environment jsdom
 *
 * D-127 (Wpis 205) — kanoniczny wzorzec przepełnienia rzędu chipów „+N",
 * testowany w JĄDRZE (nie per ekran). `fitChipRow` jest czysta (bez DOM-u), więc
 * jej dowód mutacyjny jest deterministyczny; `ChipOverflowRow` jest testowany na
 * atrapie szerokości (`clientWidth`/`offsetWidth`), bo jsdom nie mierzy layoutu.
 */
import { render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChipOverflowRow, fitChipRow } from '../index';
import { MetaChip } from '../MetaChip';

describe('fitChipRow — pure overflow helper (kanon D-127)', () => {
  const GAP = 4;

  it('returns every chip when they all fit (no "+N")', () => {
    // 64 + 96 + one gap = 164 ≤ 200
    expect(fitChipRow([64, 96], 28, 200, GAP)).toBe(2);
  });

  it('returns the largest whole-chip count that still leaves room for "+N"', () => {
    // chip0 + gap + plus = 64 + 4 + 28 = 96 ≤ 145, but both chips = 164 > 145
    expect(fitChipRow([64, 96], 28, 145, GAP)).toBe(1);
  });

  it('returns 0 when even the first chip + "+N" does not fit', () => {
    expect(fitChipRow([64, 96], 28, 60, GAP)).toBe(0);
  });

  it('keeps a single long chip (never slices it, "+N" would be pointless)', () => {
    // n=1: all-fits check 67 ≤ 145 → 1; the loop only runs to n-1 so a lone chip
    // is never replaced by "+1".
    expect(fitChipRow([67], 28, 145, GAP)).toBe(1);
  });

  it('returns 0 for an empty chip list', () => {
    expect(fitChipRow([], 28, 145, GAP)).toBe(0);
  });

  it('shows everything when the box is unmeasured (avail<=0, jsdom guard)', () => {
    expect(fitChipRow([64, 96, 120], 28, 0, GAP)).toBe(3);
  });
});

describe('ChipOverflowRow — render wiring ( jądro )', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const chips = (labels: string[]) =>
    labels.map((label) => <MetaChip key={label} label={label} className="shrink-0" />);

  it('collapses an overflowing row to whole chips + "+N", never a sliced chip', () => {
    // Pudełko 230 px, chip = 10 px/znak. Trzy chipy (80 + 130 + 70 + 2×4 = 288)
    // nie mieszczą się; mieści się pierwszy + „+2" (80 + 4 + 20 = 104 ≤ 230),
    // drugi już nie (210 + 8 + 20 = 238).
    // DOWÓD WPIĘCIA: ChipOverflowRow naprawdę woła fitChipRow i renderuje „+N".
    // Mutacja: `return n` w fitChipRow (zawsze wszystko) → brak „+2" → RED.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(230);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement
    ) {
      return (this.textContent || '').length * 10;
    });

    const { container } = render(
      <ChipOverflowRow items={chips(['operacje', 'automatyzacja', 'raporty'])} title="a, b, c" />
    );
    const box = container.querySelector('div[title="a, b, c"]');
    expect(box).not.toBeNull();

    const visible = Array.from(box!.querySelectorAll(':scope > span')).map((el) => el.textContent);
    expect(visible).toEqual(['operacje', '+2']);
  });

  it('shows every chip with no "+N" when the row fits', () => {
    // 230 px box, chip = 10 px/znak: 'rynek'(50) + 'DE'(20) + gap(4) = 74 ≤ 230.
    // Mutacja: `allWidth <= avail → return 0` → brak chipów → RED.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(230);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement
    ) {
      return (this.textContent || '').length * 10;
    });

    const { container } = render(<ChipOverflowRow items={chips(['rynek', 'DE'])} title="rynek, DE" />);
    const box = container.querySelector('div[title="rynek, DE"]');
    const visible = Array.from(box!.querySelectorAll(':scope > span')).map((el) => el.textContent);
    expect(visible).toEqual(['rynek', 'DE']);
  });

  it('honours a custom overflow label', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(60);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement
    ) {
      return (this.textContent || '').length * 10;
    });

    const { container } = render(
      <ChipOverflowRow
        items={chips(['operacje', 'automatyzacja'])}
        title="t"
        overflowLabel={(hidden) => `${hidden} more`}
      />
    );
    const box = container.querySelector('div[title="t"]');
    const visible = Array.from(box!.querySelectorAll(':scope > span')).map((el) => el.textContent);
    expect(visible).toEqual(['2 more']);
  });
});
