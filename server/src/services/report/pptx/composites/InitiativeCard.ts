/**
 * Composite: Initiative Card (PPTX)
 * Single strategic initiative displayed as a compact card with:
 * - Intent color bar, priority badge, name, summary
 * - Impact/effort dot scales
 * - Optional effort profile mini-bars
 * - Timeline + owner metadata
 */
import { Badge } from '../atomics/Badge.js';
import { BodyText } from '../atomics/BodyText.js';
import { DotScale } from '../atomics/DotScale.js';
import { priorityColor, strategicIntentColor } from '../designTokens.js';
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';
import { EffortProfileBar } from './EffortProfileBar.js';

export interface InitiativeCardItem {
  name: string;
  summary?: string;
  strategicIntent?: string;
  strategicRole?: string;
  priority?: string;
  timeline?: string;
  impact?: number;
  effort?: number;
  effortProfile?: { analytical: number; operational: number; change: number };
  budget?: string;
  roi?: string;
  owner?: string;
  relatedGap?: string;
  tags?: string[];
}

export interface InitiativeCardProps {
  item: InitiativeCardItem;
  position: ElementPosition;
  showEffortBars?: boolean;
}

export function InitiativeCard(
  props: InitiativeCardProps,
  tokens: DesignTokens
): RenderedElement[] {
  const { item, position: p } = props;
  const elements: RenderedElement[] = [];
  const intentColor = strategicIntentColor(item.strategicIntent || '');
  const prioColor = priorityColor(item.priority || 'medium', tokens);

  // ── Card background ──
  elements.push({
    kind: 'shape',
    apply(slide) {
      slide.addShape('roundRect', {
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        fill: { color: tokens.colors.surface },
        line: { color: tokens.colors.border, width: 0.5 },
        rectRadius: 0.06,
      });
      // Intent accent bar (top)
      slide.addShape('rect', {
        x: p.x,
        y: p.y,
        w: p.w,
        h: 0.05,
        fill: { color: intentColor },
      });
    },
  });

  // ── Priority badge (top-right) ──
  if (item.priority) {
    elements.push(
      Badge(
        {
          text: item.priority,
          position: { x: p.x + p.w - 0.75, y: p.y + 0.12, w: 0.65, h: 0.2 },
          bgColor: prioColor,
        },
        tokens
      )
    );
  }

  // ── Strategic intent badge (top-left) ──
  if (item.strategicIntent) {
    elements.push(
      Badge(
        {
          text: item.strategicIntent,
          position: { x: p.x + 0.12, y: p.y + 0.12, w: 1.0, h: 0.2 },
          bgColor: intentColor,
        },
        tokens
      )
    );
  }

  // ── Adaptive vertical rhythm ──
  // Tall cards (few initiatives) get extra breathing room between blocks so the
  // content fills the card instead of clustering at the top (anti-sparseness).
  const roomy = p.h >= 2.6;
  const blockGap = roomy ? 0.18 : 0.0;

  // ── Name ──
  let currentY = p.y + 0.4 + (roomy ? 0.15 : 0);
  elements.push(
    BodyText(
      {
        text: item.name,
        position: { x: p.x + 0.12, y: currentY, w: p.w - 0.24, h: roomy ? 0.35 : 0.25 },
        bold: true,
        fontSize: roomy ? tokens.fontSizes.subheading : tokens.fontSizes.subheading - 2,
      },
      tokens
    )
  );
  currentY += (roomy ? 0.4 : 0.28) + blockGap;

  // ── Summary ──
  if (item.summary) {
    const sumH = roomy ? 0.7 : 0.4;
    elements.push(
      BodyText(
        {
          text: item.summary,
          position: { x: p.x + 0.12, y: currentY, w: p.w - 0.24, h: sumH },
          color: tokens.colors.textSecondary,
          fontSize: roomy ? 11 : 10,
        },
        tokens
      )
    );
    currentY += sumH + 0.04 + blockGap;
  }

  // ── Impact / Effort dots ──
  if (item.impact !== undefined || item.effort !== undefined) {
    if (item.impact !== undefined) {
      elements.push(
        DotScale(
          {
            value: item.impact,
            label: 'Impact',
            position: { x: p.x + 0.12, y: currentY, w: (p.w - 0.36) / 2, h: 0.18 },
            fillColor: tokens.colors.success,
          },
          tokens
        )
      );
    }
    if (item.effort !== undefined) {
      elements.push(
        DotScale(
          {
            value: item.effort,
            label: 'Effort',
            position: {
              x: p.x + 0.12 + (p.w - 0.36) / 2 + 0.12,
              y: currentY,
              w: (p.w - 0.36) / 2,
              h: 0.18,
            },
            fillColor: tokens.colors.warning,
          },
          tokens
        )
      );
    }
    currentY += 0.22 + blockGap;
  }

  // ── Effort Profile ──
  if (props.showEffortBars && item.effortProfile) {
    const epH = roomy ? 0.6 : 0.4;
    const epElements = EffortProfileBar(
      {
        analytical: item.effortProfile.analytical,
        operational: item.effortProfile.operational,
        change: item.effortProfile.change,
        position: { x: p.x + 0.12, y: currentY, w: p.w - 0.24, h: epH },
      },
      tokens
    );
    elements.push(...epElements);
    currentY += epH + 0.02 + blockGap;
  }

  // ── Metadata row: timeline + owner ──
  const metaY = Math.max(currentY, p.y + p.h - 0.3);
  const metaParts: string[] = [];
  if (item.timeline) metaParts.push(`⏱ ${item.timeline}`);
  if (item.owner) metaParts.push(`👤 ${item.owner}`);
  if (item.budget) metaParts.push(`💰 ${item.budget}`);
  if (item.roi) metaParts.push(`↗ ROI ${item.roi}`);

  if (metaParts.length > 0) {
    elements.push(
      BodyText(
        {
          text: metaParts.join('  |  '),
          position: { x: p.x + 0.12, y: metaY, w: p.w - 0.24, h: 0.2 },
          color: tokens.colors.muted,
          fontSize: 8,
        },
        tokens
      )
    );
  }

  // ── Tags row ──
  if (item.tags && item.tags.length > 0) {
    const tagY = metaY + 0.2;
    const tagW = 0.6;
    const tagGap = 0.08;
    const maxTags = Math.min(item.tags.length, Math.floor((p.w - 0.24) / (tagW + tagGap)));

    for (let i = 0; i < maxTags; i++) {
      elements.push(
        Badge(
          {
            text: item.tags[i],
            position: { x: p.x + 0.12 + i * (tagW + tagGap), y: tagY, w: tagW, h: 0.16 },
            bgColor: tokens.colors.border,
            textColor: tokens.colors.textSecondary,
          },
          tokens
        )
      );
    }
  }

  return elements;
}
