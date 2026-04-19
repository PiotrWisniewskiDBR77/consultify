/**
 * Chat V9 / ADMIN AG1 v1.12 — pure builder for "share my
 * override set" URLs.
 *
 * What we produce
 * ---------------
 * A single shareable URL that, when opened in any browser,
 * reproduces the originator's exact override set via Chat V9's
 * standard query-key resolution path (URL ▸ localStorage ▸ env
 * ▸ default). Each non-default flag is encoded as
 * `?<flag.keys.query>=1|0` (`1` for ON, `0` for OFF); flags
 * left at their shipped defaults are NOT encoded, so the URL
 * stays lean and copy-pasteable.
 *
 * Shape:
 *   `<origin><pathname>?<preserved>&ff_trustBadge=0&ff_piiHeuristicToast=1`
 *
 * Design notes
 * ------------
 * - **Deterministic** ordering. Overrides are emitted in the
 *   order `CHAT_V9_FLAGS` declares them (milestone order) so
 *   two admins with the same override set always copy the
 *   same URL. The clipboard payload is a stable key we can
 *   diff in tickets, screenshots, and Notion pages.
 *
 * - **Preserves non-`ff_` query params** the admin already has
 *   in the current tab. Dropping those would silently break
 *   unrelated flows — e.g. an admin who opened the panel via
 *   `?v9flags=1&tenant=acme` would lose `tenant=acme` after
 *   copying the URL back.
 *
 * - **Replaces any pre-existing `ff_*` params** with the
 *   current override set. The URL is a *snapshot* of "what
 *   the panel says right now", not a merge of what the tab
 *   already carries.
 *
 * - **Skips flags that match their default**. If the admin
 *   has no overrides, the helper returns the preserved-
 *   params URL without any `ff_*` keys; it does not emit a
 *   `?=` suffix and does not lie about state.
 *
 * - **Pure** — takes an explicit `location` snapshot; falls
 *   back to `window.location` only when the snapshot is
 *   omitted. Tests pass fixed locations so the output is
 *   stable; production code passes `window.location`.
 *
 * - **Idempotent** — calling `buildChatV9FlagOverrideUrl()` on
 *   its own output (re-resolved through `URL`) yields the
 *   same URL. A second copy-paste round-trip does not
 *   accumulate parameters.
 */

import type { ChatV9FlagDescriptor } from './chatV9FeatureFlags';
import { CHAT_V9_FLAGS, getChatV9FlagOverrideState } from './chatV9FeatureFlags';

export interface FlagOverrideUrlLocation {
  origin: string;
  pathname: string;
  search: string;
}

export interface BuildOverrideUrlOptions {
  /**
   * Location snapshot. Production callers pass
   * `window.location`; tests pass a fixed object so the
   * asserted output is stable across environments.
   */
  location?: FlagOverrideUrlLocation;
  /**
   * Inject a different flag registry. Default is
   * `CHAT_V9_FLAGS`; test code may pass a subset to pin
   * ordering without rewiring the module mock.
   */
  flags?: readonly ChatV9FlagDescriptor[];
  /**
   * Inject an override reader. Default reads from the live
   * `getChatV9FlagOverrideState`. Tests pass a pure function
   * so the builder can be exercised without mutating
   * `localStorage`.
   */
  getOverride?: (flagId: string) => 'on' | 'off' | null;
}

const FF_QUERY_PREFIX_PATTERN = /^ff_/;

function readLocationFromWindow(): FlagOverrideUrlLocation {
  if (typeof window === 'undefined' || !window.location) {
    return { origin: '', pathname: '/', search: '' };
  }
  const { origin, pathname, search } = window.location;
  return { origin: origin ?? '', pathname: pathname ?? '/', search: search ?? '' };
}

export function buildChatV9FlagOverrideUrl(
  options: BuildOverrideUrlOptions = {}
): string {
  const location = options.location ?? readLocationFromWindow();
  const flags = options.flags ?? CHAT_V9_FLAGS;
  const getOverride = options.getOverride ?? getChatV9FlagOverrideState;

  const params = new URLSearchParams(location.search ?? '');

  // 1. Drop every pre-existing ff_* param. The snapshot we are
  //    producing *is* the source of truth for overrides; the
  //    existing URL may reflect an older set.
  const toDelete: string[] = [];
  params.forEach((_, key) => {
    if (FF_QUERY_PREFIX_PATTERN.test(key)) toDelete.push(key);
  });
  for (const key of toDelete) params.delete(key);

  // 2. Emit overrides in registry order so the same override
  //    set always produces the same URL (important for diffing
  //    and copy-paste stability).
  for (const flag of flags) {
    const state = getOverride(flag.id);
    if (state === null) continue;
    params.set(flag.keys.query, state === 'on' ? '1' : '0');
  }

  const search = params.toString();
  const prefix = `${location.origin ?? ''}${location.pathname ?? '/'}`;
  return search.length > 0 ? `${prefix}?${search}` : prefix;
}
