import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../SWOTInputExplorationPhase.tsx'), 'utf8');

describe('Dynamic SWOT Input & Exploration owner feedback', () => {
  it('keeps one category selector and removes duplicate summary counters', () => {
    expect(source).not.toContain('xl:grid-cols-[180px_minmax(0,1fr)]');
    expect(source).not.toContain('{labels.totalAccepted}');
    expect(source).not.toContain('{labels.confirmedAreas}');
    expect(source).not.toContain('{labels.activeDialogue}');
    expect(source).not.toContain('{labels.maxTarget}');
    expect(source).not.toContain('{labels.attempts}: {attemptCountByStream[streamId]}');
  });

  it('opens manual entry from an explicit action and suppresses an empty accepted card', () => {
    expect(source).toContain("'Add point manually'");
    expect(source).toContain('setManualEntryOpen(true)');
    expect(source).toContain('acceptedSignals.length > 0 &&');
    expect(source).not.toContain('{labels.emptyAccepted}');
  });
});
