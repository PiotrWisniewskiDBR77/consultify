/**
 * BreadcrumbBuffer
 *
 * "What did the user do in the last 30 seconds?" answer machine.
 * Captures clicks (with textual label/role), route changes and simple
 * form interactions. Input VALUES are never captured, only element
 * identity (tag + role + aria label + truncated text).
 */

export type BreadcrumbKind = 'click' | 'navigate' | 'submit' | 'input' | 'custom';

export interface BreadcrumbEntry {
  at: string;
  kind: BreadcrumbKind;
  label: string;
  target?: string;
  route?: string;
  meta?: Record<string, string | number | boolean>;
}

const MAX_ENTRIES = 40;
const MAX_LABEL_LEN = 120;

const ring: BreadcrumbEntry[] = [];
let installed = false;
let lastRoute: string | null = null;

function describeTarget(el: EventTarget | null): { label: string; target: string } {
  if (!(el instanceof Element)) return { label: '[document]', target: '' };
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = el.className && typeof el.className === 'string'
    ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
    : '';
  const role = el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : '';
  const aria = el.getAttribute('aria-label');
  const text = (el as HTMLElement).innerText || el.getAttribute('title') || el.getAttribute('alt');
  const labelSource = aria || text || '';
  const label = labelSource.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LEN) || tag;
  const target = `${tag}${id}${cls}${role}`.slice(0, MAX_LABEL_LEN);
  return { label, target };
}

function push(entry: BreadcrumbEntry): void {
  if (ring.length >= MAX_ENTRIES) ring.shift();
  ring.push(entry);
}

function currentRoute(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname + window.location.search + window.location.hash;
}

function recordRouteIfChanged(): void {
  const next = currentRoute();
  if (next === lastRoute) return;
  lastRoute = next;
  push({
    at: new Date().toISOString(),
    kind: 'navigate',
    label: next,
    route: next,
  });
}

export function installBreadcrumbBuffer(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  lastRoute = currentRoute();
  push({ at: new Date().toISOString(), kind: 'navigate', label: lastRoute, route: lastRoute });

  window.addEventListener(
    'click',
    (event) => {
      try {
        const { label, target } = describeTarget(event.target);
        push({
          at: new Date().toISOString(),
          kind: 'click',
          label,
          target,
          route: currentRoute(),
        });
      } catch {
        // ignore
      }
    },
    { capture: true, passive: true }
  );

  window.addEventListener(
    'submit',
    (event) => {
      try {
        const { label, target } = describeTarget(event.target);
        push({
          at: new Date().toISOString(),
          kind: 'submit',
          label: `submit: ${label}`,
          target,
          route: currentRoute(),
        });
      } catch {
        // ignore
      }
    },
    { capture: true, passive: true }
  );

  const onHistoryChange = () => {
    queueMicrotask(recordRouteIfChanged);
  };
  window.addEventListener('popstate', onHistoryChange);
  window.addEventListener('hashchange', onHistoryChange);

  try {
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    history.pushState = function patchedPush(
      this: History,
      ...args: Parameters<typeof history.pushState>
    ) {
      const result = originalPush.apply(this, args as [unknown, string, string | URL | null]);
      onHistoryChange();
      return result;
    } as typeof history.pushState;
    history.replaceState = function patchedReplace(
      this: History,
      ...args: Parameters<typeof history.replaceState>
    ) {
      const result = originalReplace.apply(this, args as [unknown, string, string | URL | null]);
      onHistoryChange();
      return result;
    } as typeof history.replaceState;
  } catch {
    // ignore — some environments freeze history
  }
}

export function addBreadcrumb(entry: Omit<BreadcrumbEntry, 'at'> & { at?: string }): void {
  push({ at: entry.at || new Date().toISOString(), ...entry });
}

export function snapshotBreadcrumbs(limit = MAX_ENTRIES): BreadcrumbEntry[] {
  const start = Math.max(0, ring.length - limit);
  return ring.slice(start).map((entry) => ({ ...entry }));
}

export function clearBreadcrumbs(): void {
  ring.length = 0;
}
