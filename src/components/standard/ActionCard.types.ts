export type ActionCardSourceKind =
  | 'kpi_deviation'
  | 'execution_delay'
  | 'audit_finding'
  | 'finance_variance'
  | 'meeting_action';

export type ActionCardStatus = 'OPEN' | 'CLOSED';
export type ActionCardSeverity = 'AMBER' | 'RED';

export interface ActionCardModel {
  id: string;
  sourceKind: ActionCardSourceKind;
  sourceId: string;
  periodStart: string;
  periodEnd: string;
  goalMet: boolean;
  actionRequired: boolean;
  problem: string;
  rootCause: string;
  actionText: string;
  ownerName?: string;
  dueDate: string;
  comment?: string;
  status: ActionCardStatus;
  severity?: ActionCardSeverity;
}
