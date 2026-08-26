/**
 * „Źródła i twierdzenia" — DZIEWIĄTY realny ekran redesignu v1 (etap B).
 *
 * Powstaje z połączenia trzech dzisiejszych ekranów Źródeł (mapa konsolidacji
 * §2, pozycje #17 „Pliki" + #18 „Twierdzenia i źródła" + #19 „Konflikty źródeł").
 * Dwie sekcje ekranu = dwie pigułki Menu 2: Pliki · Twierdzenia i publikacja.
 *
 * `#18` i `#19` W LEGACY RENDEROWAŁY DOKŁADNIE TEN SAM KOMPONENT
 * (`GovernedContextWorkspace`) — różniły się tylko podświetleniem w menu
 * (patrz §1 dokumentu konsolidacji: zrzuty różnią się wyłącznie tym).
 * Montując go tu RAZ, żadna treść nie ginie.
 *
 * DANE SĄ REALNE — te same komponenty i to samo API co legacy:
 *   `OrganizationFilesBoundary` (GET nic nie woła — świadomie pokazuje
 *   status „NIEZWERYFIKOWANE", bo trwała kolekcja plików nie jest dziś
 *   potwierdzona; to była już decyzja legacy ekranu, nie nowa atrapa),
 *   `GovernedContextWorkspace` → `organizationGovernedContextApi`
 *   (listClaims/listVersions/decide/publish/ingestDocument) — pełny workflow
 *   review + publikacji, bez zmian.
 *
 * Oba komponenty już używają tokenów `c-*` (zero `primary-*` w źródle —
 * sprawdzone `grep` przed migracją), więc nie owijamy ich w `OrgSectionCard`
 * (podwójna ramka karty w karcie) — tylko w cichy nagłówek sekcji, spójny
 * z resztą ekranów.
 */

import React from 'react';

import { GovernedContextWorkspace } from '../GovernedContextWorkspace';
import { OrganizationFilesBoundary } from '../OrganizationDecisionQualityPanel';
import { ORG_L1 } from './OrganizationCardPrimitives';

export interface OrganizationSourcesClaimsScreenProps {
  isAdmin: boolean;
}

export const OrganizationSourcesClaimsScreen: React.FC<OrganizationSourcesClaimsScreenProps> = ({
  isAdmin,
}) => (
  <div className="space-y-3">
    <section aria-labelledby="org-sources-files-heading">
      <h3 id="org-sources-files-heading" className={ORG_L1}>
        Pliki
      </h3>
      <div className="mt-2">
        <OrganizationFilesBoundary />
      </div>
    </section>
    <section aria-labelledby="org-sources-claims-heading">
      <h3 id="org-sources-claims-heading" className={ORG_L1}>
        Twierdzenia, konflikty i publikacja
      </h3>
      <div className="mt-2">
        <GovernedContextWorkspace isAdmin={isAdmin} />
      </div>
    </section>
  </div>
);

export default OrganizationSourcesClaimsScreen;
