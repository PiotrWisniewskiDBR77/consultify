/**
 * @vitest-environment node
 *
 * Unit tests for `buildDeckBuilderRightRailTools` (EE / Deliverables WS-A4).
 */

import { describe, expect, it } from 'vitest';

import { buildDeckBuilderRightRailTools } from '../DeckBuilderMelsRightRail';

describe('buildDeckBuilderRightRailTools', () => {
  it('returns the canvas-adjacent tools in order', () => {
    const tools = buildDeckBuilderRightRailTools({});
    expect(tools.map((t) => t.id)).toEqual(['blocks', 'media', 'activity']);
  });

  it('omits the activity badge when there are no events', () => {
    const tools = buildDeckBuilderRightRailTools({ state: { agentActivityCount: 0 } });
    expect(tools.find((t) => t.id === 'activity')?.badge).toBeUndefined();
  });

  it('renders the activity badge + tone when events exist', () => {
    const tools = buildDeckBuilderRightRailTools({
      state: { agentActivityCount: 3, activityTone: 'info' },
    });
    const activity = tools.find((t) => t.id === 'activity');
    expect(activity?.badge).toBe(3);
    expect(activity?.dotTone).toBe('info');
  });

  it('honours custom labels (PL)', () => {
    const tools = buildDeckBuilderRightRailTools({
      labels: { blocks: 'Bloki', media: 'Media', activity: 'Aktywność' },
    });
    expect(tools.find((t) => t.id === 'blocks')?.label).toBe('Bloki');
  });
});
