/** @vitest-environment node */

/**
 * G4-KBD-P0 — focused-node visible ring (QA 21_FOCUS_AND_CONTRAST.md P1 F-01).
 *
 * ReactFlow's own base stylesheet (`reactflow/dist/style.css`) ships:
 *
 *   .react-flow__node.selectable:focus-visible { outline: none; }
 *
 * and only restores a compensating box-shadow for its four BUILT-IN node
 * classnames (`.react-flow__node-default/-input/-output/-group`) — none of
 * which any custom node type in Mind Map, Whiteboard or Process Flow uses.
 * Every custom node is genuinely keyboard-focusable (ReactFlow gives
 * `selectable` nodes a real tabIndex), so before this fix every one of them
 * had literally zero visible `:focus-visible` indicator.
 *
 * Fixed once per tool (not per node component — Whiteboard alone has 11
 * custom node types) via a same-specificity override in each tool's own
 * canvas stylesheet, loaded after `reactflow/dist/style.css` in the same
 * component file. `!important` guarantees the override wins regardless of
 * how the bundler orders same-specificity rules across separate CSS module
 * imports.
 *
 * This test reads the actual shipped CSS files (same technique as
 * `DeckBuilder/__tests__/deckBuilderResponsive.test.ts`) so it fails if the
 * rule, its `!important`, or the c-focus token is ever removed.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const FOCUS_RING_SELECTOR = '.react-flow__node.selectable:focus-visible';

const CSS_FILES = [
  {
    tool: 'Mind Map',
    path: path.resolve(__dirname, '../../mindmap/mindmap-effects.css'),
  },
  {
    tool: 'Whiteboard',
    path: path.resolve(__dirname, '../../whiteboard/whiteboard-canvas.css'),
  },
  {
    tool: 'Process Flow',
    path: path.resolve(__dirname, '../../processflow/processflow-canvas.css'),
  },
] as const;

/** Strip /* ... *\/ CSS comments so a selector mentioned in a doc comment
 * (this file's own header quotes ReactFlow's `outline: none;` rule as
 * context) can never be mistaken for the real, active rule below it. */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function extractRuleBody(css: string): string {
  const active = stripCssComments(css);
  const ruleMatch = active.match(/\.react-flow__node\.selectable:focus-visible\s*\{([^}]*)\}/);
  if (!ruleMatch) {
    throw new Error(
      'expected an active (non-comment) .react-flow__node.selectable:focus-visible {...} rule'
    );
  }
  return ruleMatch[1];
}

describe.each(CSS_FILES)('$tool canvas — focused-node ring restored', ({ path: cssPath }) => {
  const css = fs.readFileSync(cssPath, 'utf8');

  it('overrides ReactFlow\'s outline:none for every custom node type', () => {
    expect(css).toContain(FOCUS_RING_SELECTOR);
    const body = extractRuleBody(css);
    expect(body).toMatch(/outline\s*:\s*2px solid/);
    // !important: same-specificity selector as reactflow's own base.css rule
    // (`.react-flow__node.selectable:focus-visible { outline: none; }`) —
    // without it, whichever stylesheet the bundler happens to concatenate
    // last wins, which is not guaranteed to be this one.
    expect(body).toMatch(/!important/);
  });

  it('uses the c-focus token (blue), never crimson primary-*', () => {
    const body = extractRuleBody(css);
    expect(body).toContain('--c-focus-solid');
    expect(body.toLowerCase()).not.toContain('primary-');
    expect(body.toLowerCase()).not.toContain('85182f'); // crimson hex, no token
  });
});
