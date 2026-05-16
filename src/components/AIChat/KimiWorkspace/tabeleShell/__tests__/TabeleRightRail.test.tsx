/**
 * @vitest-environment jsdom
 *
 * Tests for `buildTabeleRightRailTools` + `<TabeleRightRailPanel>`
 * (EPIC-T16 D5).
 *
 * Coverage:
 *   * Tool order matches MELS spec:
 *     search → ai-editor → qa-report → source-pack → layout → share → analytics.
 *   * AI Editor is disabled when state.aiEditorEnabled === false.
 *   * QA Report shows badge + warning dot when findings > 0.
 *   * Source Pack badge tracks count and tone.
 *   * Custom labels override defaults.
 *   * Panel renderer mounts the matching panel by id.
 *   * Unknown active id falls back to the supplied fallback.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import {
  buildTabeleRightRailTools,
  TabeleRightRailPanel,
} from '../TabeleRightRail';

describe('buildTabeleRightRailTools', () => {
  it('returns tools in the documented MELS spec order', () => {
    const tools = buildTabeleRightRailTools({});
    expect(tools.map((t) => t.id)).toEqual([
      'search',
      'ai-editor',
      'qa-report',
      'source-pack',
      'layout',
      'share',
      'analytics',
    ]);
  });

  it('disables AI Editor when state.aiEditorEnabled=false', () => {
    const tools = buildTabeleRightRailTools({ state: { aiEditorEnabled: false } });
    expect(tools.find((t) => t.id === 'ai-editor')?.disabled).toBe(true);
  });

  it('does not disable AI Editor by default', () => {
    const tools = buildTabeleRightRailTools({});
    expect(tools.find((t) => t.id === 'ai-editor')?.disabled).toBeFalsy();
  });

  it('shows QA badge + warning tone when findings > 0', () => {
    const tools = buildTabeleRightRailTools({ state: { qaFindingsCount: 5 } });
    const qa = tools.find((t) => t.id === 'qa-report');
    expect(qa?.badge).toBe(5);
    expect(qa?.dotTone).toBe('warning');
  });

  it('omits QA badge when findings is 0', () => {
    const tools = buildTabeleRightRailTools({ state: { qaFindingsCount: 0 } });
    const qa = tools.find((t) => t.id === 'qa-report');
    expect(qa?.badge).toBeUndefined();
  });

  it('Source Pack badge + tone reflect supplied state', () => {
    const tools = buildTabeleRightRailTools({
      state: { sourcePackCount: 3, sourcePackTone: 'success' },
    });
    const sp = tools.find((t) => t.id === 'source-pack');
    expect(sp?.badge).toBe(3);
    expect(sp?.dotTone).toBe('success');
  });

  it('honours custom labels', () => {
    const tools = buildTabeleRightRailTools({
      labels: { aiEditor: 'AI Edytor' },
    });
    expect(tools.find((t) => t.id === 'ai-editor')?.label).toBe('AI Edytor');
  });
});

describe('TabeleRightRailPanel', () => {
  const panels = {
    search: <div data-testid="panel-search">Search panel</div>,
    aiEditor: <div data-testid="panel-ai-editor">AI Editor panel</div>,
    qaReport: <div data-testid="panel-qa">QA panel</div>,
  };

  it('renders the panel matching activeToolId', () => {
    render(<TabeleRightRailPanel activeToolId="ai-editor" panels={panels} />);
    expect(screen.getByTestId('panel-ai-editor')).toBeInTheDocument();
  });

  it('renders nothing when activeToolId is null', () => {
    const { container } = render(
      <TabeleRightRailPanel activeToolId={null} panels={panels} />
    );
    expect(container.textContent).toBe('');
  });

  it('renders nothing when no matching panel and no fallback', () => {
    const { container } = render(
      <TabeleRightRailPanel activeToolId="layout" panels={panels} />
    );
    expect(container.textContent).toBe('');
  });

  it('renders fallback when supplied for unknown ids', () => {
    render(
      <TabeleRightRailPanel
        activeToolId="layout"
        panels={panels}
        fallback={<div data-testid="fallback">No panel</div>}
      />
    );
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });
});
