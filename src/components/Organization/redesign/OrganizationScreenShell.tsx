/**
 * OrganizationScreenShell — JEDEN szkielet dla WSZYSTKICH 11 ekranów Organizacji
 * po konsolidacji (redesign v1, flaga `orgRedesignV1`, default OFF).
 *
 * Wzorzec WIĄŻĄCY: `org-prototyp-wzorzec.html` + zrzuty proto-light/proto-dark
 * (akcept właściciela 2026-08-24). Mapa treści: `org-konsolidacja-propozycja.md`.
 *
 * Szkielet (§5.1 dokumentu konsolidacji — „bez wyjątków"):
 *   nagłówek breadcrumb (poza tym komponentem — DomainScreenHeader w widoku)
 *   → MENU 2: pigułki sekcji ekranu + lupa + primary CTA
 *   → MENU 3: chipy z licznikami (licznik ZAWSZE, także 0) + slot AI
 *   → karty treści (slot `children`)
 *   → prawy panel stanu (`OrganizationStatePanel`)
 *
 * KANON: Menu 2/Menu 3 NIE są tu odtwarzane własnym kodem — delegujemy do
 * `StandardModuleBar` (jedyna sankcjonowana fasada paska modułu). Ten komponent
 * dokłada wyłącznie to, czego standard nie ma: dwukolumnowy layout treści
 * + prawą kolumnę stanu.
 */

import React from 'react';

import { cn } from '../../../lib/utils';
import {
  StandardModuleBar,
  type StandardCounterChip,
  type StandardModuleTab,
  type StandardPrimaryCta,
} from '../../standard/StandardModuleBar';
import OrganizationStatePanel, {
  type OrganizationStatePanelProps,
} from './OrganizationStatePanel';

export interface OrganizationScreenShellProps {
  /** MENU 2 — sekcje TEGO ekranu (nie moduły!). Puste ⇒ pasek bez pigułek. */
  sections?: StandardModuleTab[];
  activeSection?: string;
  onSectionChange?: (id: string) => void;
  onSearch?: (query: string) => void;
  searchValue?: string;
  primaryCta?: StandardPrimaryCta;

  /** MENU 3 — chipy filtrów pól z licznikami. */
  chips?: StandardCounterChip[];
  activeChip?: string | null;
  onChipChange?: (id: string) => void;
  /** Prawy slot Menu 3 — akcja AI („Uzupełnij ze źródeł"). */
  aiAction?: React.ReactNode;

  /** Karty treści ekranu. */
  children?: React.ReactNode;

  /**
   * Prawy panel stanu. `null` ⇒ ekran bez panelu (np. Graf wiedzy potrzebuje
   * pełnej szerokości). Pominięty obiekt ⇒ panel się nie renderuje.
   */
  statePanel?: OrganizationStatePanelProps | null;

  className?: string;
}

export const OrganizationScreenShell: React.FC<OrganizationScreenShellProps> = ({
  sections,
  activeSection,
  onSectionChange,
  onSearch,
  searchValue,
  primaryCta,
  chips,
  activeChip,
  onChipChange,
  aiAction,
  children,
  statePanel,
  className,
}) => {
  const hasPanel = !!statePanel;

  return (
    <div data-testid="org-screen-shell" className={cn('flex min-w-0 flex-col', className)}>
      <StandardModuleBar
        tabs={sections}
        activeTab={activeSection}
        onTabChange={onSectionChange}
        onSearch={onSearch}
        searchValue={searchValue}
        primaryCta={primaryCta}
        chips={chips}
        activeChip={activeChip ?? undefined}
        onChipChange={onChipChange}
        menu3Right={aiAction}
        className="-mx-1"
      />
      <div
        className={cn(
          'grid min-w-0 items-start gap-6 pt-4',
          hasPanel ? 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]' : 'grid-cols-1'
        )}
      >
        <div className="min-w-0">{children}</div>
        {hasPanel && (
          <div className="min-w-0 xl:sticky xl:top-4">
            <OrganizationStatePanel {...(statePanel as OrganizationStatePanelProps)} />
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationScreenShell;
