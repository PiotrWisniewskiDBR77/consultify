/**
 * D-54 (debt after MVP) — freeze the AA contrast of the next-stage-gates
 * failure message in `AuditProcessesTab`.
 *
 * WHAT THIS GUARDS (CTO pixel measurement, `odbior-op1-v3b-20260917/POSTEP.md`
 * ETAP 2): the alert rendered `text-c-danger` = `--c-danger` #e80538 on a
 * slate-50 panel → 4,45:1, under the 4,5:1 AA threshold. `--c-danger` has 694
 * call sites in src/, so raising it globally is out of scope; the fix is a
 * narrow token `--c-danger-on-surface` (pattern: `--c-danger-table`,
 * `--c-focus-solid-on-tint`) consumed by this node.
 *
 * Three layers, each with its own mutation proof:
 *   1. TOKEN MATH — the values declared in `src/index.css` really do clear
 *      4,5:1 against the theme backgrounds declared in the same file
 *      (mutation: light token back to #e80538 → RED).
 *   2. UTILITY WIRING — the token is registered in the canonical `c.*`
 *      Tailwind namespace, so `text-c-danger-on-surface` exists at all
 *      (mutation: drop the entry → RED).
 *   3. CONSUMPTION — the real component renders the alert with that utility
 *      and no longer with bare `text-c-danger` (mutation: revert the class → RED).
 */
import fs from 'node:fs';
import path from 'node:path';

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return {
    ...actual,
    getProgram: vi.fn(),
    getProgramCoverage: vi.fn(),
    getProgramLifecycle: vi.fn(),
    listProgramCriteria: vi.fn(),
    transitionProgram: vi.fn(),
    finalizeOutput: vi.fn(),
  };
});

import { AuditProcessesTab } from '../tabs/AuditProcessesTab';
import {
  getProgram,
  getProgramCoverage,
  getProgramLifecycle,
  listProgramCriteria,
  type AuditProgramSummary,
} from '../auditsMethodApi';

const read = (relative: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8');

/** WCAG 2.1 relative luminance → contrast ratio, computed here so the guard is
 * arithmetic on the shipped values, not a copy of someone's earlier number. */
function contrast(fgHex: string, bgHex: string): number {
  const channel = (hex: string, index: number) => {
    const raw = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex: string) =>
    0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
  const a = luminance(fgHex);
  const b = luminance(bgHex);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Value of a custom property inside the n-th block that declares it. */
function tokenFrom(css: string, name: string, occurrence: 0 | 1): string {
  const hits = [...css.matchAll(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`, 'g'))].map(
    (match) => match[1]
  );
  expect(hits.length, `${name} declared in :root and .dark`).toBeGreaterThanOrEqual(2);
  return hits[occurrence];
}

const AA = 4.5;

describe('D-54 — token `--c-danger-on-surface` clears AA on both themes', () => {
  const css = read('src/index.css');
  const light = tokenFrom(css, '--c-danger-on-surface', 0);
  const dark = tokenFrom(css, '--c-danger-on-surface', 1);
  const lightSurface = tokenFrom(css, '--c-surface', 0);
  const lightBg = tokenFrom(css, '--c-bg', 0);
  const darkSurface = tokenFrom(css, '--c-surface', 1);
  const darkBg = tokenFrom(css, '--c-bg', 1);
  // The background CTO pixel-measured, rgb(248,250,252) = `--c-surface-raised`
  // (light). Its dark counterpart is navy-800 #15213b.
  const lightRaised = tokenFrom(css, '--c-surface-raised', 0);
  const darkRaised = tokenFrom(css, '--c-surface-raised', 1);

  it('light value passes on --c-surface, --c-bg and the measured --c-surface-raised', () => {
    expect(lightRaised).toBe('#f8fafc');
    expect(contrast(light, lightSurface)).toBeGreaterThanOrEqual(AA);
    expect(contrast(light, lightBg)).toBeGreaterThanOrEqual(AA);
    expect(contrast(light, lightRaised)).toBeGreaterThanOrEqual(AA);
  });

  it('dark value passes on --c-surface, --c-bg and --c-surface-raised', () => {
    expect(contrast(dark, darkSurface)).toBeGreaterThanOrEqual(AA);
    expect(contrast(dark, darkBg)).toBeGreaterThanOrEqual(AA);
    expect(contrast(dark, darkRaised)).toBeGreaterThanOrEqual(AA);
  });

  it('the dark theme declares its own value (the light one would fail on navy)', () => {
    expect(dark).not.toBe(light);
    expect(contrast(light, darkRaised)).toBeLessThan(AA);
  });

  it('the bare --c-danger it replaces is the measured deficit (why the narrow token exists)', () => {
    const lightDanger = tokenFrom(css, '--c-danger', 0);
    expect(lightDanger).toBe('#e80538');
    // 4,45:1 on --c-surface-raised (CTO's pixel measurement) and 4,46:1 on
    // --c-bg — under AA. If this ever passes, the narrow token can be folded
    // back into --c-danger and this guard should be deleted with it.
    expect(contrast(lightDanger, lightRaised)).toBeLessThan(AA);
    expect(contrast(lightDanger, lightBg)).toBeLessThan(AA);
  });

  it('the token is registered in the canonical c.* Tailwind namespace', () => {
    const config = read('tailwind.config.js');
    expect(config).toMatch(/'danger-on-surface':\s*cTok\('danger-on-surface'\)/);
  });
});

const program: AuditProgramSummary = {
  id: 'prog-d54',
  name: 'Q3 Compliance Audit',
  packId: 'pack-1',
  packTitle: 'ISO 19011 Audit Pack',
  packVersion: 1,
  lifecycleState: 'fieldwork',
  applicableCriteria: 1,
  concludedCriteria: 0,
  openFindings: 0,
  leadAuditorId: 'u1',
  leadAuditorName: 'Ada Lovelace',
  plannedStart: null,
  plannedEnd: null,
  updatedAt: '2026-09-17',
};

describe('D-54 — the gates alert consumes the token', () => {
  beforeEach(() => {
    vi.mocked(getProgram).mockResolvedValue({
      ...program,
      objective: null,
      scopeText: null,
      projectId: null,
      members: [],
    } as any);
    vi.mocked(getProgramCoverage).mockResolvedValue({
      applicableCriteria: 1,
      concludedCriteria: 0,
      insufficientEvidenceCriteria: 0,
    });
    vi.mocked(getProgramLifecycle).mockRejectedValue(new Error('lifecycle unavailable'));
    vi.mocked(listProgramCriteria).mockResolvedValue([]);
  });

  it('renders role=alert with text-c-danger-on-surface, not bare text-c-danger', async () => {
    render(
      <MemoryRouter initialEntries={['/audit-programs?tab=processes']}>
        <AuditProcessesTab
          programs={[program]}
          loading={false}
          error={null}
          onRetry={() => {}}
          isPolish={false}
          onProgramChanged={() => {}}
        />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText('Q3 Compliance Audit'));
    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('Could not load next-stage gates.');
    expect(alert.className.split(/\s+/)).toContain('text-c-danger-on-surface');
    expect(alert.className.split(/\s+/)).not.toContain('text-c-danger');
  });
});
