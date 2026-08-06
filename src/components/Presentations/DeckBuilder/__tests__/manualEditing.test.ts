import { describe, expect, it } from 'vitest';

import {
  blockContentStyle,
  blockFrameStyle,
  blockGeometryStyle,
  mergeStarterBlockContent,
  resolveBlankCardInsertionIndex,
} from '../manualEditing';

describe('manual PowerPoint editing helpers', () => {
  it('appends when React passes a click event to New slide', () => {
    expect(resolveBlankCardInsertionIndex({ type: 'click' }, 8)).toBe(8);
  });

  it('keeps numeric gap insertion and clamps it to the deck', () => {
    expect(resolveBlankCardInsertionIndex(3, 8)).toBe(3);
    expect(resolveBlankCardInsertionIndex(-5, 8)).toBe(0);
    expect(resolveBlankCardInsertionIndex(99, 8)).toBe(8);
  });

  it('keeps editable starter data when a toolbar chooses only a variant', () => {
    expect(
      mergeStarterBlockContent(
        { chartType: 'bar', data: [{ label: 'A', value: 30 }] },
        { chartType: 'line' }
      )
    ).toEqual({ chartType: 'line', data: [{ label: 'A', value: 30 }] });
  });

  it('maps the full manual typography contract to renderable CSS', () => {
    expect(
      blockContentStyle({
        style: {
          fontFamily: 'Georgia',
          fontSize: '28',
          fontWeight: '700',
          fontStyle: 'italic',
          textDecoration: 'underline',
          lineHeight: '1.4',
          letterSpacing: '0.5',
          textAlign: 'center',
        },
      })
    ).toMatchObject({
      fontFamily: 'Georgia',
      fontSize: '28px',
      fontWeight: '700',
      fontStyle: 'italic',
      textDecoration: 'underline',
      lineHeight: 1.4,
      letterSpacing: '0.5px',
      textAlign: 'center',
    });
  });

  it('clamps model-safe block resize and placement values', () => {
    expect(blockFrameStyle({ widthPercent: '150', minHeight: '48', alignSelf: 'center' })).toEqual({
      width: '100%',
      minHeight: '48px',
      alignSelf: 'center',
    });
    expect(blockFrameStyle({ widthPercent: '5', alignSelf: 'flex-start' }).width).toBe('10%');
  });

  it('renders opted-in freeform geometry as absolute slide percentages', () => {
    expect(blockGeometryStyle({ x: 10, y: 20, width: 40, height: 30, rotation: 15 })).toMatchObject(
      {
        position: 'absolute',
        left: '10%',
        top: '20%',
        width: '40%',
        height: '30%',
        transform: 'rotate(15deg)',
      }
    );
    expect(blockGeometryStyle()).toEqual({});
  });
});
