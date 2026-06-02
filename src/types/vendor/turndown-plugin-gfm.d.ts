/**
 * Ambient declaration for `turndown-plugin-gfm` (ships no types).
 * Used by the Canvas editor markdown round-trip (canvasMarkdownConversion.ts).
 */
declare module 'turndown-plugin-gfm' {
  import type TurndownService from 'turndown';

  type TurndownPlugin = (service: TurndownService) => void;

  export const gfm: TurndownPlugin;
  export const tables: TurndownPlugin;
  export const strikethrough: TurndownPlugin;
  export const taskListItems: TurndownPlugin;
  export const highlightedCodeBlock: TurndownPlugin;
}
