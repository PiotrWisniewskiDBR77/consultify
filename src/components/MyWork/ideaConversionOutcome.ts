/**
 * What an Idea conversion actually did — one place, so the UI cannot lie about it.
 *
 * S1.14b / W11 (pomiar 13.09, staging): the row kebab item "Team Chat" opened no
 * chat. It sent `POST /api/my-work/my-ideas/:id/convert` with target `team_chat`,
 * which on the server really does create a conversation (chat_projects +
 * conversations + first message) AND calls `promote(...)`, moving the idea's stage
 * seed → promoted. The UI reported a bare "Done" and stayed on the list: the user
 * saw an idea change state with no explanation and never reached the thread the
 * action had just created.
 */

export type IdeaConversionTarget =
  | 'initiative'
  | 'task_set'
  | 'decision'
  | 'team_chat'
  | 'report'
  | 'presentation';

export interface IdeaConversionResult {
  created?: { conversationId?: string | null } | null;
  promotedEntityId?: string | null;
  [key: string]: unknown;
}

export interface IdeaConversionOutcome {
  /** i18n key for the toast that tells the user what happened. */
  toastKey: string;
  /** English default, used when the catalog has no entry. */
  toastDefault: string;
  /** Where the action should take the user, or null to stay on the list. */
  href: string | null;
}

export function describeIdeaConversion(
  target: IdeaConversionTarget | string,
  result: IdeaConversionResult | null | undefined
): IdeaConversionOutcome {
  if (target === 'team_chat') {
    const conversationId = String(
      result?.created?.conversationId || result?.promotedEntityId || ''
    ).trim();
    return {
      toastKey: 'myWork.ideasList.toastTeamChat',
      toastDefault: 'Team chat thread created. The idea is now marked Promoted.',
      href: conversationId ? `/chat/${encodeURIComponent(conversationId)}` : null,
    };
  }

  return {
    toastKey: 'myWork.ideasList.toastSuccess4',
    toastDefault: 'Done',
    href: null,
  };
}
