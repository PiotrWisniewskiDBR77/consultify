// KONTRAKT DYŻURU 346 — kompletność oznacza odpowiedzi, nie cele metodyki.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildDrdReportConclusion } from '../../../server/src/services/conclusions/reportConclusionBridge';
import { buildDrdReportModel as buildServerModel } from '../../../server/src/services/report/drdReportModel';
import { buildDrdReportModel as buildFrontendModel } from '../../../src/services/report/drdReportModel';
import { buildDemoLayoutLabel } from '../../../scripts/dev/day339-porownanie-silnikow.mjs';

type Score = { actual: number; target: number };
type Scores = Record<string, Score>;

const manifest = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'evidence/silniki-raportu-oceny-20260904/day339-engine-manifest.json'),
    'utf8'
  )
) as { input: { areaScores: Scores } };

const meta = {
  organizationName: 'Pomiar 346',
  language: 'pl' as const,
  assessmentName: 'Kontrakt kompletności',
};

describe('Dyżur 346 — prawdziwa kompletność raportu DRD', () => {
  it('buduje jawną etykietę hybrydy silnika 298 z identyfikatorem sesji', () => {
    expect(buildDemoLayoutLabel('session-39-of-39')).toBe(
      'DEMO UKŁADU — treść prototypowa, liczby z sesji session-39-of-39'
    );
  });

  it('liczy 7/39 odpowiedzi jako 18% w obu modelach i przekazuje 18% do narratora', async () => {
    const server = await buildServerModel(manifest.input.areaScores, meta);
    const frontend = await buildFrontendModel(manifest.input.areaScores, meta);

    for (const model of [server, frontend]) {
      expect(model.credibility).toMatchObject({
        assessedAreas: 7,
        totalAreas: 39,
        completionPercent: 18,
        confidenceLabel: 'Niewystarczająca',
      });
    }

    const conclusion = buildDrdReportConclusion(server, { reportId: 'day346-test' });
    expect(conclusion?.contextSummary).toContain('(18% assessed,');
    expect(conclusion?.contextSummary).not.toContain('(100% assessed,');
  });

  it('zachowuje 100%, 39/39 i wysoką wiarygodność dla pełnej sesji', async () => {
    const completeScores = Object.fromEntries(
      Object.entries(manifest.input.areaScores).map(([id, score]) => [
        id,
        { ...score, actual: score.actual > 0 ? score.actual : 1 },
      ])
    );

    const server = await buildServerModel(completeScores, meta);
    const frontend = await buildFrontendModel(completeScores, meta);

    for (const model of [server, frontend]) {
      expect(model.credibility).toMatchObject({
        assessedAreas: 39,
        totalAreas: 39,
        completionPercent: 100,
        confidenceLabel: 'Wysoka',
      });
    }
  });
});
