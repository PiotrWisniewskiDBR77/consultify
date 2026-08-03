/**
 * StyleGuide — VF0-11 living style guide (dev-only, behind a flag).
 *
 * ONE place with the whole design system, for robotnicy (workers) and as
 * the standing "reguła #7" tool: tokens (light/dark pairs, typography,
 * spacing, radius, elevation, motion, state layers), every
 * `src/components/standard/*` component in its documented variants, and
 * every `src/components/shared/states/*` state (Empty ×4 / Skeleton ×4 /
 * Error / Streaming) — plus a dark/light switch on the page itself.
 *
 * Everything here is IMPORTED from the real design system — colors read the
 * live `--c-*` custom properties (see `./styleguide/useTokenPairs.ts`),
 * typography comes from `src/styles/typography.ts`, and every component is
 * the actual production facade. Nothing is re-implemented (CLAUDE.md rule
 * #1 — standard is code, not a description; this page just puts it all on
 * one screen).
 *
 * Route: `/dev/styleguide`, registered in `src/App.tsx` next to the other
 * public (no-login) routes, gated behind `VITE_ENABLE_STYLEGUIDE=true`
 * (default OFF — flag OFF means the route is not registered at all, so
 * this page changes nothing about the running app).
 *
 * Reused instead of re-invented: the dark/light toggle below drives the
 * SAME `useAppStore().theme` + `toggleTheme()` the rest of the app uses
 * (see `AppContent`'s `useLayoutEffect` in `src/App.tsx`, which is already
 * mounted above this route in the provider tree) — flipping it here
 * toggles the real `.dark` class on `<html>`.
 */
import { Moon, Sun } from 'lucide-react';
import React, { useState } from 'react';

import { useAppStore } from '@/store/useAppStore';

import { ComponentsSection } from './styleguide/ComponentsSection';
import { StatesSection } from './styleguide/StatesSection';
import { TokensSection } from './styleguide/TokensSection';

type GuideTab = 'tokens' | 'components' | 'states';

const TABS: { id: GuideTab; label: string }[] = [
  { id: 'tokens', label: 'Tokeny' },
  { id: 'components', label: 'Komponenty (standard/*)' },
  { id: 'states', label: 'Stany (shared/states/*)' },
];

export default function StyleGuidePage(): React.ReactElement {
  const [tab, setTab] = useState<GuideTab>('tokens');
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen bg-c-bg text-c-text">
      <header className="sticky top-0 z-10 border-b border-c-border-subtle bg-c-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-base font-semibold text-c-text">Consultify — Living Style Guide</h1>
            <p className="text-xs text-c-text-muted">
              VF0-11 · dev-only, za flagą <code>VITE_ENABLE_STYLEGUIDE</code> · bez logowania. Zero
              re-implementacji — wszystko importowane z żywego systemu.
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggleTheme()}
            className="inline-flex h-9 items-center gap-2 rounded-token-md border border-c-border bg-c-surface px-3 text-xs font-medium text-c-text transition-colors hover:bg-c-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
            aria-pressed={isDark}
          >
            {isDark ? <Moon size={14} /> : <Sun size={14} />}
            {isDark ? 'Dark' : 'Light'} — przełącz
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4 pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={`h-9 rounded-full border px-3 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-c-border bg-state-selected text-c-text'
                  : 'border-c-border-subtle bg-c-surface text-c-text-secondary hover:bg-state-hover'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab === 'tokens' && <TokensSection />}
        {tab === 'components' && <ComponentsSection />}
        {tab === 'states' && <StatesSection />}
      </main>
    </div>
  );
}
