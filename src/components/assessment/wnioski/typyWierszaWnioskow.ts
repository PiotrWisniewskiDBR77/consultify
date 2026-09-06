/**
 * Typ wiersza listy „Wnioski” w kształcie, którego potrzebuje projekcja
 * wniosków — celowo strukturalny (a nie import `MethodOutputListItem`), żeby
 * moduł projekcji dał się testować bez ciągnięcia klienta jądra metodycznego.
 */
export { PREFIKS_OCENY_ZASTANEJ } from '../assessmentOutputProjection';

export interface MethodOutputListItemLike {
  id: string;
  organizationId: string | null;
  sessionId: string | null;
  module: string;
  methodPackId: string | null;
  methodPackVersion: string | null;
  outputVersion: number | null;
  revisionOfOutputId: string | null;
  scope: string | null;
  limitationsCount: number | null;
  findingsCount: number | null;
  contentHash: string | null;
  frozenAt: string | null;
  createdAt: string | null;
  demoBypassActive: boolean;
  isSuperseded: boolean | null;
  supersededByOutputId: string | null;
  statusWniosku?: string | null;
  raportZrodlowyId?: string | null;
}
