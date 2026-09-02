import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const decisionSource = fs.readFileSync(path.resolve(__dirname, '../DecisionDetailView.tsx'), 'utf8');
const stakeholderTypeSource = fs.readFileSync(
  path.resolve(__dirname, '../shared/StakeholdersSection.tsx'),
  'utf8'
);

describe('Day 222 DecisionDetailView RACI row actions', () => {
  it('does not render an attachment download action for a stakeholder row', () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    const rowStart = decisionSource.lastIndexOf('stakeholders.map((s) => (');
    const rowEnd = decisionSource.indexOf('</tr>', rowStart);
    const stakeholderRow = decisionSource.slice(rowStart, rowEnd);

    expect(rowStart).toBeGreaterThan(0);
    expect(stakeholderRow).not.toContain('handleDownloadAttachment');
    expect(stakeholderRow).not.toContain("'Download file'");
    expect(stakeholderRow).toContain('stakeholders.filter((item) => item.id !== s.id)');
  });

  it('keeps the stakeholder contract free of a fictional attachment field', () => {
    const typeStart = stakeholderTypeSource.indexOf('export interface Stakeholder {');
    const typeEnd = stakeholderTypeSource.indexOf('\n}', typeStart);
    const stakeholderType = stakeholderTypeSource.slice(typeStart, typeEnd);

    expect(stakeholderType).not.toMatch(/attachment/i);
  });
});
