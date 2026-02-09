/**
 * Composite: Roadmap Band
 * Timeline phases (Now / Next / Later) rendered as horizontal bands.
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

const STATUS_COLORS: Record<string, (tokens: DesignTokens) => string> = {
  completed: (t) => t.colors.success,
  in_progress: (t) => t.colors.info,
  planned: (t) => t.colors.muted,
};

export function RoadmapBand(props: RoadmapBandProps, tokens: DesignTokens): RenderedElement[] {
  const { phases, position: p } = props;
  const elements: RenderedElement[] = [];
  const count = phases.length;
  const colW = (p.w - tokens.spacing.gutter * (count - 1)) / count;
  const headerH = 0.5;

  for (let i = 0; i < count; i++) {
    const phase = phases[i];
    const colX = p.x + i * (colW + tokens.spacing.gutter);
    const statusFn = STATUS_COLORS[phase.status ?? 'planned'];
    const bandColor = statusFn(tokens);

    // Phase header band
    elements.push({
      kind: 'shape',
      apply(slide) {
        slide.addShape('roundRect', {
          x: colX,
          y: p.y,
          w: colW,
          h: headerH,
          fill: { color: bandColor },
          rectRadius: 0.04,
        });
      },
    });

    // Phase label + timeframe
    elements.push(
      BodyText(
        {
          text: `${phase.label}\n${phase.timeframe}`,
          position: { x: colX, y: p.y, w: colW, h: headerH },
          bold: true,
          color: tokens.colors.textInverse,
          align: 'center',
          valign: 'middle',
          fontSize: 11,
        },
        tokens
      )
    );

    // Phase items
    elements.push(
      Bullet(
        {
          items: phase.items.slice(0, 5),
          position: {
            x: colX + 0.05,
            y: p.y + headerH + 0.1,
            w: colW - 0.1,
            h: p.h - headerH - 0.2,
          },
          fontSize: 10,
        },
        tokens
      )
    );
  }

  return elements;
}
