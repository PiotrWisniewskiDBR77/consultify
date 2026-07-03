/**
 * Composite: Roadmap Band
 * Timeline phases (Now / Next / Later) rendered as full-height column cards.
 *
 * W7 anti-sparseness:
 *  - Phase headers use a single-hue progression (primary → secondary, stepped by
 *    phase index) instead of a random success/info/secondary traffic-light. Reads
 *    as one confident, sequenced palette.
 *  - Each card carries a large phase number (watermark) and the bullets are
 *    distributed down the card body so it fills, not clings to the top.
 *  - A timeframe pill is anchored at the bottom of every card.
 */
import { BodyText } from '../atomics/BodyText.js';
import { Bullet } from '../atomics/Bullet.js';
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface RoadmapBandProps {
  phases: Array<{
    label: string;
    timeframe: string;
    items: string[];
    status?: 'completed' | 'in_progress' | 'planned';
  }>;
  position: ElementPosition;
}

/** Parse a 6-digit hex (no #) into [r,g,b]. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** Linear blend between two hex colors. t=0 → a, t=1 → b. */
function lerpHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex([
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
  ]);
}

export function RoadmapBand(props: RoadmapBandProps, tokens: DesignTokens): RenderedElement[] {
  const { phases, position: p } = props;
  const elements: RenderedElement[] = [];
  const count = phases.length;
  if (count === 0) return elements;

  const colW = (p.w - tokens.spacing.gutter * (count - 1)) / count;
  const headerH = 0.62;
  const pillH = 0.34;
  const pillGap = 0.16;

  for (let i = 0; i < count; i++) {
    const phase = phases[i];
    const colX = p.x + i * (colW + tokens.spacing.gutter);

    // Single-hue progression: primary (earliest) → secondary (latest), stepped
    // evenly by phase index. One column → just primary.
    const t = count > 1 ? i / (count - 1) : 0;
    const bandColor = lerpHex(tokens.colors.primary, tokens.colors.secondary, t);
    // A lighter tint of the same hue for the watermark number — keeps the card
    // monochromatic and premium.
    const watermarkColor = lerpHex(bandColor, tokens.colors.surface, 0.78);

    // Full-height column card.
    elements.push({
      kind: 'shape',
      apply(slide) {
        slide.addShape('roundRect', {
          x: colX,
          y: p.y,
          w: colW,
          h: p.h,
          fill: { color: tokens.colors.surface },
          line: { color: tokens.colors.border, width: 1 },
          rectRadius: 0.05,
        });
      },
    });

    // Large phase number watermark in the card body (top-right), same hue tint.
    elements.push(
      BodyText(
        {
          text: String(i + 1),
          position: {
            x: colX + colW - 1.0,
            y: p.y + headerH + 0.05,
            w: 0.9,
            h: 0.9,
          },
          fontSize: 54,
          bold: true,
          color: watermarkColor,
          align: 'right',
          valign: 'top',
          fontFace: tokens.fonts.title,
        },
        tokens
      )
    );

    // Phase header band.
    elements.push({
      kind: 'shape',
      apply(slide) {
        slide.addShape('roundRect', {
          x: colX,
          y: p.y,
          w: colW,
          h: headerH,
          fill: { color: bandColor },
          line: { color: bandColor, width: 0 },
          rectRadius: 0.05,
        });
      },
    });

    // Phase label (header).
    elements.push(
      BodyText(
        {
          text: phase.label,
          position: { x: colX + 0.12, y: p.y, w: colW - 0.24, h: headerH },
          bold: true,
          color: tokens.colors.textInverse,
          align: 'center',
          valign: 'middle',
          fontSize: 13,
          fontFace: tokens.fonts.title,
        },
        tokens
      )
    );

    // Phase items — distributed through the card body so it fills (anti-sparse).
    // Body spans from under the header to just above the timeframe pill.
    const bodyY = p.y + headerH + 0.22;
    const bodyH = p.h - headerH - 0.22 - pillH - pillGap;
    elements.push(
      Bullet(
        {
          items: phase.items.slice(0, 6),
          position: {
            x: colX + 0.2,
            y: bodyY,
            w: colW - 0.4,
            h: Math.max(0.4, bodyH),
          },
          fontSize: 11,
        },
        tokens
      )
    );

    // Timeframe pill anchored at the bottom of the card.
    const pillY = p.y + p.h - pillH - pillGap / 2;
    const pillX = colX + 0.2;
    const pillW = colW - 0.4;
    elements.push({
      kind: 'shape',
      apply(slide) {
        slide.addShape('roundRect', {
          x: pillX,
          y: pillY,
          w: pillW,
          h: pillH,
          fill: { color: tokens.colors.background },
          line: { color: bandColor, width: 1 },
          rectRadius: pillH / 2,
        });
      },
    });
    elements.push(
      BodyText(
        {
          text: phase.timeframe,
          position: { x: pillX, y: pillY, w: pillW, h: pillH },
          bold: true,
          color: bandColor,
          align: 'center',
          valign: 'middle',
          fontSize: 10,
        },
        tokens
      )
    );
  }

  return elements;
}
