/**
 * CI gate: Presentation Governance Card check.
 *
 * Purpose:
 *   Fetches the Governance Card for a list of decks via the Consultify Presentation API,
 *   aggregates per-deck verdicts, prints a concise summary, optionally writes a JSON
 *   report, and exits non-zero when any deck is BLOCKED_P0/BLOCKED_P1 or unreachable.
 *
 * Run:
 *   npx tsx server/scripts/check-presentation-governance.ts \
 *     --deck-ids "deck_a,deck_b,deck_c" \
 *     --api-url "https://demo.consultify.ai/api" \
 *     --token "$CONSULTIFY_TOKEN" \
 *     [--allow-inconclusive] \
 *     [--report-file "out/governance.json"]
 *
 * Reference:
 *   docs/testing/CI_GATE_PRESENTATION_GOVERNANCE.md
 *   docs/testing/PRESENTATION_QUALITY_GOVERNANCE_SCORECARD.md
 */
import fs from 'node:fs';
import path from 'node:path';

type OverallVerdict =
  | 'PASS'
  | 'PASS_WITH_P2'
  | 'BLOCKED_P0'
  | 'BLOCKED_P1'
  | 'INCONCLUSIVE'
  | string;

type FetchError = null | string;

type DeckResult = {
  deckId: string;
  overallVerdict: OverallVerdict | null;
  qualityVerdict: string | null;
  blockerReasons: string[];
  lastActivityAt: string | null;
  fetchError: FetchError;
};

type GovernanceReport = {
  checkedAt: string;
  apiUrl: string;
  totals: {
    checked: number;
    passes: number;
    blocked: number;
    inconclusive: number;
  };
  decks: DeckResult[];
};

type ParsedArgs = {
  deckIds: string[];
  apiUrl: string;
  token: string;
  allowInconclusive: boolean;
  reportFile: string | null;
};

const EXIT_OK = 0;
const EXIT_BLOCKED = 1;
const EXIT_ARG_ERROR = 2;

function logLine(message: string): void {
  // eslint-disable-next-line no-console
  console.log(message);
}

function logError(message: string): void {
  // eslint-disable-next-line no-console
  console.error(message);
}

function getFlagValue(argv: string[], name: string): string | null {
  const longEq = `--${name}=`;
  for (let i = 0; i < argv.length; i++) {
    const cur = argv[i] ?? '';
    if (cur.startsWith(longEq)) {
      return cur.slice(longEq.length);
    }
    if (cur === `--${name}`) {
      const next = argv[i + 1];
      if (next != null && !next.startsWith('--')) {
        return next;
      }
      return '';
    }
  }
  return null;
}

function hasBooleanFlag(argv: string[], name: string): boolean {
  const value = getFlagValue(argv, name);
  if (value == null) return false;
  if (value === '' || value.toLowerCase() === 'true') return true;
  return false;
}

function readDeckIdsFromFile(filePath: string): string[] {
  const abs = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { deckIds?: unknown }).deckIds)
  ) {
    throw new Error(`File ${filePath} must be a JSON object of shape { deckIds: string[] }.`);
  }
  const ids = (parsed as { deckIds: unknown[] }).deckIds
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return ids;
}

function parseArgs(argv: string[]): ParsedArgs {
  const deckIdsCsv = getFlagValue(argv, 'deck-ids');
  const deckIdsFile = getFlagValue(argv, 'deck-ids-file');

  let deckIds: string[] = [];
  if (deckIdsCsv != null && deckIdsCsv.length > 0) {
    deckIds = deckIdsCsv
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } else if (deckIdsFile != null && deckIdsFile.length > 0) {
    deckIds = readDeckIdsFromFile(deckIdsFile);
  } else {
    throw new Error('Missing required arg: --deck-ids "id1,id2" or --deck-ids-file path/to/file.json');
  }

  if (deckIds.length === 0) {
    throw new Error('Argument --deck-ids resolved to an empty list. Provide at least one deck id.');
  }

  const apiUrlArg = getFlagValue(argv, 'api-url');
  const apiUrl = (apiUrlArg && apiUrlArg.length > 0
    ? apiUrlArg
    : process.env.CONSULTIFY_API_URL || ''
  ).replace(/\/+$/, '');
  if (!apiUrl) {
    throw new Error('Missing required arg: --api-url or env CONSULTIFY_API_URL');
  }

  const tokenArg = getFlagValue(argv, 'token');
  const token = tokenArg && tokenArg.length > 0 ? tokenArg : process.env.CONSULTIFY_TOKEN || '';

  const allowInconclusive = hasBooleanFlag(argv, 'allow-inconclusive');

  const reportFileArg = getFlagValue(argv, 'report-file');
  const reportFile = reportFileArg && reportFileArg.length > 0 ? reportFileArg : null;

  return {
    deckIds,
    apiUrl,
    token,
    allowInconclusive,
    reportFile,
  };
}

function maskApiUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    return `${u.protocol}//***${u.pathname || ''}`;
  } catch {
    return '***';
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function extractGovernance(deckId: string, payload: unknown): DeckResult {
  const root =
    payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)
      ? (payload as { data?: unknown }).data
      : payload;

  const card =
    root && typeof root === 'object' && 'governanceCard' in (root as Record<string, unknown>)
      ? (root as { governanceCard?: unknown }).governanceCard
      : root;

  const cardObj = (card && typeof card === 'object' ? (card as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;

  const overallVerdict = asString(cardObj.overallVerdict);
  const qualityVerdict =
    asString(cardObj.qualityVerdict) ??
    asString(cardObj.releaseResult) ??
    asString(cardObj.gateResult);
  const blockerReasons = asStringArray(
    cardObj.blockerReasons ?? cardObj.blockers ?? cardObj.reasons
  );
  const lastActivityAt =
    asString(cardObj.lastActivityAt) ??
    asString(cardObj.updatedAt) ??
    asString(cardObj.lastEvaluatedAt);

  return {
    deckId,
    overallVerdict,
    qualityVerdict,
    blockerReasons,
    lastActivityAt,
    fetchError: null,
  };
}

async function fetchOne(args: ParsedArgs, deckId: string): Promise<DeckResult> {
  const safeDeckId = encodeURIComponent(deckId);
  const url = `${args.apiUrl}/presentations/decks/${safeDeckId}/governance-card`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (args.token) {
    headers.Authorization = `Bearer ${args.token}`;
  }

  try {
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      return {
        deckId,
        overallVerdict: null,
        qualityVerdict: null,
        blockerReasons: [],
        lastActivityAt: null,
        fetchError: `http_${response.status}`,
      };
    }
    const json: unknown = await response.json();
    return extractGovernance(deckId, json);
  } catch {
    return {
      deckId,
      overallVerdict: null,
      qualityVerdict: null,
      blockerReasons: [],
      lastActivityAt: null,
      fetchError: 'network_error',
    };
  }
}

function classify(deck: DeckResult, allowInconclusive: boolean): 'pass' | 'blocked' | 'inconclusive' {
  if (deck.fetchError) return 'blocked';
  const verdict = deck.overallVerdict;
  if (verdict === 'PASS' || verdict === 'PASS_WITH_P2') return 'pass';
  if (verdict === 'BLOCKED_P0' || verdict === 'BLOCKED_P1') return 'blocked';
  if (verdict === 'INCONCLUSIVE') return allowInconclusive ? 'pass' : 'inconclusive';
  return 'inconclusive';
}

function buildReport(args: ParsedArgs, decks: DeckResult[]): GovernanceReport {
  let passes = 0;
  let blocked = 0;
  let inconclusive = 0;
  for (const deck of decks) {
    const bucket = classify(deck, args.allowInconclusive);
    if (bucket === 'pass') passes++;
    else if (bucket === 'blocked') blocked++;
    else inconclusive++;
  }

  return {
    checkedAt: new Date().toISOString(),
    apiUrl: maskApiUrl(args.apiUrl),
    totals: {
      checked: decks.length,
      passes,
      blocked,
      inconclusive,
    },
    decks,
  };
}

function reasonForSummary(deck: DeckResult): string {
  if (deck.fetchError) return deck.fetchError;
  if (deck.overallVerdict) return deck.overallVerdict;
  return 'unknown';
}

function printSummary(report: GovernanceReport, decks: DeckResult[], allowInconclusive: boolean): void {
  const blockedDescriptors = decks
    .filter((d) => classify(d, allowInconclusive) === 'blocked')
    .map((d) => `${d.deckId}: ${reasonForSummary(d)}`);

  logLine('Presentation Governance Check');
  logLine(`- Checked: ${report.totals.checked}`);
  logLine(`- Pass: ${report.totals.passes}`);
  if (blockedDescriptors.length > 0) {
    logLine(`- Blocked: ${report.totals.blocked} (${blockedDescriptors.join(', ')})`);
  } else {
    logLine(`- Blocked: ${report.totals.blocked}`);
  }
  logLine(`- Inconclusive: ${report.totals.inconclusive}`);
}

function writeReportFile(targetPath: string, report: GovernanceReport): void {
  const abs = path.resolve(process.cwd(), targetPath);
  const dir = path.dirname(abs);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main(): Promise<number> {
  let args: ParsedArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`[check-presentation-governance] Argument error: ${message}`);
    return EXIT_ARG_ERROR;
  }

  if (!args.token) {
    logLine('[check-presentation-governance] Note: no token provided (CONSULTIFY_TOKEN unset).');
  }
  logLine(`[check-presentation-governance] Target: ${maskApiUrl(args.apiUrl)}`);

  const decks: DeckResult[] = [];
  for (const deckId of args.deckIds) {
    const result = await fetchOne(args, deckId);
    decks.push(result);
  }

  const report = buildReport(args, decks);

  if (args.reportFile) {
    try {
      writeReportFile(args.reportFile, report);
      logLine(`[check-presentation-governance] Report written: ${args.reportFile}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`[check-presentation-governance] Failed to write report: ${message}`);
    }
  }

  printSummary(report, decks, args.allowInconclusive);

  return report.totals.blocked > 0 ? EXIT_BLOCKED : EXIT_OK;
}

let exitCode = EXIT_OK;
try {
  exitCode = await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  logError(`[check-presentation-governance] Fatal error: ${message}`);
  exitCode = EXIT_BLOCKED;
}

logLine(`Exit code: ${exitCode}`);
process.exit(exitCode);
