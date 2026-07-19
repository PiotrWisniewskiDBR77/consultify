/**
 * useTokenPairs — reads the DECLARED light/dark value of one or more CSS
 * custom properties directly from the stylesheet rules (`:root { }` /
 * `.dark { }` in `src/index.css`), independent of whatever theme the page
 * currently has active.
 *
 * Why not just `getComputedStyle` on a live element: custom properties
 * INHERIT down the tree. `.dark` is a plain class selector applied to
 * `<html>` (not scoped to `:root.dark` only), so a hidden probe element
 * scoped with `class="dark"` correctly re-triggers the dark cascade — but a
 * plain probe meant to read the "light" value would, when the page itself
 * is currently in dark mode, inherit the ALREADY-DARK value from its
 * `html.dark` ancestor (there is no `.light` class to force it back). That
 * DOM-probe approach was tried first and produced identical light/dark
 * readings whenever the page happened to be in dark mode — a real bug,
 * caught by screenshotting this page in dark mode during VF0-11 build.
 *
 * Reading the literal declarations out of `document.styleSheets` sidesteps
 * inheritance entirely: it does not execute or inherit anything, it just
 * looks up what `:root { --c-x: ... }` and `.dark { --c-x: ... }` say in
 * `src/index.css`, wherever they land inside `@layer base { }`. No values
 * are duplicated here — this is introspection of the live stylesheet, not a
 * re-implementation of the design system.
 */
import { useEffect, useState } from 'react';

export interface TokenPair {
  name: string;
  light: string;
  dark: string;
}

function collectFromRules(
  rules: CSSRuleList,
  lightMap: Map<string, string>,
  darkMap: Map<string, string>
): void {
  for (const rule of Array.from(rules)) {
    const styleRule = rule as CSSStyleRule;
    // A plain style rule (`:root { }`, `.dark { }`, ...) always exposes a
    // string `selectorText` — check this FIRST. Chrome's CSSStyleRule also
    // exposes an (empty, always-truthy-as-object) `cssRules` property, so
    // branching on "does this rule have cssRules" before checking for
    // `selectorText` mis-detects every plain style rule as a grouping rule
    // and silently skips it (caught via a real dark-mode screenshot during
    // VF0-11 build — every pair rendered as "—").
    if (typeof styleRule.selectorText === 'string' && styleRule.style) {
      const selector = styleRule.selectorText.trim();
      const target = selector === ':root' ? lightMap : selector === '.dark' ? darkMap : null;
      if (target) {
        for (let i = 0; i < styleRule.style.length; i += 1) {
          const prop = styleRule.style.item(i);
          if (prop.startsWith('--')) {
            target.set(prop, styleRule.style.getPropertyValue(prop).trim());
          }
        }
      }
      continue;
    }
    // Grouping rules (@layer / @media / @supports / @keyframes) — recurse.
    const grouping = rule as CSSRule & { cssRules?: CSSRuleList };
    if (grouping.cssRules && grouping.cssRules.length > 0) {
      collectFromRules(grouping.cssRules, lightMap, darkMap);
    }
  }
}

function readTokenMaps(): { light: Map<string, string>; dark: Map<string, string> } {
  const light = new Map<string, string>();
  const dark = new Map<string, string>();
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules;
      if (rules) collectFromRules(rules, light, dark);
    } catch {
      // Cross-origin stylesheet (none expected in this app) — skip.
    }
  }
  return { light, dark };
}

export function useTokenPairs(tokenNames: string[]): TokenPair[] {
  const [pairs, setPairs] = useState<TokenPair[]>(() =>
    tokenNames.map((name) => ({ name, light: '', dark: '' }))
  );

  useEffect(() => {
    const { light, dark } = readTokenMaps();
    setPairs(
      tokenNames.map((name) => ({
        name,
        light: light.get(name) ?? '',
        dark: dark.get(name) ?? '',
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenNames.join('|')]);

  return pairs;
}
