/**
 * @vitest-environment jsdom
 *
 * GateReadinessPanel — expanded gate-AI readiness detail (M13 Depth · Fala 1 · §6).
 *
 * Locks in:
 *   - empty state when readiness is null (no score/gaps);
 *   - score / threshold header colored emerald (ready) vs amber (below), never red;
 *   - content gaps render section + score + per-issue bullets;
 *   - suggested fixes render;
 *   - timeline flags: 'block' = amber-strong (/30), 'warn' = amber-soft (/15);
 *   - positive/ready state shown only when ready AND no gaps AND no timeline.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) =>
      opts ? `${k}::${JSON.stringify(opts)}` : k,
    i18n: { language: 'pl' },
  }),
}));

vi.mock('lucide-react', () => ({
  AlertTriangle: (p: any) => <span data-testid="icon-alert" {...p} />,
  CheckCircle2: (p: any) => <span data-testid="icon-check" {...p} />,
  Lightbulb: (p: any) => <span data-testid="icon-bulb" {...p} />,
  ShieldAlert: (p: any) => <span data-testid="icon-shield" {...p} />,
}));

import { GateReadinessPanel } from '@/components/Initiatives/gate-ai/GateReadinessPanel';
import { GateAiReadiness, GateAiTimeline } from '@/types/gateAi';

describe('GateReadinessPanel', () => {
  it('renders the empty state with shield icon when readiness is null', () => {
    render(<GateReadinessPanel readiness={null} timeline={null} />);
    expect(screen.getByTestId('icon-shield')).toBeInTheDocument();
    expect(screen.getByText('initiatives.gateAi.panel.emptyTitle')).toBeInTheDocument();
    // No score header in empty state.
    expect(screen.queryByText(/panel\.scoreLabel/)).not.toBeInTheDocument();
  });

  it('shows positive ready state (emerald, check) and emerald score when ready with no gaps/timeline', () => {
    const readiness: GateAiReadiness = {
      score: 88,
      threshold: 70,
      verdict: 'ready',
      gaps: [],
      fixes: [],
    };
    render(<GateReadinessPanel readiness={readiness} timeline={null} />);

    expect(screen.getByTestId('icon-check')).toBeInTheDocument();
    expect(screen.getByText('initiatives.gateAi.panel.readyTitle')).toBeInTheDocument();

    // Score header colored emerald, never red.
    const scoreEl = screen.getByText(/panel\.scoreLabel/);
    expect(scoreEl.className).toMatch(/emerald/);
    expect(scoreEl.className).not.toMatch(/red|crimson|rose|danger/);
    expect(scoreEl.textContent).toContain('88');
  });

  it('colors the score header amber (not red) when below threshold', () => {
    const readiness: GateAiReadiness = {
      score: 40,
      threshold: 70,
      verdict: 'below',
      gaps: [],
      fixes: [],
    };
    render(<GateReadinessPanel readiness={readiness} timeline={null} />);
    const scoreEl = screen.getByText(/panel\.scoreLabel/);
    expect(scoreEl.className).toMatch(/amber/);
    expect(scoreEl.className).not.toMatch(/red|crimson|rose|danger/);
    // Below-with-no-gaps should NOT show the positive ready block.
    expect(screen.queryByText('initiatives.gateAi.panel.readyTitle')).not.toBeInTheDocument();
  });

  it('renders content gaps with section, score and per-issue bullets', () => {
    const readiness: GateAiReadiness = {
      score: 50,
      threshold: 70,
      verdict: 'below',
      gaps: [
        { section: 'Problem', score: 30, issues: ['Brak metryki', 'Za ogólne'] },
        { section: 'Hipoteza', score: 45, issues: [] },
      ],
      fixes: [],
    };
    render(<GateReadinessPanel readiness={readiness} timeline={null} />);

    expect(screen.getByText('Problem')).toBeInTheDocument();
    expect(screen.getByText('Hipoteza')).toBeInTheDocument();
    // Issues rendered as bullets.
    expect(screen.getByText('Brak metryki')).toBeInTheDocument();
    expect(screen.getByText('Za ogólne')).toBeInTheDocument();
    // Per-gap score interpolated.
    const gapScore = screen.getAllByText(/panel\.gapSectionScore/)[0];
    expect(gapScore.textContent).toContain('30');
  });

  it('renders suggested fixes with bulb icons', () => {
    const readiness: GateAiReadiness = {
      score: 50,
      threshold: 70,
      verdict: 'below',
      gaps: [],
      fixes: ['Dodaj baseline', 'Określ target'],
    };
    render(<GateReadinessPanel readiness={readiness} timeline={null} />);
    expect(screen.getByText('Dodaj baseline')).toBeInTheDocument();
    expect(screen.getByText('Określ target')).toBeInTheDocument();
    expect(screen.getAllByTestId('icon-bulb')).toHaveLength(2);
  });

  it('distinguishes block (amber-strong /30) vs warn (amber-soft /15) timeline flags', () => {
    const readiness: GateAiReadiness = {
      score: 75,
      threshold: 70,
      verdict: 'ready',
      gaps: [],
      fixes: [],
    };
    const timeline: GateAiTimeline = {
      flags: [
        { severity: 'block', kind: 'dependency', message: 'Zależność niedomknięta' },
        { severity: 'warn', kind: 'date_conflict', message: 'Konflikt dat' },
      ],
    };
    render(<GateReadinessPanel readiness={readiness} timeline={timeline} />);

    const blockLi = screen.getByText('Zależność niedomknięta').closest('li')!;
    const warnLi = screen.getByText('Konflikt dat').closest('li')!;

    // Block = stronger amber (border /30, bg /15); warn = softer (/15, /5).
    expect(blockLi.className).toMatch(/amber-500\/30/);
    expect(warnLi.className).toMatch(/amber-500\/15/);
    // Block stronger than warn: warn must NOT carry the /30 border.
    expect(warnLi.className).not.toMatch(/amber-500\/30/);

    // Severity badge labels differ.
    expect(screen.getByText('initiatives.gateAi.panel.timelineBlock')).toBeInTheDocument();
    expect(screen.getByText('initiatives.gateAi.panel.timelineWarn')).toBeInTheDocument();

    // Ready block suppressed because timeline flags present.
    expect(screen.queryByText('initiatives.gateAi.panel.readyTitle')).not.toBeInTheDocument();
  });
});
