/**
 * Unit coverage for `ScrollEdgeFade` (MYW-PHOTO-003 shared primitive — see
 * `MyWorkHub.photo003.contract.test.ts` for why this exists as a standalone
 * component instead of living only inside the unmounted `MyWorkNav.tsx`).
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScrollEdgeFade } from '../ScrollEdgeFade';

describe('ScrollEdgeFade', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(<ScrollEdgeFade side="end" visible={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an aria-hidden marker with the correct side when visible', () => {
    const { container } = render(<ScrollEdgeFade side="start" visible />);
    const el = container.querySelector('[data-scroll-affordance="start"]');
    expect(el).toBeTruthy();
    expect(el?.getAttribute('aria-hidden')).not.toBeNull();
  });

  it('positions the end affordance on the right edge', () => {
    const { container } = render(<ScrollEdgeFade side="end" visible />);
    const el = container.querySelector('[data-scroll-affordance="end"]');
    expect(el?.className).toContain('right-0');
  });
});
