export type RetiredChatWriteCommand = {
  targetKind: 'task' | 'decision';
  title: string;
  notice: string;
};

/**
 * Wave 3 canonical boundary: Chat may propose work, but it must not create a
 * Task or Decision through the retired `/api/my-work/chat-actions` shortcut.
 * Until Chat has a source-bound, independently approved materialization
 * contract for these target kinds, the command is fail-closed and points the
 * user to the governed My Work / Agent surface.
 */
export function retiredChatWriteCommand(input: string): RetiredChatWriteCommand | null {
  const text = input.trim();
  const match = text.match(/^\/(task|decision)\s+(.+)$/i);
  if (!match) return null;

  const targetKind = match[1].toLowerCase() as RetiredChatWriteCommand['targetKind'];
  const title = match[2].trim();
  if (!title) return null;

  const label = targetKind === 'task' ? 'task' : 'decision';
  return {
    targetKind,
    title,
    notice:
      `Direct /${label} writes are disabled. No ${label} was created. ` +
      'Create a source-bound proposal in [My Work → Agent](/my-work?tab=agent), ' +
      'then have an independent OWNER or ADMIN review and materialize it.',
  };
}
