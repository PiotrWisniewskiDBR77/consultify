/**
 * Atomic: Confidentiality Banner
 * Top-right confidentiality classification label.
 */
import type { DesignTokens, RenderedElement } from '../types.js';

export interface ConfidentialityBannerProps {
  level: 'confidential' | 'internal' | 'public';
}

export function ConfidentialityBanner(
  props: ConfidentialityBannerProps,
  tokens: DesignTokens
): RenderedElement {
  const labels: Record<string, string> = {
    confidential: 'CONFIDENTIAL',
    internal: 'INTERNAL',
    public: 'PUBLIC',
  };

  const colors: Record<string, string> = {
    confidential: tokens.colors.danger,
    internal: tokens.colors.warning,
    public: tokens.colors.muted,
  };

  return {
    kind: 'text',
    apply(slide) {
      slide.addText(labels[props.level], {
        x: 7.8,
        y: 0.05,
        w: 1.8,
        h: 0.25,
        fontSize: 7,
        fontFace: tokens.fonts.body,
        color: colors[props.level],
        bold: true,
        align: 'right',
      });
    },
  };
}
