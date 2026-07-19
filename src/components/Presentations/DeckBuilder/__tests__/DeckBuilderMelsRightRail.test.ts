/**
 * @vitest-environment node
 *
 * Unit tests for `buildDeckBuilderRightRailTools` (EE / Deliverables WS-A4).
 */

import { describe, expect, it } from 'vitest';

import { buildDeckBuilderRightRailTools } from '../DeckBuilderMelsRightRail';

describe('buildDeckBuilderRightRailTools', () => {
  it('returns the canvas-adjacent tools in order (no media/evidence by default)', () => {
    const tools = buildDeckBuilderRightRailTools({});
    // J12-S3: Media is omitted unless the caller supplies a media panel
    // (DeckBuilder does not — the library is reached via the Blocks panel),
    // so an empty "Media" tool never hangs on the rail.
    expect(tools.map((t) => t.id)).toEqual(['blocks', 'comments', 'activity', 'relations']);
  });

  it('includes the Media tool only when includeMedia is set', () => {
    const tools = buildDeckBuilderRightRailTools({ includeMedia: true });
    expect(tools.map((t) => t.id)).toContain('media');
    expect(tools.map((t) => t.id)).toEqual([
      'blocks',
      'media',
      'comments',
      'activity',
      'relations',
    ]);
  });

  it('appends the Evidence tool when includeEvidence is set', () => {
    const tools = buildDeckBuilderRightRailTools({ includeEvidence: true });
    expect(tools[tools.length - 1]?.id).toBe('evidence');
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
