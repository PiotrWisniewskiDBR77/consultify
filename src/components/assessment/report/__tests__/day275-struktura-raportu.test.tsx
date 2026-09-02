/** @vitest-environment jsdom */
import fs from 'node:fs';
import path from 'node:path';

import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { AssessmentReportDocument } from '../AssessmentReportDocument';
import type { AssessmentReportData } from '../types';

const output = {
  id: 'out-275',
  organizationId: 'org-275',
  sessionId: 'session-275',
  snapshotId: 'snap-275',
  module: 'assessment',
  methodPackId: 'drd',
  methodPackVersion: '2.0.0-methodpack.1',
  outputVersion: 1,
  revisionOfOutputId: null,
  scope: 'Dyżur 275',
  current: { '1A': 3 },
  target: { '1A': 5 },
  gap: { '1A': 2 },
  aggregation: { byGroup: { 'axis-1': 3 }, mappingVersion: 'v1', rule: 'mean', excluded: {} },
  visualModel: null,
  evidenceCompleteness: {
    totalUnits: 1,
    unitsWithAcceptedEvidence: 1,
    unitsMissingEvidence: 0,
    completenessRatio: 1,
  },
  limitations: [],
  findings: [],
  prioritisationResult: null,
  sourceRevisionOfSessionId: null,
  contentHash: 'sha256-day275',
  createdAt: '2026-09-02T10:00:00Z',
  frozenAt: '2026-09-02T10:00:00Z',
  demoBypassActive: false,
} as AssessmentReportData['output'];

describe('Day 275 — struktura raportu Oceny i rozłączność raportu audytu', () => {
  it('renderuje 4 rozdziały w formule właściciela, a opis osi przed pierwszym obszarem', () => {
    const data = {
      output,
      superseded: false,
      supersededByOutputId: null,
      session: null,
      approvals: [],
    };
    const { container } = render(<AssessmentReportDocument data={data} />);
    expect(
      Array.from(container.querySelectorAll('#wstep, #osie, #odpowiedzi, #podsumowanie')).map(
        (n) => n.id
      )
    ).toEqual(['wstep', 'osie', 'odpowiedzi', 'podsumowanie']);
    const axis = container.querySelector('#os-1');
    expect(axis).not.toBeNull();
    const text = axis?.textContent ?? '';
    expect(
      text.indexOf('Assessment of digital transformation across core business processes')
    ).toBeLessThan(text.indexOf('1A'));
  });

  it('raport audytu ma własną kolejność sekcji i nie importuje kompozytora Oceny', () => {
    const root = process.cwd();
    const renderer = fs.readFileSync(
      path.join(root, 'server/src/services/audits/reportRenderer.ts'),
      'utf8'
    );
    const expected = [
      "id: 'executive_summary'",
      "id: 'scope'",
      "id: 'methodology'",
      "id: 'limitations'",
      "id: 'overall_conclusion'",
      "id: 'findings_by_severity'",
      "id: 'findings_by_area'",
    ];
    let cursor = -1;
    for (const marker of expected) {
      const next = renderer.indexOf(marker, cursor + 1);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
    const files = fs
      .readdirSync(path.join(root, 'server/src/services/audits'), { recursive: true })
      .filter((name) => String(name).endsWith('.ts'));
    const auditSource = files
      .map((name) =>
        fs.readFileSync(path.join(root, 'server/src/services/audits', String(name)), 'utf8')
      )
      .join('\n');
    expect(auditSource).not.toMatch(
      /AssessmentReportDocument|DRDMatrixReadOnly|buildPresentationDeck/
    );
  });
});
