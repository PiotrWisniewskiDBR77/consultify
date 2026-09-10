import { AlertCircle, Link2, UserRound, CheckSquare } from 'lucide-react';
import type { StandardSekcjaDef } from './StandardArtifactShell.types';

export const ACTION_CARD_SECTION_CONTRACT = [
  { id: 'description', icon: AlertCircle, label: { pl: 'Opis', en: 'Description' } },
  { id: 'source', icon: Link2, label: { pl: 'Źródło', en: 'Source' } },
  { id: 'owner', icon: UserRound, label: { pl: 'Właściciel i termin', en: 'Owner and due date' } },
  { id: 'actions', icon: CheckSquare, label: { pl: 'Akcje i status', en: 'Actions and status' } },
] as const;

export type ActionCardSectionId = typeof ACTION_CARD_SECTION_CONTRACT[number]['id'];
export type ActionCardSection = StandardSekcjaDef & { id: ActionCardSectionId };
