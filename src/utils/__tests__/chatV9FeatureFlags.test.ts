/**
 * Chat V9 / ADMIN AG3 — tests for the feature flag registry.
 *
 * These tests are intentionally strict: the registry doubles as the contract
 * the owner runbook and the feature flags doc rely on. If someone adds a new
 * Chat V9 feature flag they must:
 *
 *   1. Register it in `chatV9FeatureFlags.ts` (this file breaks otherwise).
 *   2. Give it a unique `id`, a ticket code and at least one spec doc.
 *   3. Ensure the resolver respects the URL / localStorage / ENV contract.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CHAT_V9_FLAGS,
  clearChatV9FlagOverride,
  findChatV9Flag,
  getChatV9FlagOverrides,
  getChatV9FlagOverrideState,
  getChatV9FlagSnapshot,
  resetAllChatV9FlagOverrides,
  setChatV9FlagOverride,
} from '../chatV9FeatureFlags';

// Registry scope note (pass 33 · 2026-04-18)
// -------------------------------------------
// Earlier milestones planned ~13 flags, but only the helper module for VM4
// (`barge-in-toast`) actually exists in this submodule branch. The registry
// was trimmed in `chatV9FeatureFlags.ts` to only list flags whose resolvers
// compile; keep this list aligned with that trim.
const EXPECTED_IDS = [
  'barge-in-toast',
  'voice-mode-legend',
  'voice-legend-shortcut',
  // VM3.2 — "Copy legend" button in the popover footer.
  'voice-legend-copy-text',
  'voice-funnel-telemetry',
  'private-mode-details',
  'back-to-chat-button',
  'back-to-chat-shortcut',
  'workspace-breadcrumb',
  'workspace-breadcrumb-conversation',
  'workspace-breadcrumb-recents',
  'workspace-breadcrumb-recents-view-all',
  'workspace-breadcrumb-recents-pinned',
  'next-model-chip',
  'input-char-counter',
  'input-hint-strip',
  'trust-badge',
  'trust-badge-humanize-model',
  'trust-badge-copy-citations',
  'trust-badge-reasoning',
  'trust-badge-copy-reasoning',
  'trust-badge-citation-links',
  // T-TR3.4 — citation row domain pill.
  'trust-badge-citation-domain',
  'pii-heuristic-toast',
  'pii-heuristic-session-dismiss',
  'flags-snapshot-copy',
  'flags-reset-url',
  'flags-panel-filter',
  'flags-panel-grouping',
  'flags-panel-doc-links',
  // AG1 v1.8 / v1.9 — description expand toggle + sticky group headers.
  'flags-panel-description-expand',
  'flags-panel-sticky-group-headers',
  // AG1 v1.10 — per-row keyboard shortcuts (o/f/d).
  'flags-panel-row-shortcuts',
  // AG1 v1.11 — shortcut cheat-sheet pill in the panel header.
  'flags-panel-shortcut-cheat-sheet',
  // AG1 v1.13 — Escape clears the filter input.
  'flags-panel-filter-escape-clear',
  // AG1 v1.12 — "Copy override URL" header button.
  'flags-panel-override-url-copy',
  // NAV-M3.3 — recents dropdown roving arrow-key navigation.
  'workspace-breadcrumb-recents-arrow-keys',
  'workspace-breadcrumb-recents-trigger-arrow',
  // NAV-M3.5 — trigger-level ArrowUp opens + focuses last item.
  'workspace-breadcrumb-recents-trigger-arrow-up',
  // C-IN6-lite — one-shot soft-limit inline toast.
  'input-soft-limit-toast',
] as const;

describe('chatV9FeatureFlags registry', () => {
  it('registers exactly the flags in milestone order', () => {
    expect(CHAT_V9_FLAGS.map((f) => f.id)).toEqual([...EXPECTED_IDS]);
  });

  it('has no duplicate ids, localStorage keys, query keys or env keys', () => {
    const ids = CHAT_V9_FLAGS.map((f) => f.id);
    const lsKeys = CHAT_V9_FLAGS.map((f) => f.keys.localStorage);
    const qKeys = CHAT_V9_FLAGS.map((f) => f.keys.query);
    const envKeys = CHAT_V9_FLAGS.map((f) => f.keys.env);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(lsKeys).size).toBe(lsKeys.length);
    expect(new Set(qKeys).size).toBe(qKeys.length);
    expect(new Set(envKeys).size).toBe(envKeys.length);
  });

  it('every flag exposes a ticket code and at least one spec doc', () => {
    // Tickets follow `<LETTERS><optional -LETTERS><DIGITS>[.sub]` so
    // that the original single-word codes (e.g. `VM4`, `NA1`),
    // compound codes (e.g. `T-PM1`, `C-IN1`), and dotted sub-milestone
    // codes introduced by NAV-M1.1 all pass without further special-
    // casing.
    for (const flag of CHAT_V9_FLAGS) {
      expect(flag.ticket).toMatch(/^[A-Z]+(-[A-Z]+)?\d+(\.\d+)?$/);
      expect(flag.specDocs.length).toBeGreaterThanOrEqual(1);
      expect(flag.title.length).toBeGreaterThan(0);
      expect(flag.description.length).toBeGreaterThan(20);
    }
  });

  it('every flag defaults to ON for the M0 rollout', () => {
    for (const flag of CHAT_V9_FLAGS) {
      expect(flag.default).toBe(true);
    }
  });

  it('every flag uses the documented `ff.` / `ff_` / `VITE_` prefixes', () => {
    for (const flag of CHAT_V9_FLAGS) {
      expect(flag.keys.localStorage.startsWith('ff.')).toBe(true);
      expect(flag.keys.query.startsWith('ff_')).toBe(true);
      expect(flag.keys.env.startsWith('VITE_')).toBe(true);
    }
  });

  it('binds an isEnabled() resolver for every flag', () => {
    for (const flag of CHAT_V9_FLAGS) {
      expect(typeof flag.isEnabled).toBe('function');
      expect(() => flag.isEnabled()).not.toThrow();
    }
  });

  it('findChatV9Flag returns the descriptor for a known id and undefined otherwise', () => {
    expect(findChatV9Flag('barge-in-toast')?.ticket).toBe('VM4');
    expect(findChatV9Flag('not-a-real-flag')).toBeUndefined();
  });

  // Completeness guard (pass 80, 2026-04-18) — identity uniqueness for
  // the two descriptor fields that the earlier uniqueness test did NOT
  // cover: `ticket` codes (used in release notes and dev-plan anchors)
  // and `testId` strings (used as stable DOM hooks by Playwright and
  // unit tests). Accidentally copying a ticket from VM4 into a new VM5
  // entry would silently cause dashboards and runbooks to point at the
  // wrong row; accidentally reusing a testId would make two different
  // components fight for the same selector. Both categories stay small
  // (≤ 50 items) so a Set-based check is fine.
  it('every flag has a unique ticket code', () => {
    const tickets = CHAT_V9_FLAGS.map((f) => f.ticket);
    const duplicates = tickets.filter((t, i) => tickets.indexOf(t) !== i);
    expect(duplicates, `duplicate ticket codes: ${duplicates.join(', ')}`).toEqual([]);
  });

  it('every declared testId is kebab-case (nulls and sharing allowed)', () => {
    // `testId` is nullable and is allowed to repeat across flags:
    // several features legitimately mount into the same host DOM
    // node (e.g. the five `workspace-breadcrumb` flags all target
    // the breadcrumb container). What must hold is that the string
    // is a sane DOM selector: kebab-case, no whitespace, no upper-
    // case. A typo like `'workspaceBreadcrumb'` would point Playwright
    // at a selector that never matches.
    const KEBAB_RE = /^[a-z][a-z0-9-]*$/;
    const malformed: string[] = [];
    for (const flag of CHAT_V9_FLAGS) {
      if (typeof flag.testId === 'string' && !KEBAB_RE.test(flag.testId)) {
        malformed.push(`${flag.id} → "${flag.testId}"`);
      }
    }
    expect(malformed, `non-kebab-case testIds:\n${malformed.join('\n')}`).toEqual([]);
  });

  // Completeness guard (pass 80, 2026-04-18) — telemetry contract drift.
  // Each flag descriptor may declare an array of telemetry event names
  // that the feature emits. The source of truth for legal event names
  // is the `FunnelEventName` union in `src/services/funnelAnalytics.ts`.
  // If a flag declares an event that isn't in the union, the runbook
  // and the telemetry contract doc are lying — the event can never
  // actually land in analytics because the codebase would not compile.
  // We parse the union at test time (no runtime reflection on TS types
  // is possible) and diff it against the registry.
  it('every declared telemetry event exists in FunnelEventName', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const funnelSource = readFileSync(
      path.join(repoRoot, 'src', 'services', 'funnelAnalytics.ts'),
      'utf8'
    );
    const FUNNEL_EVENT_RE = /^\s*\|\s*'([a-z0-9_]+)'/gm;
    const knownEvents = new Set<string>();
    for (const match of funnelSource.matchAll(FUNNEL_EVENT_RE)) {
      knownEvents.add(match[1]);
    }
    // Sanity check: if we failed to parse even one event name, the
    // regex or the source format drifted; fail loudly rather than
    // falsely report "zero drift".
    expect(knownEvents.size, 'failed to parse any FunnelEventName entries').toBeGreaterThan(50);

    const orphans: string[] = [];
    for (const flag of CHAT_V9_FLAGS) {
      for (const eventName of flag.telemetry) {
        if (!knownEvents.has(eventName)) {
          orphans.push(`${flag.id} → ${eventName}`);
        }
      }
    }
    expect(orphans, `flag telemetry references unknown events:\n${orphans.join('\n')}`).toEqual([]);
  });

  // Completeness guard (pass 81, 2026-04-18) — telemetry contract doc
  // forward sync. The registry guard above (pass 80) catches events
  // that exist in the registry but NOT in the code union. This guard
  // catches the other direction: events that exist in the registry
  // but have no corresponding heading in the telemetry contract doc.
  // Without this, a new flag could ship with `telemetry: ['foo']`,
  // pass the FunnelEventName check (because you extended the union),
  // but silently skip the "write a payload + PII contract" step.
  it('every declared telemetry event has a heading in the telemetry contract doc', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const contractPath = path.join(
      repoRoot,
      'docs',
      'Chat V9',
      'CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md'
    );
    const contractSource = readFileSync(contractPath, 'utf8');

    // Collect every `## <event_name>` or `### <event_name>` heading
    // where the heading body is a bare `snake_case_identifier` (with
    // optional surrounding backticks). Those are the "canonical event
    // heading" form; prose headings like "## Ground rules" contain a
    // space and are correctly skipped.
    const headingSet = new Set<string>();
    const HEADING_RE = /^#{2,3}\s+`?([a-z][a-z0-9_]*)`?\s*$/gm;
    for (const match of contractSource.matchAll(HEADING_RE)) {
      headingSet.add(match[1]);
    }
    expect(
      headingSet.size,
      'failed to parse any event headings from the telemetry contract doc'
    ).toBeGreaterThan(5);

    const undocumented: string[] = [];
    for (const flag of CHAT_V9_FLAGS) {
      for (const eventName of flag.telemetry) {
        if (!headingSet.has(eventName)) {
          undocumented.push(`${flag.id} → ${eventName}`);
        }
      }
    }
    expect(
      undocumented,
      `telemetry events declared by a flag but missing a heading in the contract doc:\n${undocumented.join('\n')}`
    ).toEqual([]);
  });

  // Registry integrity guard. `src/utils` is shared by product modules, so a
  // global `*Flag.ts` scan cannot distinguish Chat V9 resolvers from Finance,
  // Ideas, Results, Agent, or Artifact Studio flags. Validate the registry's
  // own resolver imports against real files and exports instead of treating
  // unrelated product flags as Chat V9 orphans.
  it('every resolver imported by the registry exists and exports its declared function', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const utilsDir = path.join(repoRoot, 'src', 'utils');
    const registrySource = readFileSync(path.join(utilsDir, 'chatV9FeatureFlags.ts'), 'utf8');

    const resolverImports = [
      ...registrySource.matchAll(/import\s*{([\s\S]*?)}\s*from\s*['"]\.\/(.+Flag)['"];?/g),
    ].flatMap((match) => {
      const exportName = match[1]
        .split(',')
        .map((name) => name.trim())
        .find((name) => /^is[A-Z][A-Za-z0-9]*Enabled$/.test(name));
      return exportName ? [[match[0], exportName, match[2]]] : [];
    });
    const invalid: string[] = [];

    for (const [, exportName, moduleName] of resolverImports) {
      const fileName = `${moduleName}.ts`;
      const source = readFileSync(path.join(utilsDir, fileName), 'utf8');
      const exportPattern = new RegExp(`export\\s+function\\s+${exportName}\\s*\\(`);
      if (!exportPattern.test(source)) invalid.push(`${fileName}: missing ${exportName}`);
    }

    expect(resolverImports).toHaveLength(CHAT_V9_FLAGS.length);
    expect(invalid, `invalid resolver imports:\n${invalid.join('\n')}`).toEqual([]);
  });

  // Completeness guard (pass 82, 2026-04-18) — runbook §4 flag-reference
  // integrity. Section 4 of the operations runbook is the table an
  // on-call engineer consults during an incident: "symptom X, flip flag
  // Y". Every backticked flag id in that section must exist in the
  // registry. A renamed flag that left the runbook untouched would
  // cause an operator to type a non-existent `ff.<flag>=0` into the
  // console at 03:00 and watch the symptom continue — the exact
  // failure mode the runbook is supposed to prevent.
  //
  // The test parses the `## 4. Known failure modes` section, extracts
  // every backticked kebab-case identifier (modulo an allowlist of
  // known non-flag strings), and asserts each is a valid flag id.
  it('runbook §4 references only registered flag ids', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const runbookPath = path.join(
      repoRoot,
      'docs',
      'Chat V9',
      'CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md'
    );
    const runbookSource = readFileSync(runbookPath, 'utf8');

    // Slice the runbook between `## 4.` and the next `## ` heading.
    const SECTION_RE = /## 4\. [^\n]+\n([\s\S]*?)(?=\n## \d)/;
    const sectionMatch = SECTION_RE.exec(runbookSource);
    expect(sectionMatch, 'runbook §4 not found').not.toBeNull();
    const section = sectionMatch![1];

    // Registered flag ids (kebab-case) — the authoritative source.
    const registered = new Set<string>(CHAT_V9_FLAGS.map((f) => f.id));

    // Words that look kebab-ish but are not flag ids. Keep small; the
    // whole point is to catch typos, so each addition here must be
    // defensible.
    const NON_FLAG_ALLOWLIST = new Set<string>(['ff.<feature>', 'ff_<feature>']);

    // Extract every \`…\` occurrence whose body matches two-or-more
    // kebab segments (so bare words like `input` / `textarea` are not
    // misread as flags).
    const CODE_RE = /`([a-z][a-z0-9-]*-[a-z0-9-]+)`/g;
    const unknown = new Set<string>();
    for (const match of section.matchAll(CODE_RE)) {
      const candidate = match[1];
      if (NON_FLAG_ALLOWLIST.has(candidate)) continue;
      if (registered.has(candidate)) continue;
      unknown.add(candidate);
    }

    expect(
      [...unknown],
      `runbook §4 references flag ids that are not in the registry:\n${[...unknown].join('\n')}`
    ).toEqual([]);
  });

  // Completeness guard (pass 82, 2026-04-18) — README status table
  // ticket-column integrity. The pass-78 README cheat-sheet sync test
  // verifies every flag id appears in the "Shipped and tracked" table,
  // but it does NOT check that the ticket column (second column,
  // bolded like `**VM4**`) matches `flag.ticket`. A renamed ticket on
  // the registry side (e.g. sub-milestone promotion `VM4` → `VM4.0`)
  // would desync the README table without any test complaining. This
  // guard reads the row containing the flag id and asserts the ticket
  // cell matches.
  it('every README status-table row uses the registry ticket code', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const readmePath = path.join(repoRoot, 'docs', 'Chat V9', 'README.md');
    const readme = readFileSync(readmePath, 'utf8');

    // Identify rows between the `## Shipped and tracked` heading and
    // the next `## ` heading. This scopes the search and avoids the
    // kill-switch / localStorage cheat sheets (which do not carry a
    // ticket column).
    const SECTION_RE = /## Shipped and tracked\s*\n([\s\S]*?)(?=\n## )/;
    const sectionMatch = SECTION_RE.exec(readme);
    expect(sectionMatch, '"Shipped and tracked" section not found').not.toBeNull();
    const section = sectionMatch![1];

    // Two legacy cosmetic conventions exist in the README that the
    // registry does not mirror byte-for-byte:
    //
    //   1. `AG1 v1.N` (README) ↔ `AG1.N` (registry) — the "v1." prefix
    //      is a human-friendly shorthand for "AG1 iteration 1 point N".
    //   2. `X-lite`, `X-lite-plus`, `X-lite-v3` (README) ↔ `X`
    //      (registry) — the `-lite` suffix marks a scope-trimmed
    //      variant that shares the parent's ticket number.
    //
    // Both are meaningful in the audit plans and worth preserving in
    // the human-facing README. Strip them before comparing.
    const normalise = (raw: string): string =>
      raw
        .replace(/\s+/g, '')
        .replace(/^(AG\d+)v(\d+)\.(\d+)$/i, '$1.$3')
        .replace(/^(AG\d+)v1$/i, '$1')
        .replace(/-lite(?:-plus)*(?:-v\d+)?$/i, '')
        .trim();

    const mismatches: string[] = [];
    for (const flag of CHAT_V9_FLAGS) {
      const idCell = `\`${flag.id}\``;
      const rowRE = new RegExp(
        `^\\|[^\\n]*${idCell.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&')}[^\\n]*$`,
        'm'
      );
      const rowMatch = rowRE.exec(section);
      if (!rowMatch) {
        // The pass-78 sync test already catches "flag not mentioned
        // anywhere". Skip rows we cannot identify — not our job.
        continue;
      }
      const row = rowMatch[0];
      // Ticket cell format: `**<TICKET>**`, first two columns. The
      // README ticket may contain spaces (`AG1 v1.13`) and dashed
      // suffixes (`T-TR3-lite`), so accept a permissive body and
      // normalise afterwards.
      const TICKET_RE = /\*\*([A-Z][A-Za-z\d.\- ]+?)\*\*/;
      const ticketMatch = TICKET_RE.exec(row);
      if (!ticketMatch) {
        mismatches.push(`${flag.id}: row has no bolded ticket cell`);
        continue;
      }
      const readmeTicket = ticketMatch[1].trim();
      const a = normalise(readmeTicket);
      const b = normalise(flag.ticket);
      if (a !== b) {
        mismatches.push(
          `${flag.id}: README "${readmeTicket}" (→ "${a}") ≠ registry "${flag.ticket}" (→ "${b}")`
        );
      }
    }
    expect(mismatches, `README ticket column drift:\n${mismatches.join('\n')}`).toEqual([]);
  });

  // Completeness guard (pass 77, 2026-04-18) — coherent key shape. Every
  // flag in the registry uses three distinct casings for historical
  // reasons: `ff.snake_case` in localStorage, `ff_camelCase` in the
  // URL, `VITE_SCREAMING_SNAKE` in env. The *word sequence* underneath
  // must be identical — any mismatch means a rename missed a file and
  // the kill-switch cheat sheet in `CHAT_V9_OPERATIONS_RUNBOOK` would
  // lie. Normalise to an array of lowercase words and compare.
  it('every flag uses coherent keys across URL / localStorage / ENV (case-insensitive)', () => {
    const toWords = (raw: string): string[] => {
      // Trim known prefixes in order: `ff.`, `ff_`, `VITE_FF_`, `VITE_`.
      let body = raw;
      for (const prefix of ['ff.', 'ff_', 'VITE_FF_', 'VITE_']) {
        if (body.startsWith(prefix)) {
          body = body.slice(prefix.length);
          break;
        }
      }
      return (
        body
          // Split camelCase boundaries (`bargeInToast` → `barge In Toast`).
          .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
          // Split snake_case / SCREAMING_SNAKE boundaries.
          .split(/[_\s]+/)
          .map((w) => w.toLowerCase())
          .filter((w) => w.length > 0)
      );
    };

    for (const flag of CHAT_V9_FLAGS) {
      const lsWords = toWords(flag.keys.localStorage);
      const qWords = toWords(flag.keys.query);
      const envWords = toWords(flag.keys.env);

      expect(lsWords.length, `localStorage key has no words: ${flag.id}`).toBeGreaterThan(0);
      expect(qWords, `query words drift from localStorage for ${flag.id}`).toEqual(lsWords);
      expect(envWords, `env words drift from localStorage for ${flag.id}`).toEqual(lsWords);
    }
  });

  // Completeness guard — the `block` value is the grouping key the admin
  // panel and dev plans rely on. Keep it pinned to the TS union so a new
  // block is a deliberate two-file change, never an accidental typo.
  // The `KNOWN_BLOCKS` list MUST stay byte-for-byte aligned with the
  // `ChatV9Block` TS union in `chatV9FeatureFlags.ts`. The reverse-
  // closure test below (pass 83) additionally asserts every listed
  // block has ≥1 registered flag — so a future block added here
  // without a flag will break CI loudly.
  const KNOWN_BLOCKS: readonly string[] = ['navigation', 'trust', 'voice', 'input', 'admin'];

  it('every flag declares a block from the closed universe', () => {
    const known = new Set<string>(KNOWN_BLOCKS);
    for (const flag of CHAT_V9_FLAGS) {
      expect(known.has(flag.block), `unknown block for ${flag.id}: ${flag.block}`).toBe(true);
    }
  });

  // Completeness guard (pass 83, 2026-04-18) — reverse closure on
  // `ChatV9Block`. Without this, a block value can linger in the TS
  // union with zero flags using it — a dead enum member that lies to
  // the admin panel grouper, to the dev-plan TOC, and to new engineers
  // reading the source for "which blocks does V9 cover?". This check
  // caught `'control'` and `'context'` in pass 83; either remove the
  // union member or register a flag that uses it.
  it('every block in ChatV9Block has at least one registered flag', () => {
    const usedBlocks = new Set<string>(CHAT_V9_FLAGS.map((f) => f.block));
    const orphanBlocks: string[] = [];
    for (const block of KNOWN_BLOCKS) {
      if (!usedBlocks.has(block)) orphanBlocks.push(block);
    }
    expect(
      orphanBlocks,
      `ChatV9Block union contains orphan values (no flag uses them):\n${orphanBlocks.join('\n')}`
    ).toEqual([]);
  });

  // Completeness guard (pass 84, 2026-04-18) — forward ticket-in-plan
  // coverage. The registry says "flag X has ticket VM4 and lives in
  // block voice". The user-facing promise is that VM4 is designed
  // somewhere — and "somewhere" must be the VOICE development plan,
  // not buried in a private Notion doc. This test maps each block to
  // its canonical plan file and asserts `flag.ticket` appears in the
  // plan's source (normalised for `-lite` / `AG1 v1.N` conventions,
  // same as the README ticket-column test in pass 82). Missing →
  // either add the design section, or reclassify the flag.
  it("every flag ticket appears in its block's development plan", () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const docsDir = path.join(repoRoot, 'docs', 'Chat V9');

    // Block → canonical plan filename. Keep explicit; a typo here is
    // a cheap-to-fix kind of bug compared to the ones this invariant
    // is designed to catch.
    const PLAN_BY_BLOCK: Record<string, string> = {
      voice: 'VOICE_MODE_AUDIO_EXPERIENCE_DEVELOPMENT_PLAN_2026-04-18.md',
      trust: 'TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md',
      navigation: 'NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md',
      input: 'INPUT_CONTROL_DEVELOPMENT_PLAN_2026-04-18.md',
      admin: 'ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md',
    };

    // Same normaliser as the README ticket-column test. Kept inline
    // because extracting to a top-level helper would require touching
    // the production registry file, which is out of scope here.
    const normalise = (raw: string): string =>
      raw
        .replace(/\s+/g, '')
        .replace(/^(AG\d+)v(\d+)\.(\d+)$/i, '$1.$3')
        .replace(/^(AG\d+)v1$/i, '$1')
        .replace(/-lite(?:-plus)*(?:-v\d+)?$/i, '')
        .trim();

    const planCache = new Map<string, string>();
    const loadPlan = (file: string): string => {
      if (planCache.has(file)) return planCache.get(file)!;
      const content = readFileSync(path.join(docsDir, file), 'utf8');
      planCache.set(file, content);
      return content;
    };

    const missing: string[] = [];
    for (const flag of CHAT_V9_FLAGS) {
      const planFile = PLAN_BY_BLOCK[flag.block];
      expect(
        planFile,
        `no plan file mapped for block "${flag.block}" (flag: ${flag.id})`
      ).toBeDefined();
      const plan = loadPlan(planFile);

      // The ticket must appear literally in the plan text at least
      // once. Sub-milestone tickets (e.g. `NAV-M2.1`) are often
      // documented inline under a parent's heading ("ticket
      // `NAV-M2.1`, block …") rather than as a top-level heading —
      // both forms are acceptable. What's NOT acceptable: the ticket
      // doesn't appear anywhere, because then the flag descriptor
      // claims "designed in this plan" without actually being there.
      // The `AG1.N` ↔ `AG1 v1.N` and `X-lite` conventions are legal
      // here too, so normalise both sides.
      const normalisedTicket = normalise(flag.ticket);
      // Extract candidate ticket tokens from the plan (backticked or
      // word-boundary-delimited) and normalise each.
      const candidates = new Set<string>();
      for (const m of plan.matchAll(
        /`([A-Z][A-Za-z0-9.\- ]+?)`|\b([A-Z]+(?:-[A-Z]+)?\d+(?:\.\d+)?(?:[ -]v?\d+(?:\.\d+)?)?(?:-lite(?:-plus)*(?:-v\d+)?)?)\b/g
      )) {
        const raw = m[1] ?? m[2];
        if (raw) candidates.add(normalise(raw));
      }
      if (!candidates.has(normalisedTicket)) {
        missing.push(`${flag.id} (${flag.ticket}) → ${planFile}`);
      }
    }
    expect(
      missing,
      `flag tickets with no mention in the block plan:\n${missing.join('\n')}`
    ).toEqual([]);
  });

  // Completeness guard (pass 84, 2026-04-18) — `testId` reality check.
  // A flag descriptor declares a `testId` as a stable DOM hook that
  // operators and Playwright can latch onto. Nothing previously
  // verified that the string is actually used by any component. A
  // typo, a refactor that removed the hook, or a feature that was
  // flagged but never instrumented would silently ship a lying
  // descriptor. This guard scans non-test source files for the
  // literal string and asserts it appears somewhere outside the
  // registry — whether as `data-testid="X"`, a react-hot-toast
  // `id: 'X'`, an ARIA label, or any other quoted occurrence. The
  // relaxed shape reflects reality: V9 features use `testId` as "a
  // stable DOM identity", not specifically as `data-testid`, and
  // react-hot-toast toasts (e.g. barge-in VM4) surface the string
  // as an `id:` property on the toast descriptor.
  it('every non-null flag.testId appears as a literal in non-test src/ code', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const srcRoot = path.join(repoRoot, 'src');

    // Collect the full text of every non-test source file, keyed by
    // its relative path (so error messages can point at the file
    // that's missing a hook). We exclude `__tests__/` and the
    // registry itself — the registry is where `testId` is declared;
    // finding the string only there is the exact failure we want to
    // surface.
    const sourceByPath = new Map<string, string>();
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
          walk(abs);
        } else if (
          entry.isFile() &&
          /\.(tsx?|jsx?)$/.test(entry.name) &&
          !entry.name.endsWith('.test.ts') &&
          !entry.name.endsWith('.test.tsx') &&
          entry.name !== 'chatV9FeatureFlags.ts'
        ) {
          sourceByPath.set(path.relative(repoRoot, abs), readFileSync(abs, 'utf8'));
        }
      }
    };
    walk(srcRoot);
    expect(sourceByPath.size, 'failed to walk src/ — got zero source files').toBeGreaterThan(10);

    const missing: string[] = [];
    for (const flag of CHAT_V9_FLAGS) {
      if (typeof flag.testId !== 'string' || flag.testId.length === 0) continue;
      // Match quoted variants so we don't false-positive on a
      // comment that mentions the testId in prose. Accept any of
      // `"X"`, `'X'`, `` `X` ``. Also accept `X-suffix` exact strings
      // (prefixed hosts like `workspace-breadcrumb-menu-item`).
      const needle = flag.testId;
      const hit = [...sourceByPath.values()].some((src) => {
        return (
          src.includes(`"${needle}"`) ||
          src.includes(`'${needle}'`) ||
          src.includes(`\`${needle}\``) ||
          // Prefix variants: look for the needle followed by `-` or
          // `__` inside a quoted literal. Cheap substring match — a
          // pedantic regex would not meaningfully reduce false hits
          // in this codebase.
          src.includes(`"${needle}-`) ||
          src.includes(`'${needle}-`) ||
          src.includes(`"${needle}__`) ||
          src.includes(`'${needle}__`)
        );
      });
      if (!hit) missing.push(`${flag.id} → "${flag.testId}" (only declared in registry)`);
    }
    expect(
      missing,
      `flag.testId values with no DOM / source reference:\n${missing.join('\n')}`
    ).toEqual([]);
  });

  // Completeness guard (pass 85, 2026-04-18) — dev-plan cross-refs.
  // Every V9 development plan opens with a canonical block quote
  // pointing at the three cross-cutting docs (Operations Runbook,
  // Contributor Guide, Telemetry Contract). Pass 78 added the blocks;
  // nothing before now stopped a future reformatter from deleting
  // them during an "I cleaned up the docs" PR. If any plan loses the
  // cross-refs, an engineer opening that file during an incident can
  // no longer one-click reach the runbook or telemetry contract.
  //
  // The test enumerates every `*_DEVELOPMENT_PLAN_*.md` file in the
  // Chat V9 folder and asserts the three canonical links all appear
  // in the first 40 lines. That window is generous enough to allow
  // a banner or title above the block but tight enough to catch a
  // block that was moved to the bottom or deleted entirely.
  it('every dev-plan has the canonical Cross-refs block at the top', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const docsDir = path.join(repoRoot, 'docs', 'Chat V9');
    const devPlans = readdirSync(docsDir).filter((f) => /_DEVELOPMENT_PLAN_.*\.md$/.test(f));
    expect(devPlans.length, 'expected ≥1 development plan files').toBeGreaterThan(0);

    const REQUIRED_LINKS = [
      'CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md',
      'CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md',
      'CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md',
    ];

    const broken: string[] = [];
    for (const plan of devPlans) {
      const lines = readFileSync(path.join(docsDir, plan), 'utf8').split('\n');
      const head = lines.slice(0, 40).join('\n');
      if (!head.includes('Cross-refs')) {
        broken.push(`${plan}: missing "Cross-refs" marker in first 40 lines`);
        continue;
      }
      for (const link of REQUIRED_LINKS) {
        if (!head.includes(link)) {
          broken.push(`${plan}: missing link to ${link}`);
        }
      }
    }
    expect(broken, `dev-plan Cross-refs drift:\n${broken.join('\n')}`).toEqual([]);
  });

  // Completeness guard (pass 85, 2026-04-18) — orphan V9 telemetry.
  // The pass-80 invariant is one-way: every event declared by a flag
  // exists in `FunnelEventName`. The opposite direction was not
  // enforced: a V9-scoped event (`voice_*`, `trust_*`, `pii_*`,
  // `navigation_*`, `private_*`) could sit in the union with no flag
  // claiming it. Either the flag forgot to declare it, or the event
  // is dead and should be removed. Either way it's drift — this guard
  // catches it.
  //
  // The `tts_on` event is legitimately part of the voice funnel
  // (VM10) but does not carry a V9 prefix; it is claimed by
  // `voice-funnel-telemetry`, so it already passes invariant 6. We
  // do not add it to the prefix list here.
  it('every V9-prefixed event in FunnelEventName is claimed by a flag', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const funnelSource = readFileSync(
      path.join(repoRoot, 'src', 'services', 'funnelAnalytics.ts'),
      'utf8'
    );
    const FUNNEL_EVENT_RE = /^\s*\|\s*'([a-z0-9_]+)'/gm;
    const unionEvents = new Set<string>();
    for (const m of funnelSource.matchAll(FUNNEL_EVENT_RE)) {
      unionEvents.add(m[1]);
    }
    expect(unionEvents.size, 'failed to parse FunnelEventName union').toBeGreaterThan(50);

    const V9_PREFIXES = ['voice_', 'trust_', 'pii_', 'navigation_', 'private_'];
    const claimed = new Set<string>();
    for (const flag of CHAT_V9_FLAGS) {
      for (const ev of flag.telemetry) claimed.add(ev);
    }

    const orphans: string[] = [];
    for (const ev of unionEvents) {
      if (!V9_PREFIXES.some((p) => ev.startsWith(p))) continue;
      if (!claimed.has(ev)) orphans.push(ev);
    }
    expect(
      orphans,
      `V9-prefixed events in FunnelEventName not claimed by any flag:\n${orphans.join('\n')}`
    ).toEqual([]);
  });

  // Completeness guard (pass 86, 2026-04-18) — reverse telemetry doc
  // sync. The pass-81 invariant is one-way: every event declared by
  // a flag has a heading in the contract doc. This guard enforces the
  // other direction: every event heading in the contract doc must
  // exist in the `FunnelEventName` TS union. Otherwise the contract
  // doc can drift to describe events the code cannot emit — an
  // operator searching the doc for a heading name and then grep'ing
  // the code for the emit site would come up empty.
  it('every telemetry contract heading exists in FunnelEventName', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const funnelSource = readFileSync(
      path.join(repoRoot, 'src', 'services', 'funnelAnalytics.ts'),
      'utf8'
    );
    const FUNNEL_EVENT_RE = /^\s*\|\s*'([a-z0-9_]+)'/gm;
    const unionEvents = new Set<string>();
    for (const m of funnelSource.matchAll(FUNNEL_EVENT_RE)) unionEvents.add(m[1]);

    const contractPath = path.join(
      repoRoot,
      'docs',
      'Chat V9',
      'CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md'
    );
    const contractSource = readFileSync(contractPath, 'utf8');

    // Same heading regex as pass 81 — bare `snake_case_identifier`
    // headings at H2/H3 level. Prose headings like `## Ground rules`
    // are correctly skipped because they contain a space.
    const HEADING_RE = /^#{2,3}\s+`?([a-z][a-z0-9_]*)`?\s*$/gm;
    const docEvents = new Set<string>();
    for (const m of contractSource.matchAll(HEADING_RE)) docEvents.add(m[1]);
    expect(docEvents.size, 'failed to parse any event headings').toBeGreaterThan(5);

    const undocumented: string[] = [];
    for (const ev of docEvents) {
      if (!unionEvents.has(ev)) undocumented.push(ev);
    }
    expect(
      undocumented,
      `telemetry contract has headings for events not in FunnelEventName:\n${undocumented.join('\n')}`
    ).toEqual([]);
  });

  // Completeness guard (pass 86, 2026-04-18) — no orphan dev plans.
  // Every `*_DEVELOPMENT_PLAN_*.md` in `docs/Chat V9/` should be
  // discoverable from the README — typically via the "Docs" column
  // of the "Shipped and tracked" table. An orphan plan that exists
  // on disk but is never linked from the README silently rots;
  // readers cannot find it, CI cannot verify it's cross-linked, and
  // the next refactor assumes it was dead code and deletes it.
  it('every *_DEVELOPMENT_PLAN_*.md is linked from the README', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const docsDir = path.join(repoRoot, 'docs', 'Chat V9');
    const readme = readFileSync(path.join(docsDir, 'README.md'), 'utf8');
    const devPlans = readdirSync(docsDir).filter((f) => /_DEVELOPMENT_PLAN_.*\.md$/.test(f));
    expect(devPlans.length, 'expected ≥1 dev-plan files').toBeGreaterThan(0);

    const orphans = devPlans.filter((plan) => !readme.includes(plan));
    expect(
      orphans,
      `dev-plan files on disk but never linked from README:\n${orphans.join('\n')}`
    ).toEqual([]);
  });

  // Completeness guard (pass 86, 2026-04-18) — telemetry contract
  // Index table consistency. The `## Index` section at the top of
  // the telemetry contract doc is a (event, ticket, flag) triple
  // table that operators skim first. If any of the three columns
  // desync from the registry, the operator reads a lie:
  //
  //   - Event in column 1 but no flag claims it → orphan.
  //   - Flag in column 3 not in registry → renamed but index forgot.
  //   - Ticket in column 2 does not match the flag's registry
  //     ticket → sub-milestone promotion not rippled to the doc.
  //
  // This guard walks the table, resolves each row against the
  // registry, and catches every one of those failure modes.
  it('telemetry contract Index rows match the registry (event/flag/ticket)', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const contractPath = path.join(
      repoRoot,
      'docs',
      'Chat V9',
      'CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md'
    );
    const source = readFileSync(contractPath, 'utf8');
    const SECTION_RE = /## Index\s*\n([\s\S]*?)(?=\n## )/;
    const sectionMatch = SECTION_RE.exec(source);
    expect(sectionMatch, '"## Index" section not found').not.toBeNull();
    const section = sectionMatch![1];

    // Each data row begins with `| \`event_name\``; `|---` separator
    // and header rows have no backticks inside the first cell, so
    // filtering by that regex is enough to skip them.
    const ROW_RE = /^\|\s*`([a-z0-9_]+)`\s*\|\s*([^|]+?)\s*\|\s*`([a-z0-9-]+)`\s*\|/gm;

    // Reuse the same normaliser as the README ticket-column test in
    // pass 82 so `AG1 v1.N` ↔ `AG1.N` and `X-lite` variants count as
    // equivalent. Telemetry contract uses the human-readable form.
    const normalise = (raw: string): string =>
      raw
        .replace(/\s+/g, '')
        .replace(/^(AG\d+)v(\d+)\.(\d+)$/i, '$1.$3')
        .replace(/^(AG\d+)v1$/i, '$1')
        .replace(/-lite(?:-plus)*(?:-v\d+)?$/i, '')
        .trim();

    const flagsByEvent = new Map<string, (typeof CHAT_V9_FLAGS)[number]>();
    for (const flag of CHAT_V9_FLAGS) {
      for (const ev of flag.telemetry) flagsByEvent.set(ev, flag);
    }

    const drift: string[] = [];
    let rowsChecked = 0;
    for (const m of section.matchAll(ROW_RE)) {
      rowsChecked += 1;
      const [, event, ticketCell, flagId] = m;
      const flagByEvent = flagsByEvent.get(event);
      if (!flagByEvent) {
        drift.push(`${event}: no flag claims this event (registry ⇔ index)`);
        continue;
      }
      // Event → flag: the row's `flag id` column must equal the
      // id of the flag that actually claims the event.
      if (flagByEvent.id !== flagId) {
        drift.push(
          `${event}: index says flag "${flagId}" but registry assigns "${flagByEvent.id}"`
        );
      }
      // Event → ticket: the row's ticket cell must normalise to
      // the same ticket as the flag's registry ticket.
      const a = normalise(ticketCell);
      const b = normalise(flagByEvent.ticket);
      if (a !== b) {
        drift.push(
          `${event}: index ticket "${ticketCell.trim()}" (→ "${a}") ≠ registry "${flagByEvent.ticket}" (→ "${b}")`
        );
      }
    }
    expect(
      rowsChecked,
      'failed to parse any rows from telemetry contract Index table'
    ).toBeGreaterThan(5);
    expect(drift, `telemetry contract Index drift:\n${drift.join('\n')}`).toEqual([]);
  });

  // Completeness guard (pass 87, 2026-04-18) — every detailed event
  // section in the telemetry contract has a metadata line of the
  // form `**Ticket:** <T> · **Flag:** \`ff.<key>\` · **Source:** ...`.
  // Pass 86's guard verified the top `## Index` table — this guard
  // verifies the detailed sections that the Index rows link to, so
  // an on-call engineer who scrolls past the Index to the section
  // body still reads accurate metadata.
  //
  // Checks three things per section:
  //   1. The event maps to a registered flag.
  //   2. The ticket, after normalisation, equals the flag's
  //      registry ticket.
  //   3. The flag-key in the metadata line equals the flag's
  //      `keys.localStorage` — operators type this string into
  //      DevTools, so drift is immediately user-visible.
  it('every telemetry contract detailed section matches the registry (ticket + flag key)', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const contractPath = path.join(
      repoRoot,
      'docs',
      'Chat V9',
      'CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md'
    );
    const source = readFileSync(contractPath, 'utf8');

    const AFTER_INDEX_RE = /\n## Index\s*\n[\s\S]*?\n---\s*\n([\s\S]*)$/;
    const afterIndex = AFTER_INDEX_RE.exec(source);
    expect(afterIndex, 'could not locate detailed sections after Index').not.toBeNull();
    const body = afterIndex![1];

    const SECTION_RE =
      /^## `([a-z0-9_]+)`\s*\n+\*\*Ticket:\*\*\s*([^·]+?)\s*·\s*\*\*Flag:\*\*\s*`([^`]+)`/gm;

    const normalise = (raw: string): string =>
      raw
        .replace(/\s+/g, '')
        .replace(/^(AG\d+)v(\d+)\.(\d+)$/i, '$1.$3')
        .replace(/^(AG\d+)v1$/i, '$1')
        .replace(/-lite(?:-plus)*(?:-v\d+)?$/i, '')
        .trim();

    const flagsByEvent = new Map<string, (typeof CHAT_V9_FLAGS)[number]>();
    for (const flag of CHAT_V9_FLAGS) {
      for (const ev of flag.telemetry) flagsByEvent.set(ev, flag);
    }

    const drift: string[] = [];
    let sectionsChecked = 0;
    for (const m of body.matchAll(SECTION_RE)) {
      sectionsChecked += 1;
      const [, event, ticketCell, flagKeyCell] = m;
      const flag = flagsByEvent.get(event);
      if (!flag) {
        drift.push(`${event}: detailed section exists but no flag claims the event`);
        continue;
      }
      const a = normalise(ticketCell);
      const b = normalise(flag.ticket);
      if (a !== b) {
        drift.push(
          `${event}: section ticket "${ticketCell.trim()}" (→ "${a}") ≠ registry "${flag.ticket}" (→ "${b}")`
        );
      }
      if (flagKeyCell !== flag.keys.localStorage) {
        drift.push(
          `${event}: section flag key \`${flagKeyCell}\` ≠ registry \`${flag.keys.localStorage}\``
        );
      }
    }
    expect(sectionsChecked, 'failed to parse any detailed event sections').toBeGreaterThan(5);
    expect(drift, `telemetry contract detailed-section drift:\n${drift.join('\n')}`).toEqual([]);
  });

  // Completeness guard (pass 87, 2026-04-18) — the Index table and
  // the detailed-section headings are in bijection. If the Index
  // lists an event that never gets a detailed section, clicking
  // through the table lands on a broken anchor. If a detailed
  // section exists for an event the Index never mentions, anyone
  // skimming the Index first misses it entirely. Both directions
  // deserve a guard.
  it('telemetry contract Index rows are in bijection with detailed sections', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const contractPath = path.join(
      repoRoot,
      'docs',
      'Chat V9',
      'CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md'
    );
    const source = readFileSync(contractPath, 'utf8');

    const SECTION_RE = /## Index\s*\n([\s\S]*?)(?=\n## )/;
    const sectionMatch = SECTION_RE.exec(source);
    expect(sectionMatch, '"## Index" section not found').not.toBeNull();
    const indexBlock = sectionMatch![1];

    const INDEX_ROW_RE = /^\|\s*`([a-z0-9_]+)`/gm;
    const indexed = new Set<string>();
    for (const m of indexBlock.matchAll(INDEX_ROW_RE)) indexed.add(m[1]);

    const AFTER_INDEX_RE = /\n## Index\s*\n[\s\S]*?\n---\s*\n([\s\S]*)$/;
    const afterIndex = AFTER_INDEX_RE.exec(source);
    expect(afterIndex, 'could not locate detailed sections').not.toBeNull();
    const detailed = new Set<string>();
    // Accept both top-level (`## event`) and grouped (`### event`)
    // sections — e.g. the Voice funnel (VM10) parent groups four
    // events under `### \`voice_start\``, `### \`voice_stt_success\``
    // etc. rather than giving each its own H2.
    for (const m of afterIndex![1].matchAll(/^#{2,3} `([a-z0-9_]+)`/gm)) {
      detailed.add(m[1]);
    }

    const onlyInIndex = [...indexed].filter((e) => !detailed.has(e));
    const onlyInDetailed = [...detailed].filter((e) => !indexed.has(e));
    const msgParts: string[] = [];
    if (onlyInIndex.length) {
      msgParts.push(
        `events listed in Index but missing a detailed section:\n  ${onlyInIndex.join('\n  ')}`
      );
    }
    if (onlyInDetailed.length) {
      msgParts.push(
        `events with a detailed section but missing from the Index:\n  ${onlyInDetailed.join('\n  ')}`
      );
    }
    expect(msgParts, msgParts.join('\n\n')).toEqual([]);
    expect(indexed.size, 'expected ≥5 indexed events').toBeGreaterThan(5);
  });

  // Completeness guard (pass 88, 2026-04-18) — every ticket-like
  // token in the operations runbook resolves to a registered flag's
  // ticket. Invariant # 14 covered the backticked kebab-case flag
  // ids in § 4. This guard covers the other reference surface:
  // ticket codes like `AG1 v1.10`, `T-TR3.4`, `VM4`, `NAV-M3.5`,
  // `T-PM2-lite`, `C-IN4-lite`, which appear throughout the runbook
  // (§ 3 keyboard shortcuts, § 4 failure modes, § 5 rollback steps,
  // § 6 recovery notes). If a ticket gets renamed and the runbook
  // is not rippled, on-call engineers search the registry for a
  // ticket that no longer exists.
  it('every ticket reference in the operations runbook resolves to the registry', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const runbookPath = path.join(
      repoRoot,
      'docs',
      'Chat V9',
      'CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md'
    );
    const source = readFileSync(runbookPath, 'utf8');

    // Strip fenced code blocks — they contain literal `?ff_<feature>=0`
    // style placeholders (with the angle brackets turning into
    // interesting substrings) that would otherwise false-positive.
    const noCode = source.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');

    // Ticket shape, mirroring the pass-79 registry guard. Anchored
    // with look-arounds that exclude hyphens and alphanumerics on
    // either side, so `pre-AG1-v1.13` in prose does NOT double-
    // match as both `AG1-v1.13` and a bare `AG1` prefix.
    const TICKET_RE =
      /(?<![A-Za-z0-9-])(AG\d+(?:\s*v\d+)?\.\d+|NAV-M\d+(?:\.\d+)?|VM\d+(?:\.\d+)?|T-TR\d+(?:\.\d+)?|T-PM\d+(?:\.\d+)?(?:-lite)?|C-IN\d+(?:\.\d+)?(?:-lite)?)(?![A-Za-z0-9-])/g;

    // Same normaliser the README and telemetry contract tests use.
    const normalise = (raw: string): string =>
      raw
        .replace(/\s+/g, '')
        .replace(/^(AG\d+)v(\d+)\.(\d+)$/i, '$1.$3')
        .replace(/^(AG\d+)v1$/i, '$1')
        .replace(/-lite(?:-plus)*(?:-v\d+)?$/i, '')
        .trim();

    const registryTickets = new Set(CHAT_V9_FLAGS.map((f) => normalise(f.ticket)));

    // Some tickets are shipped without a flag (e.g. AG1 v1.1 is
    // role-gated, not flag-gated). Fall back to any `### AG1 v1.1 ·`
    // heading found in any of the block development plans — if the
    // runbook cites a ticket that has a design section, that still
    // counts as resolved.
    const docsDir = path.join(repoRoot, 'docs', 'Chat V9');
    const planFiles = readdirSync(docsDir).filter((f) => /_DEVELOPMENT_PLAN_.*\.md$/.test(f));
    const planTickets = new Set<string>();
    for (const plan of planFiles) {
      const body = readFileSync(path.join(docsDir, plan), 'utf8');
      for (const m of body.matchAll(TICKET_RE)) {
        planTickets.add(normalise(m[1]));
      }
    }

    const resolvable = new Set([...registryTickets, ...planTickets]);

    const seen = new Set<string>();
    const unresolved = new Map<string, string>();
    let refsChecked = 0;
    for (const m of noCode.matchAll(TICKET_RE)) {
      const raw = m[1];
      refsChecked += 1;
      if (seen.has(raw)) continue;
      seen.add(raw);
      const n = normalise(raw);
      if (!resolvable.has(n)) unresolved.set(raw, n);
    }
    expect(refsChecked, 'expected ≥5 ticket references in the runbook').toBeGreaterThan(5);
    expect(
      [...unresolved.entries()].map(([raw, n]) => `${raw} (→ ${n})`),
      `runbook ticket references not in registry:\n${[...unresolved.entries()]
        .map(([raw, n]) => `${raw} (→ ${n})`)
        .join('\n')}`
    ).toEqual([]);
  });

  // Completeness guard (pass 88, 2026-04-18) — every dev-plan's
  // "Cross-refs" block (checked for presence by invariant # 20)
  // uses *relative* links to the runbook / contributor guide /
  // telemetry contract. Absolute URLs would bypass doc previews on
  // forks and make the dev plan harder to open from a cloned repo.
  // This guard enforces the `./` prefix and that the linked file
  // exists on disk.
  it('every dev-plan Cross-refs block uses relative links to real files', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const docsDir = path.join(repoRoot, 'docs', 'Chat V9');
    const devPlans = readdirSync(docsDir).filter((f) => /_DEVELOPMENT_PLAN_.*\.md$/.test(f));
    expect(devPlans.length, 'expected ≥1 dev-plan files').toBeGreaterThan(0);

    const REL_LINK_RE = /\]\((\.\/[A-Z0-9_-]+\.md)\)/g;
    const REQUIRED = new Set([
      './CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md',
      './CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md',
      './CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md',
    ]);

    const drift: string[] = [];
    for (const plan of devPlans) {
      const full = readFileSync(path.join(docsDir, plan), 'utf8');
      // Only look at the first 40 lines — same window as # 20.
      const head = full.split('\n').slice(0, 40).join('\n');
      const links = new Set<string>();
      for (const m of head.matchAll(REL_LINK_RE)) links.add(m[1]);
      for (const required of REQUIRED) {
        if (!links.has(required)) {
          drift.push(`${plan}: Cross-refs missing relative link ${required}`);
          continue;
        }
        const target = path.join(docsDir, required.replace(/^\.\//, ''));
        if (!existsSync(target)) {
          drift.push(`${plan}: Cross-refs link ${required} does not exist on disk`);
        }
      }
    }
    expect(drift, `dev-plan Cross-refs drift:\n${drift.join('\n')}`).toEqual([]);
  });

  // Completeness guard (pass 89, 2026-04-18) — every file path or
  // bare filename cited in backticks in the contributor guide
  // resolves to a real file. The guide is prescriptive: a new
  // engineer follows its steps literally ("copy an existing
  // resolver, e.g. `src/utils/bargeInToastFlag.ts`"). A stale
  // path sends them to nothing and breaks the onboarding flow.
  //
  // Placeholders (containing `<`, `**`, `{`, `}`) are skipped.
  // Full paths starting with `src/` or `docs/` must exist at that
  // exact path. Bare filenames ending in `.ts` / `.tsx` must exist
  // somewhere under `src/`. Bare filenames ending in `.md` must
  // exist somewhere under `docs/`.
  it('every file-path backtick in the contributor guide resolves', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const guidePath = path.join(
      repoRoot,
      'docs',
      'Chat V9',
      'CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md'
    );
    const source = readFileSync(guidePath, 'utf8');

    // Walk every backticked token and filter to those that look
    // like paths (contain `/` or end in `.ts` / `.tsx` / `.md` /
    // `.json`). Then drop placeholders.
    const BACKTICK_RE = /`([^`\n]+)`/g;
    const PATHY = /^[A-Za-z0-9_./<>{}*-]+\.(ts|tsx|md|json)$/;
    // Suffix-convention examples that are not real paths — the
    // guide uses them in the "Mandatory naming convention" table
    // to describe filename shape, e.g. `Flag.ts` is the required
    // suffix for every resolver file.
    const SUFFIX_EXAMPLES = new Set<string>(['Flag.ts']);
    const IS_PLACEHOLDER = (s: string) =>
      s.includes('<') || s.includes('**') || s.includes('{') || s.includes('}');

    const walkSrc = (dir: string): Set<string> => {
      const out = new Set<string>();
      const stack: string[] = [dir];
      while (stack.length) {
        const d = stack.pop()!;
        if (!existsSync(d)) continue;
        for (const entry of readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, entry.name);
          if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'dist') continue;
            stack.push(full);
          } else {
            out.add(entry.name);
          }
        }
      }
      return out;
    };
    const srcBaseNames = walkSrc(path.join(repoRoot, 'src'));
    const docsBaseNames = walkSrc(path.join(repoRoot, 'docs'));

    const seen = new Set<string>();
    const broken: string[] = [];
    let checked = 0;
    for (const m of source.matchAll(BACKTICK_RE)) {
      const token = m[1].trim();
      if (!PATHY.test(token)) continue;
      if (IS_PLACEHOLDER(token)) continue;
      if (SUFFIX_EXAMPLES.has(token)) continue;
      if (seen.has(token)) continue;
      seen.add(token);
      checked += 1;

      if (token.startsWith('src/') || token.startsWith('docs/')) {
        const abs = path.join(repoRoot, token);
        if (!existsSync(abs)) {
          broken.push(`${token}: path does not exist`);
        }
        continue;
      }
      // Bare filename — must be findable somewhere beneath src/
      // or docs/ depending on extension.
      const pool = token.endsWith('.md') ? docsBaseNames : srcBaseNames;
      if (!pool.has(token)) {
        broken.push(
          `${token}: filename not found under ${token.endsWith('.md') ? 'docs/' : 'src/'}`
        );
      }
    }

    expect(checked, 'expected ≥5 file-path references in contributor guide').toBeGreaterThan(5);
    expect(
      broken,
      `contributor guide path references that do not resolve:\n${broken.join('\n')}`
    ).toEqual([]);
  });

  // Completeness guard (pass 89, 2026-04-18) — every `.md` file in
  // `docs/Chat V9/` belongs to one of five known taxonomies:
  //   - README.md
  //   - *_DEVELOPMENT_PLAN_*.md (one per block)
  //   - CHAT_V9_OPERATIONS_RUNBOOK_*.md
  //   - CHAT_V9_CONTRIBUTOR_GUIDE_*.md
  //   - CHAT_V9_TELEMETRY_CONTRACT_*.md
  //
  // Any file outside this taxonomy is an orphan — either a
  // work-in-progress left behind, or a new doc type nobody taught
  // CI how to validate. Either way, CI should notice and prompt
  // the author to either classify it or delete it.
  it('every docs/Chat V9/*.md file matches a known taxonomy', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const docsDir = path.join(repoRoot, 'docs', 'Chat V9');
    const entries = readdirSync(docsDir).filter((f) => f.endsWith('.md'));
    expect(entries.length, 'expected ≥5 docs').toBeGreaterThan(5);

    const KNOWN = [
      /^README\.md$/,
      /^.*_DEVELOPMENT_PLAN_\d{4}-\d{2}-\d{2}\.md$/,
      /^CHAT_V9_OPERATIONS_RUNBOOK_\d{4}-\d{2}-\d{2}\.md$/,
      /^CHAT_V9_CONTRIBUTOR_GUIDE_\d{4}-\d{2}-\d{2}\.md$/,
      /^CHAT_V9_TELEMETRY_CONTRACT_\d{4}-\d{2}-\d{2}\.md$/,
    ];

    const orphans = entries.filter((f) => !KNOWN.some((rx) => rx.test(f)));
    expect(
      orphans,
      `docs/Chat V9/ files that do not match any known taxonomy:\n${orphans.join('\n')}\n\nExpected taxonomies: README.md, *_DEVELOPMENT_PLAN_YYYY-MM-DD.md, CHAT_V9_OPERATIONS_RUNBOOK_YYYY-MM-DD.md, CHAT_V9_CONTRIBUTOR_GUIDE_YYYY-MM-DD.md, CHAT_V9_TELEMETRY_CONTRACT_YYYY-MM-DD.md`
    ).toEqual([]);
  });

  // Completeness guard — the `id` field is the only token the runbook,
  // the admin panel URL shortcuts, and the specDoc `#anchor` fragments
  // share. Kebab-case only, no accidental uppercase or trailing dashes.
  it('every flag id is kebab-case', () => {
    const KEBAB_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    for (const flag of CHAT_V9_FLAGS) {
      expect(flag.id, `id for ${flag.id}`).toMatch(KEBAB_RE);
    }
  });

  // Guards against specDoc drift: when a doc is deleted or renamed but the
  // registry still advertises it, the owner runbook / AG1 dashboard would
  // send ops to a 404. This test repo-roots every specDoc path (stripping
  // any `#anchor` fragment) and asserts the file exists on disk. Skipped
  // when the repo root cannot be resolved (e.g. published as an npm tarball).
  it('every specDoc path resolves to a file on disk', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    if (!existsSync(path.join(repoRoot, 'package.json'))) {
      // Unexpected layout — fail loudly rather than silently pass.
      throw new Error(`repoRoot lookup failed: ${repoRoot} has no package.json`);
    }
    for (const flag of CHAT_V9_FLAGS) {
      for (const doc of flag.specDocs) {
        const bare = doc.split('#')[0];
        const abs = path.join(repoRoot, bare);
        expect(existsSync(abs), `missing spec doc for ${flag.id}: ${doc}`).toBe(true);
      }
    }
  });

  // Completeness guard (pass 83, 2026-04-18) — specDoc anchor resolution.
  // The pass-79 intra-doc anchor test covers markdown-link anchors INSIDE
  // the docs folder; the pass-above test checks that `specDocs` FILE
  // paths exist. Neither catches a broken anchor in a `specDocs` entry
  // — and the Admin panel's "Docs" pill opens these paths verbatim, so
  // a stale `#VM4` (when the real anchor is `#vm4`) sends operators to
  // the top of a 400-line document. Walk every `specDocs` entry that
  // contains `#`, resolve it against the actual headings and explicit
  // `<a id>` anchors, and fail on any mismatch.
  it('every specDoc anchor resolves inside the target file', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const slugify = (heading: string): string =>
      heading
        .toLowerCase()
        .replace(/`/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
    const ANCHOR_RE = /<a\s+(?:id|name)=["']([^"']+)["']\s*(?:\/|>\s*<\/a)?>/gi;

    const slugsByFile = new Map<string, Set<string>>();
    const getSlugs = (absPath: string): Set<string> => {
      const cached = slugsByFile.get(absPath);
      if (cached) return cached;
      const slugs = new Set<string>();
      if (existsSync(absPath)) {
        const content = readFileSync(absPath, 'utf8');
        for (const line of content.split('\n')) {
          const m = /^#{1,6}\s+(.+?)\s*$/.exec(line);
          if (m) slugs.add(slugify(m[1]));
        }
        for (const match of content.matchAll(ANCHOR_RE)) slugs.add(match[1]);
      }
      slugsByFile.set(absPath, slugs);
      return slugs;
    };

    const broken: string[] = [];
    for (const flag of CHAT_V9_FLAGS) {
      for (const doc of flag.specDocs) {
        const hashIdx = doc.indexOf('#');
        if (hashIdx === -1) continue;
        const bare = doc.slice(0, hashIdx);
        const anchor = doc.slice(hashIdx + 1);
        const abs = path.join(repoRoot, bare);
        if (!existsSync(abs)) {
          // The file-existence test above already reports this.
          continue;
        }
        const slugs = getSlugs(abs);
        if (!slugs.has(anchor)) {
          broken.push(`${flag.id}: ${doc}`);
        }
      }
    }
    expect(
      broken,
      `broken specDoc anchors (file exists, anchor does not):\n${broken.join('\n')}`
    ).toEqual([]);
  });

  // Completeness guard (pass 79, 2026-04-18) — intra-doc anchor integrity.
  //
  // Every markdown file in `docs/Chat V9/` cross-links the others. If an
  // anchor is renamed or removed but the links are not updated, readers
  // land on the top of a 400-line doc during an incident and lose time.
  //
  // This test reads every `./<file>.md#anchor` reference inside the
  // Chat V9 docs folder and verifies the target anchor exists in the
  // target file, computed by the standard GitHub-flavoured-Markdown
  // slug algorithm (lowercase, spaces → hyphens, strip everything
  // that is not alphanumeric, hyphen, or underscore).
  //
  // External and absolute links are ignored — this test is scoped to
  // intra-folder relative links only.
  it('every intra-doc anchor in docs/Chat V9 resolves to a real heading', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const docsDir = path.join(repoRoot, 'docs', 'Chat V9');
    if (!existsSync(docsDir)) {
      throw new Error(`docs lookup failed: ${docsDir} does not exist`);
    }

    // Inlined minimal GFM slugifier — kept self-contained so the test
    // does not introduce a new dep.
    const slugify = (heading: string): string =>
      heading
        .toLowerCase()
        .replace(/`/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');

    // Collect { file → Set<slug> } for every doc in the folder.
    // We accept both GFM heading slugs and explicit HTML anchors
    // (`<a id="foo"></a>` / `<a name="foo"></a>`). Explicit anchors
    // let a doc expose a stable short-form anchor — e.g. `ag1-v13`
    // — without having to keep the section heading itself short.

    const { readdirSync } = require('node:fs') as typeof import('node:fs');
    const docFiles = readdirSync(docsDir).filter((f: string) => f.endsWith('.md'));
    const slugsByFile = new Map<string, Set<string>>();
    const ANCHOR_RE = /<a\s+(?:id|name)=["']([^"']+)["']\s*(?:\/|>\s*<\/a)?>/gi;
    for (const f of docFiles) {
      const content = readFileSync(path.join(docsDir, f), 'utf8');
      const slugs = new Set<string>();
      for (const line of content.split('\n')) {
        const m = /^#{1,6}\s+(.+?)\s*$/.exec(line);
        if (m) slugs.add(slugify(m[1]));
      }
      for (const match of content.matchAll(ANCHOR_RE)) slugs.add(match[1]);
      slugsByFile.set(f, slugs);
    }

    // Scan every doc for `./<file>.md#anchor` references and resolve them.
    const broken: string[] = [];
    const LINK_RE = /\]\(\.\/([A-Za-z0-9._-]+\.md)#([A-Za-z0-9_-]+)\)/g;
    for (const f of docFiles) {
      const content = readFileSync(path.join(docsDir, f), 'utf8');
      for (const match of content.matchAll(LINK_RE)) {
        const [, target, anchor] = match;
        const targetSlugs = slugsByFile.get(target);
        if (!targetSlugs) {
          broken.push(`${f}: target file missing → ./${target}#${anchor}`);
          continue;
        }
        if (!targetSlugs.has(anchor)) {
          broken.push(`${f}: anchor not found → ./${target}#${anchor}`);
        }
      }
    }
    expect(broken, `broken intra-doc anchors:\n${broken.join('\n')}`).toEqual([]);
  });

  // Completeness guard (pass 78, 2026-04-18) — README cheat-sheet sync.
  //
  // The Chat V9 README in `docs/Chat V9/README.md` is the operator-facing
  // contract: an on-call engineer runs `grep ff_<flag>` against this one
  // file and expects to find the URL kill-switch, the localStorage
  // override, and the feature's row in the status table.
  //
  // If someone adds a flag to the registry but forgets to update the
  // README, the kill-switch cheat sheet goes out of sync silently and
  // ops learn about it during the next incident. Pin the three tables
  // so the registry and the README can never drift.
  //
  // Scoped to tokens that are unambiguous in Markdown:
  //   - status table        → backticked flag id    (`` `my-flag` ``)
  //   - URL kill-switches   → `?ff_camelCase=0`     (literal substring)
  //   - localStorage cheat  → `ff.snake_case`       (literal substring)
  it('every registered flag appears in every README cheat sheet', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const readmePath = path.join(repoRoot, 'docs', 'Chat V9', 'README.md');
    if (!existsSync(readmePath)) {
      throw new Error(`README lookup failed: ${readmePath} does not exist`);
    }
    const readme = readFileSync(readmePath, 'utf8');

    const missing: string[] = [];
    for (const flag of CHAT_V9_FLAGS) {
      // Status table: the id is always wrapped in single backticks in
      // the shipped table. Escape backticks just in case a future id
      // contains one.
      const idToken = `\`${flag.id}\``;
      if (!readme.includes(idToken)) {
        missing.push(`status-table: \`${flag.id}\``);
      }
      // URL kill-switch cheat sheet.
      const urlToken = `?${flag.keys.query}=0`;
      if (!readme.includes(urlToken)) {
        missing.push(`url-cheat-sheet: ${urlToken}`);
      }
      // localStorage cheat sheet.
      const lsToken = flag.keys.localStorage;
      if (!readme.includes(lsToken)) {
        missing.push(`ls-cheat-sheet: ${lsToken}`);
      }
    }
    expect(missing, `README drift — missing entries:\n${missing.join('\n')}`).toEqual([]);
  });
});

describe('getChatV9FlagSnapshot()', () => {
  beforeEach(() => {
    try {
      window.localStorage.clear();
    } catch {
      // ignore — some JSDOM versions reject before the test env starts.
    }
  });

  afterEach(() => {
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  });

  it('returns one entry per registered flag with matchesDefault=true at rest', () => {
    const snapshot = getChatV9FlagSnapshot();
    expect(snapshot).toHaveLength(CHAT_V9_FLAGS.length);
    for (const entry of snapshot) {
      expect(entry.matchesDefault).toBe(true);
      expect(entry.enabled).toBe(entry.default);
    }
    expect(getChatV9FlagOverrides()).toEqual([]);
  });

  it('flags a localStorage override away from default as matchesDefault=false', () => {
    // All defaults are ON; flipping any one to '0' is the rollback path the
    // owner runbook documents.
    window.localStorage.setItem('ff.barge_in_toast', '0');

    const overrides = getChatV9FlagOverrides();
    expect(overrides).toHaveLength(1);
    expect(overrides[0].id).toBe('barge-in-toast');
    expect(overrides[0].enabled).toBe(false);
    expect(overrides[0].matchesDefault).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AG1 v1 — write-side helpers powering the AI Control Hub page.
// ---------------------------------------------------------------------------
describe('AG1 write-side: setChatV9FlagOverride / clearChatV9FlagOverride', () => {
  beforeEach(() => {
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  });

  it('writes `1` for `on` and `0` for `off` in localStorage', () => {
    expect(setChatV9FlagOverride('barge-in-toast', 'on')).toBe(true);
    expect(window.localStorage.getItem('ff.barge_in_toast')).toBe('1');

    expect(setChatV9FlagOverride('barge-in-toast', 'off')).toBe(true);
    expect(window.localStorage.getItem('ff.barge_in_toast')).toBe('0');
  });

  it('removes the key entirely when override is set to null', () => {
    window.localStorage.setItem('ff.barge_in_toast', '0');
    expect(setChatV9FlagOverride('barge-in-toast', null)).toBe(true);
    expect(window.localStorage.getItem('ff.barge_in_toast')).toBeNull();
  });

  it('clearChatV9FlagOverride is a semantic alias for setting override to null', () => {
    window.localStorage.setItem('ff.barge_in_toast', '0');
    clearChatV9FlagOverride('barge-in-toast');
    expect(window.localStorage.getItem('ff.barge_in_toast')).toBeNull();
  });

  it('returns false for unknown flag ids (defensive — the hub would never pass these)', () => {
    expect(setChatV9FlagOverride('not-a-real-flag', 'on')).toBe(false);
  });

  it('getChatV9FlagOverrideState reflects on/off/null without touching env/default', () => {
    expect(getChatV9FlagOverrideState('barge-in-toast')).toBeNull();
    setChatV9FlagOverride('barge-in-toast', 'off');
    expect(getChatV9FlagOverrideState('barge-in-toast')).toBe('off');
    setChatV9FlagOverride('barge-in-toast', 'on');
    expect(getChatV9FlagOverrideState('barge-in-toast')).toBe('on');
    clearChatV9FlagOverride('barge-in-toast');
    expect(getChatV9FlagOverrideState('barge-in-toast')).toBeNull();
  });
});

describe('AG1 write-side: resetAllChatV9FlagOverrides', () => {
  beforeEach(() => {
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  });

  it('clears every overridden key and leaves snapshot back on defaults', () => {
    for (const flag of CHAT_V9_FLAGS) {
      setChatV9FlagOverride(flag.id, 'off');
    }
    expect(getChatV9FlagOverrides()).toHaveLength(CHAT_V9_FLAGS.length);

    const cleared = resetAllChatV9FlagOverrides();
    expect(cleared).toBe(CHAT_V9_FLAGS.length);
    expect(getChatV9FlagOverrides()).toEqual([]);
  });

  it('is idempotent — a second call still reports successful clears without throwing', () => {
    setChatV9FlagOverride('barge-in-toast', 'off');
    resetAllChatV9FlagOverrides();
    const second = resetAllChatV9FlagOverrides();
    expect(second).toBe(CHAT_V9_FLAGS.length);
    expect(getChatV9FlagOverrides()).toEqual([]);
  });
});
