/**
 * PLACEHOLDER — restores a harness-wide build break, does NOT reconstruct the
 * original screen.
 *
 * `dev-render/main.tsx` has registered `'tools-sesja-wyjscie'` since commit
 * af62da5a6e ("docs(handoff): przekazanie pracy nad IDEE"), but the screen file
 * itself was never committed — it is absent from the `origin/demo` tree
 * (`git ls-tree origin/demo dev-render/screens/` confirms). Because main.tsx
 * imports every screen eagerly at module scope via `React.lazy(() => import(...))`,
 * Vite's import-analysis fails on the missing module and the resulting 500 takes
 * down the ENTIRE dev-render harness — every screen of every module, not just
 * this one. That blocks the CLAUDE.md rule #7 workflow (render + screenshot
 * before Piotr sees anything) repo-wide.
 *
 * This stub only restores resolvability. The real screen's content is lost and
 * must be re-authored by whoever owns the IDEE / tools-session work; this file
 * deliberately renders an explicit "missing" notice rather than a plausible
 * mock, so nobody mistakes it for the real thing or screenshots it for an odbiór.
 */
import React from 'react';

export default function ToolsSesjaWyjscieScreen(): React.ReactElement {
  return (
    <div className="p-8">
      <div className="max-w-2xl rounded-lg border border-c-border-default bg-c-bg-secondary p-6">
        <h1 className="mb-3 text-lg font-semibold text-c-text-primary">
          Ekran „tools-sesja-wyjscie" — plik nieobecny w repo
        </h1>
        <p className="mb-3 text-sm text-c-text-secondary">
          Ten ekran jest zarejestrowany w <code>dev-render/main.tsx</code> od commita{' '}
          <code>af62da5a6e</code>, ale sam plik ekranu nigdy nie został scommitowany i nie ma go w
          drzewie <code>origin/demo</code>.
        </p>
        <p className="mb-3 text-sm text-c-text-secondary">
          To jest wyłącznie zaślepka przywracająca budowalność harnessu — brakujący moduł wywalał
          import-analysis Vite i kładł CAŁY dev-render (wszystkie ekrany, wszystkie moduły), co
          blokowało weryfikację wzrokową z reguły #7.
        </p>
        <p className="text-sm text-c-text-tertiary">
          Treść oryginalnego ekranu należy odtworzyć po stronie właściciela prac IDEE / sesji
          narzędzi. Nie używaj tej zaślepki do odbioru.
        </p>
      </div>
    </div>
  );
}
