/**
 * slashCommands — static registry for the composer's `/`-command palette.
 *
 * Each command either (a) patches the shared aiConfig (reusing the same store
 * mechanism ToolsMenu/CoThinkerMenu already use), (b) inserts a prompt template
 * into the composer, or (c) runs a local/parent action. Mirrors the AI_MODES /
 * PERSONAS array style used elsewhere in the chat module.
 */

import {
  Eraser,
  Globe,
  Image as ImageIcon,
  LineChart,
  type LucideIcon,
  PenSquare,
  Search,
  Sparkles,
  Table as TableIcon,
} from 'lucide-react';

import { fuzzyIncludes } from './composerMentions';

export type SlashApply =
  | { kind: 'config'; patch: Record<string, unknown> }
  | { kind: 'template'; textKey: string; textFallback: string }
  | { kind: 'action'; action: 'newChat' | 'clear' };

export interface SlashCommand {
  id: string;
  /** Trigger token without the leading slash, e.g. "research". */
  command: string;
  labelKey: string;
  labelFallback: string;
  descriptionKey: string;
  descriptionFallback: string;
  icon: LucideIcon;
  apply: SlashApply;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'research',
    command: 'research',
    labelKey: 'aiChat.composer.commands.research.label',
    labelFallback: 'Deep research',
    descriptionKey: 'aiChat.composer.commands.research.desc',
    descriptionFallback: 'Turn on multi-step deep research for the next message',
    icon: Sparkles,
    apply: { kind: 'config', patch: { deepResearch: true } },
  },
  {
    id: 'search',
    command: 'search',
    labelKey: 'aiChat.composer.commands.search.label',
    labelFallback: 'Web search',
    descriptionKey: 'aiChat.composer.commands.search.desc',
    descriptionFallback: 'Ground the next answer in real-time web results',
    icon: Globe,
    apply: { kind: 'config', patch: { webSearch: true } },
  },
  {
    id: 'market',
    command: 'market',
    labelKey: 'aiChat.composer.commands.market.label',
    labelFallback: 'Market research',
    descriptionKey: 'aiChat.composer.commands.market.desc',
    descriptionFallback: 'Market analysis mode with live web data',
    icon: LineChart,
    apply: { kind: 'config', patch: { marketResearch: true, webSearch: true } },
  },
  {
    id: 'reasoning',
    command: 'reasoning',
    labelKey: 'aiChat.composer.commands.reasoning.label',
    labelFallback: 'Show reasoning',
    descriptionKey: 'aiChat.composer.commands.reasoning.desc',
    descriptionFallback: "Reveal the model's thinking for the next answer",
    icon: PenSquare,
    apply: { kind: 'config', patch: { showReasoning: true, maxMode: true } },
  },
  {
    id: 'summarize',
    command: 'summarize',
    labelKey: 'aiChat.composer.commands.summarize.label',
    labelFallback: 'Summarize',
    descriptionKey: 'aiChat.composer.commands.summarize.desc',
    descriptionFallback: 'Insert a prompt to summarize the conversation so far',
    icon: Sparkles,
    apply: {
      kind: 'template',
      textKey: 'aiChat.composer.commands.summarize.template',
      textFallback:
        'Summarize the conversation so far into concise bullet points covering the key topics, decisions, and action items.',
    },
  },
  {
    id: 'table',
    command: 'table',
    labelKey: 'aiChat.composer.commands.table.label',
    labelFallback: 'Make a table',
    descriptionKey: 'aiChat.composer.commands.table.desc',
    descriptionFallback: 'Insert a prompt to present information as a table',
    icon: TableIcon,
    apply: {
      kind: 'template',
      textKey: 'aiChat.composer.commands.table.template',
      textFallback: 'Present the following as a clear, well-structured table: ',
    },
  },
  {
    id: 'image',
    command: 'image',
    labelKey: 'aiChat.composer.commands.image.label',
    labelFallback: 'Generate image',
    descriptionKey: 'aiChat.composer.commands.image.desc',
    descriptionFallback: 'Insert an image-generation prompt',
    icon: ImageIcon,
    apply: {
      kind: 'template',
      textKey: 'aiChat.composer.commands.image.template',
      textFallback: 'Generate an image of: ',
    },
  },
  {
    id: 'clear',
    command: 'clear',
    labelKey: 'aiChat.composer.commands.clear.label',
    labelFallback: 'Clear input',
    descriptionKey: 'aiChat.composer.commands.clear.desc',
    descriptionFallback: 'Clear the composer text and attachments',
    icon: Eraser,
    apply: { kind: 'action', action: 'clear' },
  },
  {
    id: 'new',
    command: 'new',
    labelKey: 'aiChat.composer.commands.new.label',
    labelFallback: 'New chat',
    descriptionKey: 'aiChat.composer.commands.new.desc',
    descriptionFallback: 'Start a fresh conversation',
    icon: PenSquare,
    apply: { kind: 'action', action: 'newChat' },
  },
];

/** Filter commands by the typed query (matches command token or label). */
export function filterSlashCommands(query: string): SlashCommand[] {
  if (!query) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (c) => fuzzyIncludes(c.command, query) || fuzzyIncludes(c.labelFallback, query)
  );
}
