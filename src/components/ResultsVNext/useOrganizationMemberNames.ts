/**
 * Przeniesione do `src/hooks/useOrganizationMemberNames.ts` (2026-09-05, runda 3
 * odbioru): tego samego resolvera potrzebują Finanse i Realizacja, a te moduły
 * nie mogą importować haka z katalogu „Wyniki". Tu zostaje re-eksport, żeby
 * istniejące wołania (`okr/OkrObjectivesView`, `okr/OkrKeyResultsView`,
 * `okr/OkrSetOverviewView`) nie musiały się zmieniać.
 */
export {
  buildMemberNameMap,
  memberNameOrUnknown,
  readMemberId,
  readMemberLabel,
  useOrganizationMemberNames,
  type MemberNameResolver,
} from '@/hooks/useOrganizationMemberNames';
