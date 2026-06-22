/**
 * @vitest-environment jsdom
 *
 * GateReadinessPill — gate-AI readiness badge (M13 Depth · Fala 1 · §6).
 *
 * Locks in the PURE presentational behaviour:
 *   - verdict 'ready'  → emerald (NOT danger), Check icon, score+suffix, ariaReady;
 *   - verdict 'below'  → amber (warning, NOT crimson/red), AlertTriangle, ariaBelow;
 *   - loading / null readiness → neutral slate state + loading aria;
 *   - onClick fires when provided; button disabled when no onClick.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// i18n mock that INTERPOLATES params so we can assert on rendered score.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) =>
      opts ? `${k}::${JSON.stringify(opts)}` : k,
    i18n: { language: 'pl' },
  }),
}));

// Lucide icons → identifiable test markers.
vi.mock('lucide-react', () => ({
  AlertTriangle: (p: any) => <span data-testid="icon-alert" {...p} />,
  Check: (p: any) => <span data-testid="icon-check" {...p} />,
  Loader2: (p: any) => <span data-testid="icon-loader" {...p} />,
  Sparkles: (p: any) => <span data-testid="icon-sparkles" {...p} />,
}));

import { GateReadinessPill } from '@/components/Initiatives/gate-ai/GateReadinessPill';
import { GateAiReadiness } from '@/types/gateAi';

const ready: GateAiReadiness = {
  score: 86,
  threshold: 70,
  verdict: 'ready',
  gaps: [],
  fixes: [],
};
const below: GateAiReadiness = {
  score: 42,
  threshold: 70,
  verdict: 'below',
  gaps: [],
  fixes: [],
};

describe('GateReadinessPill', () => {
  it('renders READY verdict as emerald (not danger) with score + suffix + check icon', () => {
    render(<GateReadinessPill readiness={ready} onClick={vi.fn()} />);
    const btn = screen.getByRole('button');

    // Color = emerald, never red/crimson/danger.
    expect(btn.className).toMatch(/emerald/);
    expect(btn.className).not.toMatch(/red|crimson|rose|danger/);

    expect(screen.getByTestId('icon-check')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-alert')).not.toBeInTheDocument();

    // Score + suffix rendered.
    expect(btn.textContent).toContain('86');
    expect(btn.textContent).toContain('initiatives.gateAi.pill.scoreSuffix');

    // aria carries the ready label with the score interpolated.
    expect(btn.getAttribute('aria-label')).toContain('pill.ariaReady');
    expect(btn.getAttribute('aria-label')).toContain('86');
  });

  it('renders BELOW verdict as amber warning (not red) with alert icon + ariaBelow', () => {
    render(<GateReadinessPill readiness={below} onClick={vi.fn()} />);
    const btn = screen.getByRole('button');

    expect(btn.className).toMatch(/amber/);
    expect(btn.className).not.toMatch(/red|crimson|rose|danger/);

    expect(screen.getByTestId('icon-alert')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-check')).not.toBeInTheDocument();

    expect(btn.textContent).toContain('42');
    expect(btn.getAttribute('aria-label')).toContain('pill.ariaBelow');
    expect(btn.getAttribute('aria-label')).toContain('42');
  });

  it('shows neutral loading state (slate, spinner, loading aria) when loading', () => {
    render(<GateReadinessPill readiness={ready} loading onClick={vi.fn()} />);
    const btn = screen.getByRole('button');

    expect(btn.className).toMatch(/slate/);
    expect(btn.className).not.toMatch(/emerald|amber/);
    expect(screen.getByTestId('icon-loader')).toBeInTheDocument();
    expect(btn.getAttribute('aria-label')).toBe('initiatives.gateAi.pill.ariaLoading');
    expect(btn.textContent).toContain('initiatives.gateAi.pill.loading');
  });

  it('shows neutral subtle state (sparkles, label) when readiness is null', () => {
    render(<GateReadinessPill readiness={null} onClick={vi.fn()} />);
    const btn = screen.getByRole('button');

    expect(btn.className).toMatch(/slate/);
    expect(screen.getByTestId('icon-sparkles')).toBeInTheDocument();
    expect(btn.textContent).toContain('initiatives.gateAi.pill.label');
  });

  it('fires onClick when provided and stays enabled', () => {
    const onClick = vi.fn();
    render(<GateReadinessPill readiness={ready} onClick={onClick} />);
    const btn = screen.getByRole('button');

    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when no onClick handler is supplied', () => {
    render(<GateReadinessPill readiness={ready} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
