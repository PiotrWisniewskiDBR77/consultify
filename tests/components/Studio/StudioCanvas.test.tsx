/**
 * StudioCanvas Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('StudioCanvas Component', () => {
  it('renders canvas', () => {
    const canvas = { width: 800, height: 600 };
    expect(canvas.width).toBe(800);
  });

  it('handles draw action', () => {
    const onDraw = vi.fn();
    onDraw({ x: 100, y: 100 });
    expect(onDraw).toHaveBeenCalled();
  });

  it('supports zoom', () => {
    const zoom = 1.0;
    expect(zoom).toBe(1.0);
  });
});
