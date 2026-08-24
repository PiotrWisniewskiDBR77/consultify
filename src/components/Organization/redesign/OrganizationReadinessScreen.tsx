/**
 * „Gotowość organizacji" — DZIESIĄTY realny ekran redesignu v1 (etap B).
 *
 * Ekran samodzielny (§4 dokumentu konsolidacji: „1 → 1"), ale w praktyce
 * przejmuje treść WSZYSTKICH czterech legacy tras modułu „Gotowość i nadzór"
 * (`summary`, `gaps-freshness`, `decisions-conflicts`, `versions-publication` —
 * `REDESIGN_SCREEN_REDIRECTS` w `organizationRedesignNav.ts` już je łączy tu).
 * `gaps-freshness` i `decisions-conflicts` w LEGACY RENDEROWAŁY DOKŁADNIE TEN
 * SAM KOMPONENT co `summary` (`OrganizationDecisionQualityPanel` ignoruje
 * `screen` poza atrybutem `data-screen`) — montując go RAZ, żadna treść
 * nie ginie z tych trzech.
 *
 * `versions-publication` renderowało `GovernedContextWorkspace` — TĘ SAMĄ
 * pełną ścieżkę publikacji, która już mieszka w „Źródła i twierdzenia"
 * (etap A ustalił: przycisk „Opublikuj wersję kontekstu" w panelu stanu
 * PROWADZI tam, zamiast duplikować workflow governance na dwóch ekranach —
 * patrz komentarz w `OrganizationIdentityOperatingScreen.tsx`). Ten ekran
 * pokazuje więc GOTOWOŚĆ (blokady, zatwierdzone fakty, ostatnia publikacja),
 * nie powtarza samego narzędzia publikacji.
 *
 * DANE SĄ REALNE — ten sam komponent i to samo API co legacy:
 *   `OrganizationDecisionQualityPanel` → `organizationGovernedContextApi`
 *   (listClaims/listVersions), już na tokenach `c-*` (zero `primary-*`).
 */

import React from 'react';

import { OrganizationDecisionQualityPanel } from '../OrganizationDecisionQualityPanel';

export const OrganizationReadinessScreen: React.FC<{ title: string }> = ({ title }) => (
  <OrganizationDecisionQualityPanel screen="summary" title={title} />
);

export default OrganizationReadinessScreen;
