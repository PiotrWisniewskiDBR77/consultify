/**
 * TokensSection — VF0-11 living style guide, "Tokens" tab.
 *
 * Every value shown here is read from the REAL token layer:
 *  - colors: `useTokenPairs` introspects the live `--c-*` custom properties
 *    (light via `:root`, dark via `.dark`) from `src/index.css` — not
 *    duplicated literals.
 *  - typography: imported directly from `src/styles/typography.ts` (SSOT).
 *  - spacing / radius / elevation / motion / state layers: swatches use
 *    `var(--token)` / Tailwind's `token-*` and `hig-*` scales that already
 *    ship in `tailwind.config` + `src/index.css` (see docs/ui-standards/
 *    TRIADA_KANON.md §C3/§C7/§C8) — this section renders them, it does not
 *    redefine them.
 */
import React from 'react';

import { TEXT_L1, TEXT_L2, TEXT_L3, TEXT_L4, TEXT_L5, TEXT_N, TEXT_Q } from '@/styles/typography';

import { useTokenPairs } from './useTokenPairs';

const SectionHeading: React.FC<{ children: React.ReactNode; note?: string }> = ({
  children,
  note,
}) => (
  <div className="mb-3 mt-8 first:mt-0">
    <h3 className="text-sm font-semibold text-c-text">{children}</h3>
    {note ? <p className="mt-0.5 text-xs text-c-text-muted">{note}</p> : null}
  </div>
);

const SURFACE_TEXT_TOKENS = [
  '--c-bg',
  '--c-surface',
  '--c-surface-raised',
  '--c-border-subtle',
  '--c-border',
  '--c-border-strong',
  '--c-text',
  '--c-text-secondary',
  '--c-text-muted',
];

const ACCENT_FOCUS_TOKENS = ['--c-accent', '--c-accent-soft', '--c-focus', '--c-focus-solid'];

const SEMANTIC_TOKENS = ['--c-success', '--c-warning', '--c-danger', '--c-info'];

const TAG_TOKENS = Array.from({ length: 12 }, (_, i) => `--c-tag-${i + 1}`);
const CHART_TOKENS = Array.from({ length: 8 }, (_, i) => `--c-chart-${i + 1}`);

const ColorPairRow: React.FC<{ name: string; light: string; dark: string }> = ({
  name,
  light,
  dark,
}) => (
  <div className="flex items-center gap-3 py-1.5">
    <div className="flex items-center gap-1.5">
      <div
        className="h-8 w-8 shrink-0 rounded-token-sm border border-c-border-subtle"
        style={{ background: light || 'transparent' }}
        title={`light: ${light}`}
      />
      <div
        className="h-8 w-8 shrink-0 rounded-token-sm border border-white/10"
        style={{ background: dark || 'transparent' }}
        title={`dark: ${dark}`}
      />
    </div>
    <div className="min-w-0 flex-1">
      <div className="truncate text-xs font-medium text-c-text">{name}</div>
      <div className="truncate text-[11px] text-c-text-muted">
        {light || '—'} <span className="mx-1">/</span> {dark || '—'}
      </div>
    </div>
  </div>
);

const ColorPairGrid: React.FC<{ tokens: string[] }> = ({ tokens }) => {
  const pairs = useTokenPairs(tokens);
  return (
    <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
      {pairs.map((p) => (
        <ColorPairRow key={p.name} name={p.name} light={p.light} dark={p.dark} />
      ))}
    </div>
  );
};

const SPACING_SCALE = [4, 8, 12, 16, 20, 24, 32, 40, 48];

const RADIUS_SCALE: { token: string; px: string; className: string }[] = [
  { token: 'token-xs', px: '6px', className: 'rounded-token-xs' },
  { token: 'token-sm', px: '8px', className: 'rounded-token-sm' },
  { token: 'token-md', px: '12px', className: 'rounded-token-md' },
  { token: 'token-lg', px: '16px', className: 'rounded-token-lg' },
  { token: 'token-xl', px: '20px', className: 'rounded-token-xl' },
  { token: 'token-pill', px: '9999px', className: 'rounded-token-pill' },
];

const ELEVATION_SCALE = ['--elevation-0', '--elevation-1', '--elevation-2', '--elevation-3'];

const TYPOGRAPHY_ROWS: { id: string; cls: string; label: string; sample: string }[] = [
  { id: 'L1', cls: TEXT_L1, label: 'L1 — kicker', sample: 'SEKCJA / KICKER' },
  { id: 'L2', cls: TEXT_L2, label: 'L2 — tytuł', sample: 'Tytuł elementu (karta / wiersz)' },
  {
    id: 'L3',
    cls: TEXT_L3,
    label: 'L3 — treść',
    sample: 'Główny tekst treści, do czytania w dłuższych fragmentach.',
  },
  { id: 'L4', cls: TEXT_L4, label: 'L4 — wspierająca', sample: 'Tekst wspierający / drugorzędny.' },
  { id: 'L5', cls: TEXT_L5, label: 'L5 — caption', sample: '3 dni temu · caption/timestamp' },
  { id: 'N', cls: TEXT_N, label: 'N — metryka (KPI)', sample: '2.3x' },
  { id: 'Q', cls: TEXT_Q, label: 'Q — cytat', sample: '„Dokładnie o to nam chodziło."' },
];

export const TokensSection: React.FC = () => {
  return (
    <div>
      <SectionHeading note="Introspekcja LIVE z --c-* (src/index.css): każdy wiersz = jeden token, kwadrat Light + kwadrat Dark, wartość spod obu kaskad jednocześnie — niezależnie od przełącznika motywu strony.">
        Kolory — powierzchnie / tekst / obramowania
      </SectionHeading>
      <ColorPairGrid tokens={SURFACE_TEXT_TOKENS} />

      <SectionHeading note="Akcent marki (crimson) i fokus (niebieski, NIGDY crimson — pułapka #1).">
        Kolory — akcent / fokus
      </SectionHeading>
      <ColorPairGrid tokens={ACCENT_FOCUS_TOKENS} />

      <SectionHeading>Kolory — semantyka (success / warning / danger / info)</SectionHeading>
      <ColorPairGrid tokens={SEMANTIC_TOKENS} />

      <SectionHeading note="c-tag-1..12 — WYŁĄCZNIE do akcentu kategorii/osi (StandardGridCard.accentColorVar itp.), nigdy do statusu.">
        Paleta tagów (c-tag-1..12)
      </SectionHeading>
      <ColorPairGrid tokens={TAG_TOKENS} />

      <SectionHeading note="c-chart-1..8 — AA-kontrastowa paleta wykresów.">
        Paleta wykresów (c-chart-1..8)
      </SectionHeading>
      <ColorPairGrid tokens={CHART_TOKENS} />

      <SectionHeading note="SSOT: src/styles/typography.ts — importowane 1:1, nie duplikowane.">
        Typografia (L1–L5, N, Q)
      </SectionHeading>
      <div className="divide-y divide-c-border-subtle rounded-token-md border border-c-border-subtle">
        {TYPOGRAPHY_ROWS.map((row) => (
          <div key={row.id} className="flex items-center gap-4 px-4 py-3">
            <span className="w-40 shrink-0 text-[11px] font-medium text-c-text-muted">
              {row.label}
            </span>
            <span className={row.cls}>{row.sample}</span>
          </div>
        ))}
      </div>

      <SectionHeading note="Kanon C3 — wszystko w wielokrotnościach 4px (hig-xs..hig-5xl).">
        Odstępy (4·8·12·16·20·24·32·40·48)
      </SectionHeading>
      <div className="flex flex-wrap items-end gap-3">
        {SPACING_SCALE.map((px) => (
          <div key={px} className="flex flex-col items-center gap-1">
            <div className="rounded-token-xs bg-c-accent/30" style={{ width: px, height: 20 }} />
            <span className="text-[10px] text-c-text-muted">{px}px</span>
          </div>
        ))}
      </div>

      <SectionHeading>Promienie (token-xs..token-pill)</SectionHeading>
      <div className="flex flex-wrap items-end gap-4">
        {RADIUS_SCALE.map((r) => (
          <div key={r.token} className="flex flex-col items-center gap-1">
            <div
              className={`h-12 w-12 border border-c-border bg-c-surface-raised ${r.className}`}
            />
            <span className="text-[10px] text-c-text-muted">
              {r.token} ({r.px})
            </span>
          </div>
        ))}
      </div>

      <SectionHeading note="--elevation-0..3 (src/index.css) — cień rośnie z hierarchią (karta → hover → modal).">
        Elewacja (--elevation-0..3)
      </SectionHeading>
      <ElevationRow tokens={ELEVATION_SCALE} />

      <SectionHeading note="--motion-fast/base/slow + --motion-ease — hover 100-120ms · panel/modal ~200ms · nigdy >220ms.">
        Ruch (--motion-*)
      </SectionHeading>
      <MotionDemo />

      <SectionHeading note="--state-hover/press/selected — nakładka NEUTRALNA (color-mix z c-text), nigdy kolor semantyczny.">
        Warstwy stanu (--state-*)
      </SectionHeading>
      <StateLayerDemo />
    </div>
  );
};

const ElevationRow: React.FC<{ tokens: string[] }> = ({ tokens }) => (
  <div className="flex flex-wrap gap-6">
    {tokens.map((t) => (
      <div key={t} className="flex flex-col items-center gap-2">
        <div
          className="h-16 w-16 rounded-token-md bg-c-surface"
          style={{ boxShadow: `var(${t})` }}
        />
        <span className="text-[10px] text-c-text-muted">{t}</span>
      </div>
    ))}
  </div>
);

// Literal (non-interpolated) class names on purpose — Tailwind's content
// scanner matches literal substrings, so `duration-${speed}` template
// interpolation would silently fail to generate the utility.
const MotionDemo: React.FC = () => (
  <div className="flex flex-wrap gap-6">
    <div className="flex flex-col items-center gap-2">
      <div className="h-10 w-10 rounded-token-md border border-c-border-subtle bg-c-surface-raised transition-transform duration-fast ease-standard hover:scale-125" />
      <span className="text-[10px] text-c-text-muted">--motion-fast (120ms, hover)</span>
    </div>
    <div className="flex flex-col items-center gap-2">
      <div className="h-10 w-10 rounded-token-md border border-c-border-subtle bg-c-surface-raised transition-transform duration-base ease-standard hover:scale-125" />
      <span className="text-[10px] text-c-text-muted">--motion-base (180ms, hover)</span>
    </div>
    <div className="flex flex-col items-center gap-2">
      <div className="h-10 w-10 rounded-token-md border border-c-border-subtle bg-c-surface-raised transition-transform duration-slow ease-standard hover:scale-125" />
      <span className="text-[10px] text-c-text-muted">--motion-slow (220ms, hover)</span>
    </div>
  </div>
);

const StateLayerDemo: React.FC = () => (
  <div className="flex flex-wrap gap-4">
    <div className="flex h-16 w-32 items-center justify-center rounded-token-md border border-c-border-subtle bg-state-hover text-[11px] text-c-text-muted">
      --state-hover
    </div>
    <div className="flex h-16 w-32 items-center justify-center rounded-token-md border border-c-border-subtle bg-state-press text-[11px] text-c-text-muted">
      --state-press
    </div>
    <div className="flex h-16 w-32 items-center justify-center rounded-token-md border border-c-border-subtle bg-state-selected text-[11px] text-c-text-muted">
      --state-selected
    </div>
  </div>
);

export default TokensSection;
