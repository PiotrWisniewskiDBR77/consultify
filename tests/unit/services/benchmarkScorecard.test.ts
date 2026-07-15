import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  findResultFiles,
  loadAllRuns,
  loadRunResultFile,
  parseScorecardArgs,
  pickLatestRun,
  renderScorecardMarkdown,
  runScorecard,
  type LoadedRun,
  type RunResultFile,
} from '../../../server/scripts/benchmark-scorecard.js';

function makeRun(overrides: Partial<RunResultFile> = {}): RunResultFile {
  return {
    runId: 'run-1',
    corpusHash: 'hash1',
    timestamp: '2026-07-10T09:00:00.000Z',
    tier: 'standard',
    adapterSource: 'real',
    taskCount: 4,
    scorecard: {
      totalTasks: 4,
      gradedTasks: 3,
      ungradedTasks: 1,
      passCount: 2,
      failCount: 1,
      passRatePct: 66.7,
      averageDimensions: {
        answerFirst: 3.5,
        meceStructure: 4,
        grounding: 3,
        actionability: 4.5,
        evidenceDiscipline: 3.5,
      },
      byArchetype: {
        diagnostic: { total: 3, pass: 2, fail: 1, ungraded: 0 },
        synthetic: { total: 1, pass: 0, fail: 0, ungraded: 1 },
      },
      byDomain: {
        'Domain A': { total: 2, pass: 1, fail: 1, ungraded: 0 },
        'Domain B': { total: 2, pass: 1, fail: 0, ungraded: 1 },
      },
    },
    ...overrides,
  };
}

describe('benchmark-scorecard: pure rendering', () => {
  it('renders a "no graded runs yet" card when there is no run, and fabricates nothing', () => {
    const md = renderScorecardMarkdown(null, []);
    expect(md).toContain('No graded runs yet');
    expect(md).toContain('Czego nie twierdzimy');
    expect(md).not.toMatch(/Pass rate: \d/); // no numeric pass rate anywhere
  });

  it('renders overall pass rate, dimensions, archetype and domain tables for a single run', () => {
    const run = makeRun();
    const md = renderScorecardMarkdown({ filePath: '/x/run-1.json', run }, []);

    expect(md).toContain('run-1');
    expect(md).toContain('hash1');
    expect(md).toContain('Graded: 3 / 4 (ungraded: 1)');
    expect(md).toContain('66.7%');
    expect(md).toContain('Answer-first');
    expect(md).toContain('3.50');
    expect(md).toContain('diagnostic');
    expect(md).toContain('Domain A');
    expect(md).toContain('Czego nie twierdzimy');
  });

  it('never fabricates a pass rate when gradedTasks is 0, even with a real run present', () => {
    const run = makeRun({
      scorecard: {
        totalTasks: 2,
        gradedTasks: 0,
        ungradedTasks: 2,
        passCount: 0,
        failCount: 0,
        passRatePct: null,
        averageDimensions: null,
        byArchetype: { diagnostic: { total: 2, pass: 0, fail: 0, ungraded: 2 } },
        byDomain: {},
      },
    });
    const md = renderScorecardMarkdown({ filePath: '/x/run-1.json', run }, []);
    expect(md).toContain('n/a (0 graded tasks — nothing fabricated)');
    expect(md).toContain('n/a — 0 graded tasks, no dimension scores to average.');
  });

  it('lists other runs as context only, without blending them into the headline numbers', () => {
    const latestRun = makeRun({ runId: 'run-latest', timestamp: '2026-07-12T00:00:00.000Z' });
    const olderRun = makeRun({ runId: 'run-older', timestamp: '2026-07-01T00:00:00.000Z' });
    const md = renderScorecardMarkdown({ filePath: '/x/run-latest.json', run: latestRun }, [
      { filePath: '/x/run-older.json', run: olderRun },
    ]);
    expect(md).toContain('run-latest');
    expect(md).toContain('Other available runs');
    expect(md).toContain('run-older');
    // Headline numbers must still be the latest run's (66.7%), not an average.
    expect(md).toContain('66.7%');
  });
});

describe('benchmark-scorecard: tolerant loading', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'benchmark-scorecard-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('findResultFiles returns [] for a missing directory (never throws)', () => {
    expect(findResultFiles(path.join(tmpDir, 'does-not-exist'))).toEqual([]);
  });

  it('loadRunResultFile returns null for malformed JSON, never throws', () => {
    const filePath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(filePath, '{ not valid json', 'utf8');
    expect(loadRunResultFile(filePath)).toBeNull();
  });

  it('loadRunResultFile returns null when required fields are missing', () => {
    const filePath = path.join(tmpDir, 'incomplete.json');
    fs.writeFileSync(filePath, JSON.stringify({ runId: 'x' }), 'utf8');
    expect(loadRunResultFile(filePath)).toBeNull();
  });

  it('loadRunResultFile parses a well-formed run file', () => {
    const filePath = path.join(tmpDir, 'good.json');
    fs.writeFileSync(filePath, JSON.stringify(makeRun()), 'utf8');
    const parsed = loadRunResultFile(filePath);
    expect(parsed).not.toBeNull();
    expect(parsed?.runId).toBe('run-1');
    expect(parsed?.scorecard.passRatePct).toBe(66.7);
  });

  it('loadAllRuns skips corrupt files and keeps valid ones; pickLatestRun picks the newest by timestamp', () => {
    const corpusDir = path.join(tmpDir, 'hashA');
    fs.mkdirSync(corpusDir, { recursive: true });
    fs.writeFileSync(path.join(corpusDir, 'corrupt.json'), '{{{', 'utf8');
    fs.writeFileSync(
      path.join(corpusDir, 'old.json'),
      JSON.stringify(makeRun({ runId: 'old-run', timestamp: '2026-01-01T00:00:00.000Z' })),
      'utf8'
    );
    fs.writeFileSync(
      path.join(corpusDir, 'new.json'),
      JSON.stringify(makeRun({ runId: 'new-run', timestamp: '2026-06-01T00:00:00.000Z' })),
      'utf8'
    );

    const runs: LoadedRun[] = loadAllRuns(tmpDir);
    expect(runs.length).toBe(2); // corrupt.json skipped

    const latest = pickLatestRun(runs);
    expect(latest?.run.runId).toBe('new-run');
  });
});

describe('benchmark-scorecard: CLI args', () => {
  it('rejects unknown flags', () => {
    const result = parseScorecardArgs(['--bogus']);
    expect(result.ok).toBe(false);
  });

  it('applies defaults when no flags are given', () => {
    const result = parseScorecardArgs([]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.args.resultsDir).toBe(path.join('benchmark', 'results'));
      expect(result.args.outputPath).toBe(path.join('benchmark', 'SCORECARD.md'));
      expect(result.args.quiet).toBe(false);
    }
  });

  it('honors --results-dir/--output/--quiet overrides', () => {
    const result = parseScorecardArgs(['--results-dir', '/tmp/r', '--output', '/tmp/o.md', '--quiet']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.args.resultsDir).toBe('/tmp/r');
      expect(result.args.outputPath).toBe('/tmp/o.md');
      expect(result.args.quiet).toBe(true);
    }
  });
});

describe('benchmark-scorecard: end-to-end runScorecard()', () => {
  let tmpDir: string;
  let resultsDir: string;
  let outputPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'benchmark-scorecard-e2e-'));
    resultsDir = path.join(tmpDir, 'results');
    outputPath = path.join(tmpDir, 'SCORECARD.md');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes a "no graded runs yet" card when the results dir is empty/missing (exit 0)', async () => {
    const exitCode = await runScorecard(['--results-dir', resultsDir, '--output', outputPath, '--quiet']);
    expect(exitCode).toBe(0);
    const content = fs.readFileSync(outputPath, 'utf8');
    expect(content).toContain('No graded runs yet');
  });

  it('writes a populated card from a single run file (exit 0)', async () => {
    const corpusDir = path.join(resultsDir, 'hash1');
    fs.mkdirSync(corpusDir, { recursive: true });
    fs.writeFileSync(path.join(corpusDir, 'run-1.json'), JSON.stringify(makeRun()), 'utf8');

    const exitCode = await runScorecard(['--results-dir', resultsDir, '--output', outputPath, '--quiet']);
    expect(exitCode).toBe(0);
    const content = fs.readFileSync(outputPath, 'utf8');
    expect(content).toContain('run-1');
    expect(content).toContain('66.7%');
    expect(content).toContain('Czego nie twierdzimy');
  });
});
