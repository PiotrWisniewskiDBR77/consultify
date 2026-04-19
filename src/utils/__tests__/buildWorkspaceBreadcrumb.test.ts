/**
 * Chat V9 / NAV-M2-lite — unit tests for the pure breadcrumb
 * builder.
 *
 * Contract we pin:
 *   - Hidden views (AI_CHAT / WELCOME / AUTH) return `null`.
 *   - Missing conversation returns `null` (no "Chat" anchor is
 *     meaningful without one to return to).
 *   - Null / undefined / unknown inputs degrade gracefully to
 *     `null` rather than throw.
 *   - Curated labels win over the humaniser.
 *   - The humaniser is deterministic and Title-Case-with-middot.
 */

import { describe, expect, it } from 'vitest';

import { AppView } from '../../types';
import {
  _humaniseAppViewForTest,
  buildWorkspaceBreadcrumb,
  WORKSPACE_BREADCRUMB_TITLE_MAX,
} from '../buildWorkspaceBreadcrumb';

describe('buildWorkspaceBreadcrumb — visibility rules', () => {
  it.each([AppView.AI_CHAT, AppView.WELCOME, AppView.AUTH])(
    'returns null for hidden view %s',
    (view) => {
      expect(
        buildWorkspaceBreadcrumb({ view, hasActiveConversation: true })
      ).toBeNull();
    }
  );

  it('returns null when there is no active conversation', () => {
    expect(
      buildWorkspaceBreadcrumb({
        view: AppView.ASSESSMENT_SIRI,
        hasActiveConversation: false,
      })
    ).toBeNull();
  });

  it('returns null for nullish view input', () => {
    expect(
      buildWorkspaceBreadcrumb({ view: null, hasActiveConversation: true })
    ).toBeNull();
    expect(
      buildWorkspaceBreadcrumb({ view: undefined, hasActiveConversation: true })
    ).toBeNull();
  });
});

describe('buildWorkspaceBreadcrumb — segments shape', () => {
  it('always opens with a clickable Chat segment', () => {
    const result = buildWorkspaceBreadcrumb({
      view: AppView.ASSESSMENT_SIRI,
      hasActiveConversation: true,
    });
    expect(result).not.toBeNull();
    expect(result?.segments[0]).toEqual({ label: 'Chat', role: 'chat-link' });
  });

  it('marks the last segment as current (not clickable)', () => {
    const result = buildWorkspaceBreadcrumb({
      view: AppView.ASSESSMENT_SIRI,
      hasActiveConversation: true,
    });
    const last = result?.segments[result.segments.length - 1];
    expect(last?.role).toBe('current');
  });

  it('uses the curated label when one is defined', () => {
    const result = buildWorkspaceBreadcrumb({
      view: AppView.ASSESSMENT_SIRI,
      hasActiveConversation: true,
    });
    expect(result?.segments[1]?.label).toBe('Assessment · SIRI');
  });

  it('uses the humaniser fallback for an unmapped view', () => {
    const result = buildWorkspaceBreadcrumb({
      view: AppView.PARTNER_COMMISSION,
      hasActiveConversation: true,
    });
    expect(result?.segments[1]?.label).toBe('Partner commission');
  });

  it('keeps the chat and current segments — no three-level hierarchy when conversation segment is disabled', () => {
    const result = buildWorkspaceBreadcrumb({
      view: AppView.DISCOVERY_TOOLS_STRATEGIC,
      hasActiveConversation: true,
    });
    expect(result?.segments).toHaveLength(2);
    expect(result?.segments[1]?.label).toBe('Discovery Tools · Strategic');
  });
});

describe('buildWorkspaceBreadcrumb — NAV-M2-lite+ conversation title segment', () => {
  it('ignores the title when the conversation segment is not enabled', () => {
    const result = buildWorkspaceBreadcrumb({
      view: AppView.ASSESSMENT_SIRI,
      hasActiveConversation: true,
      conversationTitle: 'SIRI rollout Q3',
      conversationSegmentEnabled: false,
    });
    expect(result?.segments).toHaveLength(2);
    expect(result?.segments[1]?.role).toBe('current');
  });

  it('falls back to 2-segment shape for null / blank / whitespace titles', () => {
    for (const title of [null, undefined, '', '   ', '\t\n']) {
      const result = buildWorkspaceBreadcrumb({
        view: AppView.ASSESSMENT_SIRI,
        hasActiveConversation: true,
        conversationTitle: title as string | null | undefined,
        conversationSegmentEnabled: true,
      });
      expect(result?.segments).toHaveLength(2);
      expect(result?.segments[1]?.role).toBe('current');
    }
  });

  it('emits a 3-segment shape when a non-empty title is provided', () => {
    const result = buildWorkspaceBreadcrumb({
      view: AppView.ASSESSMENT_SIRI,
      hasActiveConversation: true,
      conversationTitle: 'SIRI rollout Q3',
      conversationSegmentEnabled: true,
    });
    expect(result?.segments).toHaveLength(3);
    expect(result?.segments[0]).toEqual({ label: 'Chat', role: 'chat-link' });
    expect(result?.segments[1]?.role).toBe('view');
    expect(result?.segments[1]?.label).toBe('Assessment · SIRI');
    expect(result?.segments[2]?.role).toBe('current');
    expect(result?.segments[2]?.label).toBe('SIRI rollout Q3');
  });

  it('trims surrounding whitespace from the conversation title', () => {
    const result = buildWorkspaceBreadcrumb({
      view: AppView.ASSESSMENT_SIRI,
      hasActiveConversation: true,
      conversationTitle: '   SIRI rollout Q3   ',
      conversationSegmentEnabled: true,
    });
    expect(result?.segments[2]?.label).toBe('SIRI rollout Q3');
    expect(result?.segments[2]?.title).toBeUndefined();
  });

  it('truncates titles longer than the configured cap and preserves the full title as tooltip', () => {
    const longTitle = 'A'.repeat(WORKSPACE_BREADCRUMB_TITLE_MAX + 10);
    const result = buildWorkspaceBreadcrumb({
      view: AppView.ASSESSMENT_SIRI,
      hasActiveConversation: true,
      conversationTitle: longTitle,
      conversationSegmentEnabled: true,
    });
    const last = result?.segments[2];
    expect(last?.label).not.toBe(longTitle);
    expect(last?.label?.endsWith('\u2026')).toBe(true);
    expect(last?.label?.length).toBeLessThanOrEqual(WORKSPACE_BREADCRUMB_TITLE_MAX);
    expect(last?.title).toBe(longTitle);
  });

  it('does not attach a tooltip when the title fits', () => {
    const result = buildWorkspaceBreadcrumb({
      view: AppView.ASSESSMENT_SIRI,
      hasActiveConversation: true,
      conversationTitle: 'Short one',
      conversationSegmentEnabled: true,
    });
    expect(result?.segments[2]?.title).toBeUndefined();
  });

  it('still returns null for hidden views even when a title is present', () => {
    expect(
      buildWorkspaceBreadcrumb({
        view: AppView.AI_CHAT,
        hasActiveConversation: true,
        conversationTitle: 'SIRI rollout',
        conversationSegmentEnabled: true,
      })
    ).toBeNull();
  });

  it('still returns null when there is no active conversation even when a title is present', () => {
    expect(
      buildWorkspaceBreadcrumb({
        view: AppView.ASSESSMENT_SIRI,
        hasActiveConversation: false,
        conversationTitle: 'SIRI rollout',
        conversationSegmentEnabled: true,
      })
    ).toBeNull();
  });
});

describe('_humaniseAppViewForTest — deterministic fallback formatter', () => {
  it('renders a one-word token as Title Case', () => {
    expect(_humaniseAppViewForTest('DASHBOARD')).toBe('Dashboard');
  });

  it('renders a two-word token as "First Second"', () => {
    expect(_humaniseAppViewForTest('PARTNER_COMMISSION')).toBe('Partner commission');
  });

  it('splits 3+ chunks into "<Head> · <Rest>"', () => {
    expect(_humaniseAppViewForTest('ASSESSMENT_DIGITAL_EXTERNAL')).toBe(
      'Assessment · Digital external'
    );
  });

  it('collapses consecutive underscores without producing empty chunks', () => {
    expect(_humaniseAppViewForTest('FULL__STEP1__ASSESSMENT')).toBe(
      'Full · Step1 assessment'
    );
  });

  it('falls back to "View" for empty / whitespace input', () => {
    expect(_humaniseAppViewForTest('')).toBe('View');
    expect(_humaniseAppViewForTest('   ')).toBe('View');
  });
});
