/**
 * Document Studio editor — shared attr factory for atom payload NodeViews (R1).
 *
 * Every atom block NodeView (chart / kpi / table / quote / image) carries the
 * SAME identity + payload attr set. `payloadJson` is the single opaque contract
 * holding the block's entire `content`; the converters write/read it verbatim,
 * so it survives any editing round-trip untouched.
 */

import type { Attributes } from '@tiptap/core';

type AttrSpec = {
  default: unknown;
  parseHTML: (el: HTMLElement) => unknown;
  renderHTML: (attrs: Record<string, unknown>) => Record<string, unknown>;
};

function dataAttr(name: string, fallback: unknown = ''): AttrSpec {
  return {
    default: fallback,
    parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`) ?? fallback,
    renderHTML: (attrs: Record<string, unknown>) => {
      const v = attrs[camel(name)];
      if (v === undefined || v === null || v === '') return {};
      return { [`data-${name}`]: String(v) };
    },
  };
}

function camel(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * The common attr block shared by every atom payload NodeView.
 * Returns a TipTap-compatible attributes spec.
 */
export function payloadBlockAttributes(): Attributes {
  return {
    blockId: dataAttr('block-id'),
    sectionId: dataAttr('section-id'),
    blockType: dataAttr('block-type'),
    sourceRef: dataAttr('source-ref'),
    isAssumption: {
      default: false,
      parseHTML: (el: HTMLElement) => el.getAttribute('data-is-assumption') === 'true',
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs.isAssumption ? { 'data-is-assumption': 'true' } : {},
    },
    payloadJson: dataAttr('payload-json'),
  } as unknown as Attributes;
}

/** Parse a NodeView's `payloadJson` attr into a JS value (never throws). */
export function parseNodePayload(attrs: Record<string, unknown>): unknown {
  const raw = attrs?.payloadJson;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
