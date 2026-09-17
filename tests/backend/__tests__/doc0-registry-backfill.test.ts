import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_LOG_PATH,
  Doc0CliUsageError,
  parseArgs,
  runCli,
  type Doc0CliDeps,
} from '../../../server/scripts/doc0-registry-backfill.js';

/**
 * DOC-0 etap 1 (b) (Wpis 68 · DEC-594/DEC-595) — CLI `doc0-registry-backfill.ts`.
 * Testuje parser argumentów i kontrakt trybów na wstrzykniętych zależnościach:
 * dry-run NIE pisze (zero wywołań backfill/archive/restore/writeLog), apply pisze
 * log z `archiveEntries`, restore czyta log i cofa archiwizację + wiersze backfillu.
 * Przebieg na kopii dumpu (119/6 → apply → 0/0 → restore → 119/6) = meldunek Wpis 68.
 */

function makeDeps(overrides: Partial<Doc0CliDeps> = {}): { deps: Doc0CliDeps; calls: string[] } {
  const calls: string[] = [];
  const deps: Doc0CliDeps = {
    env: { DATABASE_URL: 'postgres://test' },
    findUnlisted: vi.fn(async () => {
      calls.push('findUnlisted');
      return new Array(119).fill({});
    }),
    findContentless: vi.fn(async () => {
      calls.push('findContentless');
      return new Array(6).fill({});
    }),
    backfill: vi.fn(async () => {
      calls.push('backfill');
      return { dryRun: false, scanned: 119, inserted: 119, failed: 0, skippedUnsupportedType: 0, byFamily: {} };
    }),
    archive: vi.fn(async () => {
      calls.push('archive');
      return {
        dryRun: false,
        scanned: 6,
        archived: 6,
        alreadyArchived: 0,
        entries: [
          {
            artifactId: 'art-orphan',
            organizationId: 'org-1',
            previousDeliveryState: 'ready',
            title: 'Orphan',
          },
        ],
      };
    }),
    restore: vi.fn(async () => {
      calls.push('restore');
      return { restored: 1, failed: 0 };
    }),
    removeBackfilledRows: vi.fn(async () => {
      calls.push('removeBackfilledRows');
      return { linksDeleted: 119, artifactsDeleted: 119 };
    }),
    readLog: vi.fn(() => {
      calls.push('readLog');
      return null;
    }),
    writeLog: vi.fn(() => {
      calls.push('writeLog');
    }),
    print: vi.fn(() => {
      calls.push('print');
    }),
    now: () => '2026-09-17T12:00:00.000Z',
    ...overrides,
  };
  return { deps, calls };
}

describe('parseArgs — tryb domyślny i flagi', () => {
  it('bez argumentów = dry-run z domyślnym logiem', () => {
    expect(parseArgs([])).toEqual({ mode: 'dry-run', logPath: DEFAULT_LOG_PATH });
  });

  it('--apply / --restore / --dry-run ustawiają tryb jawnie', () => {
    expect(parseArgs(['--apply']).mode).toBe('apply');
    expect(parseArgs(['--restore']).mode).toBe('restore');
    expect(parseArgs(['--dry-run']).mode).toBe('dry-run');
  });

  it('sprzeczne tryby = błąd (nie zgadujemy)', () => {
    expect(() => parseArgs(['--apply', '--restore'])).toThrow(Doc0CliUsageError);
    expect(() => parseArgs(['--dry-run', '--apply'])).toThrow(Doc0CliUsageError);
  });

  it('nieznany argument = błąd (mutacja: domyślny tryb apply byłby widoczny tu i w dry-run)', () => {
    expect(() => parseArgs(['--force'])).toThrow(Doc0CliUsageError);
    expect(() => parseArgs(['--org'])).toThrow(Doc0CliUsageError);
  });

  it('--org i --log w obu formach', () => {
    expect(parseArgs(['--org=org-1', '--log=/tmp/x.json'])).toEqual({
      mode: 'dry-run',
      logPath: '/tmp/x.json',
      organizationId: 'org-1',
    });
    expect(parseArgs(['--org', 'org-2', '--log', '/tmp/y.json'])).toEqual({
      mode: 'dry-run',
      logPath: '/tmp/y.json',
      organizationId: 'org-2',
    });
  });
});

describe('runCli — kontrakt trybów', () => {
  it('brak DATABASE_URL = exit 1 i ZERO wywołań bazy', async () => {
    const { deps, calls } = makeDeps({ env: {} });
    const code = await runCli({ mode: 'dry-run', logPath: DEFAULT_LOG_PATH }, deps);
    expect(code).toBe(1);
    expect(calls.filter((c) => c !== 'print')).toEqual([]);
  });

  it('dry-run drukuje liczby unlisted/contentless i NIE pisze (mutacja: write → czerwony)', async () => {
    const { deps, calls } = makeDeps();
    const code = await runCli({ mode: 'dry-run', logPath: DEFAULT_LOG_PATH }, deps);
    expect(code).toBe(0);
    expect(calls).toContain('findUnlisted');
    expect(calls).toContain('findContentless');
    const writes = calls.filter((c) =>
      ['backfill', 'archive', 'restore', 'removeBackfilledRows', 'writeLog'].includes(c)
    );
    expect(writes).toEqual([]);
    const printed = (deps.print as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(printed.some((line) => line.includes('unlisted=119') && line.includes('contentless=6'))).toBe(true);
  });

  it('apply woła backfill+archive z dryRun:false i zapisuje log z archiveEntries', async () => {
    const { deps } = makeDeps();
    const code = await runCli(
      { mode: 'apply', logPath: '/tmp/doc0-log.json', organizationId: 'org-1' },
      deps
    );
    expect(code).toBe(0);
    expect(deps.backfill).toHaveBeenCalledWith({ organizationId: 'org-1', dryRun: false });
    expect(deps.archive).toHaveBeenCalledWith({ organizationId: 'org-1', dryRun: false });
    const [path, contents] = (deps.writeLog as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toBe('/tmp/doc0-log.json');
    const log = JSON.parse(String(contents));
    expect(log.appliedAt).toBe('2026-09-17T12:00:00.000Z');
    expect(log.organizationId).toBe('org-1');
    expect(log.backfill.inserted).toBe(119);
    expect(log.archived).toBe(6);
    expect(log.archiveEntries[0].artifactId).toBe('art-orphan');
    expect(log.archiveEntries[0].previousDeliveryState).toBe('ready');
  });

  it('restore bez logu = exit 1 i zero wywołań zapisujących', async () => {
    const { deps, calls } = makeDeps();
    const code = await runCli({ mode: 'restore', logPath: DEFAULT_LOG_PATH }, deps);
    expect(code).toBe(1);
    expect(calls).not.toContain('restore');
    expect(calls).not.toContain('removeBackfilledRows');
  });

  it('restore z logiem cofa archiwizację wpisem z logu i usuwa wiersze backfillu', async () => {
    const entries = [
      { artifactId: 'art-a', organizationId: 'org-1', previousDeliveryState: 'ready', title: 'A' },
      { artifactId: 'art-b', organizationId: 'org-1', previousDeliveryState: 'draft', title: 'B' },
    ];
    const { deps, calls } = makeDeps({
      readLog: () => JSON.stringify({ appliedAt: 'x', organizationId: null, backfill: {}, archived: 2, archiveEntries: entries }),
    });
    const code = await runCli({ mode: 'restore', logPath: DEFAULT_LOG_PATH }, deps);
    expect(code).toBe(0);
    expect(deps.restore).toHaveBeenCalledWith(entries);
    expect(calls).toContain('removeBackfilledRows');
  });

  it('restore z uszkodzonym JSON-em = exit 1 (nie zgadujemy)', async () => {
    const { deps, calls } = makeDeps({ readLog: () => '{not json' });
    const code = await runCli({ mode: 'restore', logPath: DEFAULT_LOG_PATH }, deps);
    expect(code).toBe(1);
    expect(calls).not.toContain('restore');
  });
});
