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

import { getArtifactPath } from '@/utils/artifactLinks';

export type IdeaConversionTarget =
  | 'initiative'
  | 'task_set'
  | 'decision'
  | 'team_chat'
  | 'report'
  | 'presentation';

export interface IdeaConversionResult {
  created?: {
    conversationId?: string | null;
    initiativeId?: string | null;
    decisionId?: string | null;
    reportId?: string | null;
    presentationId?: string | null;
  } | null;
  promotedEntityId?: string | null;
  outputId?: string | null;
  [key: string]: unknown;
}

export interface IdeaConversionOutcome {
  /** i18n key for the toast that tells the user what happened. */
  toastKey: string;
  /** English default, used when the catalog has no entry. */
  toastDefault: string;
  /** Where the action should take the user, or null to stay on the list. */
  href: string | null;
  /** Exact identifier returned by the conversion receipt. */
  entityId: string | null;
}

type ReceiptTarget = 'initiative' | 'decision' | 'report' | 'presentation';

const RECEIPT_LABELS: Record<ReceiptTarget, string> = {
  initiative: 'Initiative',
  decision: 'Decision',
  report: 'Report',
  presentation: 'Presentation',
};

function conversionEntityId(
  target: ReceiptTarget,
  result: IdeaConversionResult | null | undefined
): string {
  const createdId =
    target === 'initiative'
      ? result?.created?.initiativeId
      : target === 'decision'
        ? result?.created?.decisionId
        : target === 'report'
          ? result?.created?.reportId
          : result?.created?.presentationId;
  return String(createdId || result?.outputId || result?.promotedEntityId || '').trim();
}

function conversionHref(target: ReceiptTarget, entityId: string): string | null {
  if (!entityId) return null;
  if (target === 'decision') {
    return `/my-work?decisionId=${encodeURIComponent(entityId)}`;
  }
  return getArtifactPath(target, entityId);
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
      entityId: conversationId || null,
    };
  }

  if (
    target === 'initiative' ||
    target === 'decision' ||
    target === 'report' ||
    target === 'presentation'
  ) {
    const entityId = conversionEntityId(target, result);
    const label = RECEIPT_LABELS[target];
    return {
      toastKey: `myWork.ideasList.toastReceipt.${target}`,
      toastDefault: entityId
        ? `${label} created (ID: ${entityId}). Opening it now.`
        : `${label} conversion completed, but the server returned no identifier.`,
      href: conversionHref(target, entityId),
      entityId: entityId || null,
    };
  }

  return {
    toastKey: 'myWork.ideasList.toastSuccess4',
    toastDefault: 'Done',
    href: null,
    entityId: null,
  };
}
