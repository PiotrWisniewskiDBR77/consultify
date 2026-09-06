/**
 * kartaWynikow — WSPÓLNY szkielet trzech kart N modułu Wyniki (miernik KPI,
 * cel OKR, analiza ROI).
 *
 * ── SŁOWA WŁAŚCICIELA (06.09.2026, 16:06–16:09) ───────────────────────────
 * Przy otwartej karcie miernika: „Znowu nie ma drugiego, trzeciego menu; nie
 * otwiera się ta karta w trzecim menu, nie da się tym zarządzać. Nie ma
 * przycisku Work with AI. To normalne N-type narzędzie, muszą tu być
 * wszystkie narzędzia z nim związane." Przy karcie celu OKR: „dokładnie te
 * same uwagi". Przy analizie ROI: „jedyny brak: ustabilizować menu 1–3
 * i formułę Pracuj z AI".
 *
 * ── CO BYŁO ZEPSUTE (pomiar 2026-09-06 na gałęzi m03) ─────────────────────
 * Trzy karty Wyników są OSOBNYMI TRASAMI (`ROUTES.RESULTS_KPI.TOOL`,
 * `RESULTS_OKR.OBJECTIVE`, `RESULTS_ROI.CARD`), a pasek modułu (Menu 2 z
 * KPI · OKR · ROI i Menu 3 z pigułkami) renderuje wyłącznie ekran rejestru
 * (`ResultsVNextRegistryShell`). Wejście w kartę ZDEJMOWAŁO więc cały pasek
 * modułu: użytkownik tracił zakładki funkcji i nie miał czym wrócić na listę
 * poza okruszkiem. Dokładnie to zgłosił właściciel („nie otwiera się ta karta
 * w trzecim menu").
 *
 * ── ROZWIĄZANIE: TEN SAM MECHANIZM, CO INICJATYWY I MOJA PRACA ────────────
 * `InitiativesHub.tsx:2557` karmi `StandardModuleBar` propami `openItems` /
 * `activeItemId` / `onSelectItem` / `onCloseItem` / `onShowList`; pasek
 * przekazuje je do `ModuleNavBar`, a ten renderuje `DynamicTabs` — wiersz
 * „Lista | <odznaka> <nazwa> ●". Karty Wyników nie mają huba, w którym
 * mieszkałby ten stan (są trasami), więc `KartaWynikowChrome` podaje listę
 * JEDNOELEMENTOWĄ — otwartą kartę — a „Lista"/„zamknij" wraca na rejestr
 * domeny. Zero nowego komponentu paska, zero własnej tabeli: pasek jest
 * kanoniczny (`StandardModuleBar`), zmienia się tylko to, KTO go renderuje.
 *
 * NIE DOTYKAMY `ResultsVNextRegistryShell.tsx` — pracuje na nim inny robotnik
 * (R2). Ten plik jest addytywny i nie ma z nim wspólnych linii.
 *
 * ── SEKCJE (Menu 5) ───────────────────────────────────────────────────────
 * `zbudujSpecSekcji` zamienia listę sekcji karty na `ArtifactCardSpec`, żeby
 * karty Wyników mogły użyć KANONICZNEGO `SectionsManagerMenu` (pokazywanie /
 * ukrywanie / kolejność) zamiast trzech własnych rozwijanych list. Szew jest
 * już w `useCardLayout` (prop `spec` — „seam through which an artifact can
 * feed a spec DERIVED FROM THE CANONICAL CARD CONTRACT"), więc korzystamy
 * z niego, a nie budujemy czwartej ścieżki.
 *
 * ZAKAZY (CLAUDE.md pułapka nr 1): zero `primary-*` (crimson), fokus wyłącznie
 * `c-focus`, akcent AI wyłącznie `c-ai` (te ostatnie mieszkają w `PracujZAI`).
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ItemStatus, OpenDocument } from '@/components/shared/ModuleHub/types';
import type { ArtifactCardSpec } from '@/components/shared/NModeLayout/cardSets';
import { StandardModuleBar } from '@/components/standard';

import { getResultsDomainPath, getResultsDomainTabs } from '../resultsDomainNavigation';
import type { ResultsVNextDomain } from '../types';

// ── Menu 1/2/3 nad otwartą kartą ────────────────────────────────────────────

export interface KartaWynikowChromeProps {
  /** Która zakładka Menu 2 ma być aktywna (funkcja, do której należy karta). */
  domena: ResultsVNextDomain;
  /** Identyfikator otwartej karty — klucz pigułki w Menu 3. */
  kartaId: string;
  /** Nazwa otwartej karty (pigułka Menu 3). */
  kartaNazwa: string;
  /**
   * Odznaka pigułki — krótki kod funkcji („KPI"/„OKR"/„ROI"), dokładnie tak
   * jak Inicjatywy pokazują „inicjatywa <nazwa>". `DynamicTabs` renderuje ją
   * jako `subType` przed nazwą.
   */
  kartaOdznaka: string;
  /** Kropka statusu pigułki — mapowana z własnego cyklu życia karty. */
  kartaStatus: ItemStatus;
  /** Powrót na rejestr domeny („Lista" oraz × na pigułce). */
  onPokazListe: () => void;
  /** Treść karty (powłoka `NModeShell` + okruszek). */
  children: React.ReactNode;
  /** Do `data-testid` — jeden na kartę, żeby zrzuty i testy miały uchwyt. */
  testId?: string;
}

/**
 * Pasek modułu Wyniki nad OTWARTĄ kartą.
 *
 * `type: 'report'` w `OpenDocument` jest wartością z zamkniętego uniona
 * `ModuleHub/types.ts`, a `DynamicTabs` tego pola W OGÓLE nie czyta (renderuje
 * `subType`, `name`, `status`) — sprawdzone w kodzie, nie założone. Rozszerzanie
 * tego uniona o trzy klucze Wyników byłoby zmianą wspólnego typu bez potrzeby.
 */
export const KartaWynikowChrome: React.FC<KartaWynikowChromeProps> = ({
  domena,
  kartaId,
  kartaNazwa,
  kartaOdznaka,
  kartaStatus,
  onPokazListe,
  children,
  testId,
}) => {
  const navigate = useNavigate();

  const openItems = useMemo<OpenDocument[]>(
    () => [
      {
        id: kartaId,
        type: 'report',
        subType: kartaOdznaka,
        name: kartaNazwa,
        status: kartaStatus,
      },
    ],
    [kartaId, kartaNazwa, kartaOdznaka, kartaStatus]
  );

  return (
    <div className="h-full" data-testid={testId}>
      <StandardModuleBar
      tabs={getResultsDomainTabs()}
      activeTab={domena}
      onTabChange={(id) => navigate(getResultsDomainPath(id))}
      // Jeden tryb widoku ⇒ `ModuleNavBar` nie renderuje przełącznika
      // (`orderedViewModes.length > 1`). Karta nie ma widoków tabela/kanban.
      viewModes={['table']}
      openItems={openItems}
      activeItemId={kartaId}
      // Pigułka JEST aktywna — klik w nią nie ma dokąd prowadzić.
      onSelectItem={() => {}}
      onCloseItem={onPokazListe}
      onShowList={onPokazListe}
      >
        {children}
      </StandardModuleBar>
    </div>
  );
};

// ── Sekcje karty → `ArtifactCardSpec` dla `SectionsManagerMenu` ─────────────

export interface SekcjaKartyWynikow {
  id: string;
  label: { pl: string; en: string };
  /** Id ikony z mapy `NModeCardManager.ICONS`; nieznane spada na `Layers`. */
  ikona?: string;
  /** Sekcja strukturalna karty — można ukryć, nie można usunąć. */
  core?: boolean;
}

/**
 * Buduje `ArtifactCardSpec` z listy sekcji karty. Jeden zestaw („pełny"),
 * bo karty Wyników nie mają wariantów widoczności zatwierdzonych przez
 * właściciela — wymyślanie zestawu „Rdzeń" byłoby treścią spoza kontraktu.
 */
export function zbudujSpecSekcji(sekcje: SekcjaKartyWynikow[], nazwaZestawu: {
  pl: string;
  en: string;
}): ArtifactCardSpec {
  return {
    catalog: sekcje.map((s) => ({
      id: s.id,
      label: { en: s.label.en, pl: s.label.pl },
      icon: s.ikona ?? 'Layers',
      core: s.core ?? true,
    })),
    sets: [
      {
        id: 'default',
        label: { en: nazwaZestawu.en, pl: nazwaZestawu.pl },
        cards: sekcje.map((s) => s.id),
      },
    ],
  };
}

export default KartaWynikowChrome;

// ── Zapis propozycji „Pracuj z AI" w kartach Wyników ────────────────────────

/**
 * DLACZEGO OSOBNY HAK, A NIE `pracujZAIzKartAnalizy`.
 *
 * Most `zbudujZrodlaPracujZAI` zakłada, że karta ma LOKALNY stan pól i jedną
 * synchroniczną drogę zapisu (`useCardAIAnalysis.applyChange`) — tak działają
 * Zadanie, Decyzja, Powiadomienie i Wniosek, które trzymają treść w `useState`
 * i zapisują ją później własnym „Zapisz". Trzy karty Wyników są inne: nie mają
 * lokalnej kopii treści (renderują to, co przyszło z serwera) i JEDYNA droga
 * zapisu to komenda REST z kontrolą wersji (`expectedVersion` / CAS):
 *   · miernik — `PUT /vnext/results/kpi/:kpiId/draft` (`editKpiDraft`),
 *   · cel     — `PATCH /vnext/results/okr/objectives/:id` (`updateObjective`),
 *   · ROI     — `PATCH .../post-investment-reviews/:pirId` (draft PIR).
 *
 * `ZrodloUzupelnienia.zastosuj` jest SYNCHRONICZNE (`=> boolean`), więc nie da
 * się z niego uczciwie zwrócić wyniku zapytania sieciowego. Rozwiązanie: zapis
 * jest KOLEJKOWANY (sekwencyjnie — każda komenda podnosi `rowVersion`, więc
 * równoległe wysłanie dwóch pól kończyłoby się konfliktem 409 na drugim),
 * a użytkownik widzi jego stan na pasku karty. `zastosuj` zwraca `true`,
 * bo naprawdę PRZYJĘŁO zatwierdzoną treść — o powodzeniu zapisu mówi pasek,
 * nie milczenie.
 *
 * ZAKAZ ZAPISU BEZ ZATWIERDZENIA zostaje nienaruszony: `PracujZAI` woła
 * `zastosuj` wyłącznie z przycisku „Zatwierdź" (jedyne wywołanie w pliku).
 */
export type StanZapisuAI =
  | { faza: 'brak' }
  | { faza: 'zapis'; zlecone: number }
  | { faza: 'zapisano'; zlecone: number }
  | { faza: 'blad'; powod: string };

/** Kod błędu z backendu, nigdy „coś poszło nie tak". */
function kodBledu(err: unknown): string {
  return String(
    (err as { data?: { code?: string } })?.data?.code ||
      (err as { code?: string })?.code ||
      (err as Error)?.message ||
      'UNKNOWN'
  );
}

export function useZapisPolAI(zapisz: (poleId: string, wartosc: string) => Promise<void>): {
  stan: StanZapisuAI;
  zastosuj: (poleId: string, wartosc: string) => boolean;
  wyczysc: () => void;
} {
  const [stan, setStan] = React.useState<StanZapisuAI>({ faza: 'brak' });
  const kolejkaRef = React.useRef<Promise<void>>(Promise.resolve());
  const zleconeRef = React.useRef(0);
  const zrobioneRef = React.useRef(0);

  const zastosuj = React.useCallback(
    (poleId: string, wartosc: string): boolean => {
      zleconeRef.current += 1;
      setStan({ faza: 'zapis', zlecone: zleconeRef.current });
      kolejkaRef.current = kolejkaRef.current
        .then(() => zapisz(poleId, wartosc))
        .then(() => {
          zrobioneRef.current += 1;
          if (zrobioneRef.current === zleconeRef.current) {
            setStan({ faza: 'zapisano', zlecone: zleconeRef.current });
          }
        })
        .catch((err) => {
          setStan({ faza: 'blad', powod: kodBledu(err) });
        });
      return true;
    },
    [zapisz]
  );

  const wyczysc = React.useCallback(() => {
    zleconeRef.current = 0;
    zrobioneRef.current = 0;
    setStan({ faza: 'brak' });
  }, []);

  return { stan, zastosuj, wyczysc };
}

/**
 * Pasek stanu zapisu propozycji AI. Tony: informacja / powodzenie / błąd —
 * wyłącznie tokeny `c-*`, zero `primary-*` (crimson zarezerwowany dla
 * semantyki krytycznej, CLAUDE.md pułapka nr 1).
 */
export const PasekZapisuAI: React.FC<{
  stan: StanZapisuAI;
  isPolish: boolean;
  onZamknij: () => void;
}> = ({ stan, isPolish, onZamknij }) => {
  if (stan.faza === 'brak') return null;
  const tresc =
    stan.faza === 'zapis'
      ? isPolish
        ? `Zapisywanie zatwierdzonej propozycji (${stan.zlecone})…`
        : `Saving the approved proposal (${stan.zlecone})…`
      : stan.faza === 'zapisano'
        ? isPolish
          ? `Zapisano zatwierdzoną propozycję (${stan.zlecone}).`
          : `Approved proposal saved (${stan.zlecone}).`
        : isPolish
          ? `Nie udało się zapisać propozycji: ${stan.powod}`
          : `Could not save the proposal: ${stan.powod}`;
  const klasa =
    stan.faza === 'blad'
      ? 'border-c-danger/40 bg-c-danger/10 text-c-danger'
      : 'border-c-border-subtle bg-c-surface-raised text-c-text-secondary';
  return (
    <div
      role="status"
      data-testid="karta-wynikow-pasek-zapisu-ai"
      className={`mx-4 mb-2 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${klasa}`}
    >
      <span>{tresc}</span>
      <button
        type="button"
        onClick={onZamknij}
        className="rounded-md px-2 py-0.5 text-[11px] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        {isPolish ? 'Zamknij' : 'Close'}
      </button>
    </div>
  );
};
