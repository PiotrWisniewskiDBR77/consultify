/**
 * AP-03 — CommandPaletteIndex: the same `KeyboardCommandRegistry` commands,
 * re-shaped into a searchable structure for a future command-palette UI
 * (task scope item "b": "przeszukiwalne po nazwie/opisie, fuzzy-search-ready
 * struktura, nie sama implementacja fuzzy search").
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 10 ("command palette").
 *
 * SCOPE, per the task's own wording: this file precomputes the TOKENS a real
 * fuzzy matcher (Fuse.js, `cmdk`'s built-in scorer, or similar) would index —
 * id parts, label words, description words, category — and ships a plain
 * case-insensitive substring `search()` as a functional placeholder so the
 * index is usable today without a fuzzy-search dependency. It does NOT
 * implement fuzzy scoring (Levenshtein/trigram/whatever) — that is
 * explicitly deferred to the future UI step per the task brief, same as the
 * rest of this package's UI-out-of-scope discipline.
 */

import type { CommandContext, KeyboardCommand, Platform } from './commandTypes.js';
import { describeCombo } from './commandTypes.js';

export interface CommandPaletteEntry {
  command: KeyboardCommand;
  /**
   * Precomputed, lowercased, deduplicated search tokens: every word of
   * `id`/`label`/`description`/`category`, split on non-alphanumeric
   * boundaries (`'grid.clearDelete'` -> `['grid', 'cleardelete']` plus the
   * dotted id itself kept whole for exact-id lookup). This is the shape a
   * fuzzy matcher indexes directly — recomputing tokens per keystroke is
   * exactly the cost precomputing avoids at command-palette scale (a few
   * dozen commands today, but the shape holds if AP-07 saved views or AP-08
   * exception actions register their own commands into the same palette
   * later).
   */
  searchTokens: readonly string[];
  /** Precomputed shortcut-hint label for both platforms, so the palette row doesn't recompute `describeCombo` per render per platform toggle. */
  comboLabel: { mac: string; windows: string };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

function buildEntry(command: KeyboardCommand): CommandPaletteEntry {
  const tokenSource = [command.id, command.label, command.description, command.category].join(' ');
  const tokens = new Set<string>(tokenize(tokenSource));
  tokens.add(command.id.toLowerCase());
  return {
    command,
    searchTokens: [...tokens],
    comboLabel: {
      mac: describeCombo(command.combo, 'mac'),
      windows: describeCombo(command.combo, 'windows'),
    },
  };
}

export class CommandPaletteIndex {
  private readonly entries: readonly CommandPaletteEntry[];

  constructor(commands: readonly KeyboardCommand[]) {
    this.entries = commands.map(buildEntry);
  }

  get all(): readonly CommandPaletteEntry[] {
    return this.entries;
  }

  byId(id: string): CommandPaletteEntry | undefined {
    return this.entries.find((e) => e.command.id === id);
  }

  byContext(context: CommandContext): readonly CommandPaletteEntry[] {
    return this.entries.filter((e) => e.command.context === context || e.command.context === 'global');
  }

  /**
   * Case-insensitive substring match over `searchTokens` — NOT fuzzy search
   * (see file header). Empty/whitespace-only `query` returns every entry
   * (the palette's initial, unfiltered "browse all commands" list — Excel/
   * Sheets/VS Code all show the full command list before the user types
   * anything, rather than an empty result).
   */
  search(query: string): readonly CommandPaletteEntry[] {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return this.entries;
    return this.entries.filter((e) => e.searchTokens.some((t) => t.includes(q)));
  }

  /** `search()` narrowed to one context — the shape a palette actually renders (user is typing while the grid is in a specific mode, only commands reachable from there are useful suggestions). */
  searchInContext(query: string, context: CommandContext): readonly CommandPaletteEntry[] {
    const q = query.trim().toLowerCase();
    return this.byContext(context).filter((e) => q.length === 0 || e.searchTokens.some((t) => t.includes(q)));
  }

  /** Convenience for a palette row's shortcut-hint column. */
  static comboLabelFor(entry: CommandPaletteEntry, platform: Platform): string {
    return platform === 'mac' ? entry.comboLabel.mac : entry.comboLabel.windows;
  }
}
