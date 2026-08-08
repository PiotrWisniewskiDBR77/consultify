/**
 * Atomic: Confidentiality Banner
 * Top-right confidentiality classification label.
 */
import type { DesignTokens, RenderedElement } from '../types.js';

export interface ConfidentialityBannerProps {
  level: 'confidential' | 'internal' | 'public';
  language?: string;
}

export function ConfidentialityBanner(
  props: ConfidentialityBannerProps,
  tokens: DesignTokens
): RenderedElement {
  // Discreet classification mark — a quiet metadata label, not an alarm.
  // Spaced caps read as an editorial mark rather than a warning sticker.
  const isPolish = props.language?.toLowerCase().startsWith('pl') ?? false;
  const labels: Record<string, string> = isPolish
    ? {
        confidential: 'P O U F N E',
        internal: 'W E W N E T R Z N E',
        public: 'P U B L I C Z N E',
      }
    : {
        confidential: 'C O N F I D E N T I A L',
        internal: 'I N T E R N A L',
        public: 'P U B L I C',
      };

  // No alarming red. The mark stays in a muted, neutral tone so it reads as a
  // subtle footer-like classification rather than a red warning. On a dark
  // cover the inverse (white) reads cleanly; muted keeps it from shouting.
  const colors: Record<string, string> = {
    confidential: tokens.colors.muted,
    internal: tokens.colors.muted,
    public: tokens.colors.muted,
  };

  return {
    kind: 'text',
    apply(slide) {
      slide.addText(labels[props.level], {
        x: 7.6,
        y: 0.06,
        w: 2.0,
        h: 0.22,
        fontSize: 6.5,
        fontFace: tokens.fonts.body,
        color: colors[props.level],
        bold: false,
        align: 'right',
      });
    },
  };
}
