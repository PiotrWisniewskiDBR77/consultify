/**
 * ArtifactBreadcrumb — brakujący element `㉛` (Breadcrumb) w Menu 1 artefaktu.
 *
 * SSOT: `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` §9.2 (element ㉛:
 * „L4 c.text-muted, separator „/", ostatni c.text — ścieżka powrotu (Menu 1)")
 * i §11.2 („Menu 1 ⑫ …: `㉛`breadcrumb ← · ikona-typ · tytuł inline …").
 *
 * PO CO TEN PLIK ISTNIEJE (tor PLATFORMY, punkt zakresu 1, 2026-08-11).
 * Zbadano, czy `StandardArtifactShell` da się użyć wprost jako powłoka klasy L
 * dla pełnych narzędzi KPI/ROI/OKR. Odpowiedź: NIE wprost, ale nie dlatego, że
 * standard jest niekompletny — `StandardArtifactShell` jest CIENKĄ WARSTWĄ
 * TYPÓW nad `NModeShell` scoped do INNEGO programu („Karty N", SPEC-N §5.4):
 * `karta: KartaNKey` to ZAMKNIĘTA unia 7 kluczy powiązanych z konkretnym planem
 * migracji (fala F, M1–M7) siedmiu ISTNIEJĄCYCH ekranów (Tool/Initiative/
 * Insight/Interview/Decision/Notification/Task) w `registry.ts`. Dopisanie
 * kpi/roi/okr do tej unii wymagałoby fałszywych wpisów `REJESTR_KART_N`
 * (pole `komponent` musiałoby wskazywać na plik, który jeszcze nie istnieje —
 * domeny budują go równolegle) i pomieszałoby dwa niezależne programy
 * śledzenia migracji. Sam `NModeShell` (który `StandardArtifactShell`
 * opakowuje) NIE MA żadnej bramki rejestru — jest gotowym, ogólnym prymitywem
 * używanym już przez 7+ realnych ekranów klasy L z >4 sekcjami (np.
 * Initiative: 26 sekcji) — DOKŁADNIE to, czego potrzebują pełne narzędzia.
 *
 * PRZEPIS DLA DOMEN (KPI/ROI/OKR) — powłoka klasy L bez budowania nowego
 * standardu, WYŁĄCZNIE ze złożenia istniejących prymitywów `standard/`:
 *
 *   <div className="flex h-full min-h-0 flex-col">
 *     <ArtifactBreadcrumb items={[{ label: t('kpi.registry'), onClick: goBack }, { label: kpi.kpiCode }]} />
 *     <div className="min-h-0 flex-1">
 *       <NModeShell
 *         header={{ title: kpi.kpiCode, statusLabel, statusTone, primaryAction, onClose, ... }}
 *         sections={sections}                    // >4 dozwolone — klasa L
 *         rightPanel={<ArtifactRightPanel sections={panelSections} />}  // Akcje·Właściwości·Powiązania·Komentarze·Historia
 *         activeSection={activeSection}
 *         onSectionChange={setActiveSection}
 *         presentationMode="n"
 *         onPresentationModeChange={noop}
 *       />
 *     </div>
 *   </div>
 *
 * `ArtifactRightPanel`/`ArtifactPropertiesTable` (ten sam katalog) są UŻYWALNE
 * WPROST, bez żadnej bramki — sekcja „Właściwości" panelu renderuje
 * `<ArtifactPropertiesTable rows={...} propertyLabel={...} valueLabel={...} />`.
 * Kebab = `RowActionsMenu` (`src/components/shared/RowActionsMenu.tsx`) w
 * `NModeHeaderConfig` przez istniejący mechanizm overflow-menu nagłówka.
 * Wspólne stany (saving/saved/error/conflict/Teresa unavailable) = punkt
 * zakresu 4, `src/components/shared/states/{SaveState,TeresaState}.tsx`.
 *
 * DLACZEGO OSOBNY, MAŁY KOMPONENT A NIE ZMIANA `NModeHeader.tsx`: ten plik
 * NIE jest na allowliście tego toru (`src/components/shared/NModeLayout/**`
 * należy do właściciela karty N) — dopisanie breadcrumbu TAM byłoby zmianą
 * poza dozwolonym zakresem. Ten komponent renderuje się NAD `NModeShell`
 * (który sam renderuje `NModeHeader` jako pierwsze dziecko), wyrównany do
 * tego samego `max-w-6xl` / `px-6`, więc wizualnie wygląda jak jeden pasek
 * Menu 1, mimo że to dwa komponenty. Zero zmian w `NModeLayout/**`.
 *
 * Wygląd = 1:1 z istniejącym breadcrumbem List (`StandardModuleBar`
 * `MENU_1_BREADCRUMB_LINK`/`MENU_1_BREADCRUMB_CURRENT`, importowane, NIE
 * duplikowane) — jeden atom, dwie powierzchnie (§9 „żadna powierzchnia nie
 * wymyśla własnych atomów").
 */
import { ChevronRight } from 'lucide-react';
import React from 'react';

import {
  MENU_1_BREADCRUMB_CURRENT,
  MENU_1_BREADCRUMB_LINK,
} from '../shared/ModuleMenu3';

/** Ten sam kształt co `StandardBreadcrumb` (Lista) — jeden typ, dwie powłoki. */
export interface ArtifactBreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export interface ArtifactBreadcrumbProps {
  /** Ścieżka powrotu, od korzenia do bieżącego artefaktu (ostatni = current). */
  items: ArtifactBreadcrumbItem[];
  className?: string;
}

/**
 * Element `㉛` Menu 1 artefaktu (SPEC-A §9.2/§11.2). Renderuje się NAD
 * `NModeShell` — patrz przepis kompozycji w nagłówku pliku. Pusta tablica →
 * `null` (addytywne: karta bez breadcrumbu wygląda jak dziś).
 */
export const ArtifactBreadcrumb: React.FC<ArtifactBreadcrumbProps> = ({
  items,
  className = '',
}) => {
  if (items.length === 0) return null;

  return (
    <div className={`px-6 pt-3 ${className}`.trim()}>
      <nav aria-label="Breadcrumb" className="mx-auto flex max-w-6xl min-w-0 items-center gap-1.5">
        {items.map((crumb, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <React.Fragment key={`${crumb.label}-${idx}`}>
              {idx > 0 ? (
                <ChevronRight size={14} className="shrink-0 text-c-text-muted" aria-hidden />
              ) : null}
              {crumb.onClick && !isLast ? (
                <button type="button" onClick={crumb.onClick} className={MENU_1_BREADCRUMB_LINK}>
                  {crumb.label}
                </button>
              ) : (
                <span className={isLast ? MENU_1_BREADCRUMB_CURRENT : MENU_1_BREADCRUMB_LINK}>
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </nav>
    </div>
  );
};

ArtifactBreadcrumb.displayName = 'ArtifactBreadcrumb';

export default ArtifactBreadcrumb;
