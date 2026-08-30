/**
 * Dev-render host — MACIERZ OCENY DRD (stan zastany, do AUDYTU wizualnego).
 *
 * PO CO: `src/components/assessment/drd/DRDAssessmentEditor.tsx` (2333 linie)
 * jest ŻYWY w produkcie — `src/views/AssessmentSessionEditorView.tsx:28`
 * montuje go jako zakładkę obok „Formularza". To główne narzędzie pracy
 * konsultanta: wiersze = poziomy dojrzałości, kolumny = obszary osi, komórka
 * niesie treść merytoryczną, klik w komórkę otwiera popover z opisem poziomu,
 * przykładem i dwoma przyciskami „Set AS-IS" / „Set TO-BE".
 *
 * Właściciel nazwał ten ekran „prehistorycznym" i „strasznie brzydkim", ale
 * jednocześnie stwierdził, że LOGIKA PRACY jest tu najłatwiejsza. Dlatego
 * powstał ten harness: żeby dało się ekran ZMIERZYĆ i ZOBACZYĆ (zrzuty w obu
 * motywach, wszystkie 7 osi) PRZED jakąkolwiek zmianą wyglądu — zgodnie z
 * formułą polerowania (audyt → nazwanie defektów → prototyp → akcept → budowa)
 * i CLAUDE.md #7.
 *
 * Ten plik NICZEGO nie zmienia w produkcie: montuje REALNY komponent (nie
 * atrapę), karmi go mock-odpowiedziami i trzyma stan lokalnie. Żadnej trasy,
 * żadnej flagi, żadnego zapisu do bazy.
 *
 * CZEGO KOMPONENT WYMAGA (ustalone przez czytanie źródła):
 *   - propsy obowiązkowe: `assessmentId`, `value`, `onChange`;
 *   - kontekst: WYŁĄCZNIE i18n (`useTranslation`) — dostarcza go `main.tsx`
 *     harnessu. Brak routera, brak store'a, brak providerów danych.
 *   - sieć: `getAssessmentGuidanceLive` odpala się TYLKO z widoku „Survey"
 *     na żądanie (przycisk), więc domyślny widok „matrix" nie robi fetchy.
 *   - `AssessmentToolShell` rozciąga się na `h-full`, dlatego opakowanie
 *     poniżej ma jawną wysokość — bez tego macierz miałaby 0 px.
 *
 * URL: ?screen=drd-macierz-oceny&os=1..7&theme=light|dark&lang=pl
 */
import React from 'react';

import DRDAssessmentEditor, {
  type DRDEditorAnswers,
} from '@/components/assessment/drd/DRDAssessmentEditor';
import { DRD_STRUCTURE } from '@/services/drdStructure';

/**
 * Mock ocen: [poziom osiągnięty (AS-IS), poziom docelowy (TO-BE)] per obszar.
 *
 * Dobrane realistycznie dla firmy produkcyjnej w połowie transformacji: część
 * obszarów mocna (finanse, jakość), część zapóźniona (HR, R&D), cel zawsze
 * wyżej od stanu obecnego albo równy. Żadna wartość nie wychodzi poza
 * `levelCount` swojej osi (7·5·5·7·6·6·5). Jeden obszar per oś zostawiony
 * NIEOCENIONY (0/0), żeby na zrzucie było widać stan „nie oceniono" — to
 * właśnie te komórki właściciel opisał jako ledwo widoczne.
 */
const OCENY: Record<string, [number, number]> = {
  // Oś 1 — Procesy Cyfrowe (9 obszarów, 7 poziomów)
  '1A': [4, 6],
  '1B': [3, 6],
  '1C': [2, 5],
  '1D': [3, 5],
  '1E': [5, 7],
  '1F': [5, 7],
  '1G': [6, 7],
  '1H': [2, 4],
  '1I': [0, 0], // celowo nieocenione
  // Oś 2 — Produkty Cyfrowe (5 poziomów)
  '2A': [3, 5],
  '2B': [1, 4],
  '2C': [4, 5],
  '2D': [2, 4],
  '2E': [0, 0],
  // Oś 3 — Cyfrowe Modele Biznesowe (5 poziomów)
  '3A': [3, 5],
  '3B': [2, 4],
  '3C': [1, 4],
  '3D': [1, 3],
  '3E': [0, 0],
  // Oś 4 — Zarządzanie Danymi (7 poziomów)
  '4A': [5, 7],
  '4B': [4, 6],
  '4C': [3, 6],
  '4D': [2, 5],
  '4E': [0, 0],
  // Oś 5 — Kultura Transformacji (6 poziomów)
  '5A': [4, 6],
  '5B': [3, 5],
  '5C': [2, 5],
  '5D': [5, 6],
  '5E': [0, 0],
  // Oś 6 — Cyberbezpieczeństwo (6 poziomów)
  '6A': [4, 6],
  '6B': [5, 6],
  '6C': [3, 6],
  '6D': [2, 5],
  '6E': [0, 0],
  // Oś 7 — Dojrzałość AI (5 poziomów)
  '7A': [2, 4],
  '7B': [1, 4],
  '7C': [1, 3],
  '7D': [3, 5],
  '7E': [0, 0],
};

/**
 * Notatki konsultanta po polsku — produkt w tym miejscu jest po polsku
 * (właściciel pracuje po polsku), więc dane mockowe też. Widoczne dopiero w
 * widoku „Survey" po wejściu w poziom, ale karmimy je, żeby ekran nie był
 * pusty przy przełączeniu widoku podczas oglądania.
 */
const NOTATKI: Record<string, Record<string, string>> = {
  '1A': {
    '3': 'Budżet sprzedaży planowany w Excelu, kontrola ręczna raz w miesiącu — brak automatyki.',
    '4': 'Sklep B2B uruchomiony w 2025, obsługuje ok. 18% zamówień.',
  },
  '1E': {
    '5': 'MES wdrożony na dwóch liniach z czterech; raporty dostaw działają.',
  },
  '4A': {
    '5': 'Hurtownia danych na Snowflake, ETL nocny; brak katalogu danych.',
  },
};

function zbudujOdpowiedzi(): DRDEditorAnswers {
  const areas: NonNullable<DRDEditorAnswers['areas']> = {};
  for (const os of DRD_STRUCTURE) {
    for (const obszar of os.areas) {
      const [osiagniety, docelowy] = OCENY[obszar.id] || [0, 0];
      areas[obszar.id] = {
        achievedLevel: osiagniety,
        targetLevel: docelowy > 0 ? docelowy : undefined,
        levelNotes: NOTATKI[obszar.id] || {},
        levelLinks: {},
        levelDecisions: {},
      };
    }
  }
  return { areas };
}

export default function DrdMacierzOcenyScreen() {
  const params = new URLSearchParams(window.location.search);
  const zadana = Number(params.get('os') || '1');
  const osId = Number.isFinite(zadana) && zadana >= 1 && zadana <= 7 ? zadana : 1;
  const motyw = params.get('theme') || 'light';
  const jezyk = params.get('lang') || 'pl';

  const [odpowiedzi, setOdpowiedzi] = React.useState<DRDEditorAnswers>(zbudujOdpowiedzi);
  /*
    Oś trzymamy w harnessie i oddajemy komponentowi jako para
    `currentAxisId` + `onAxisChange`. Gdyby podać samo `currentAxisId`,
    wewnętrzny select osi byłby MARTWY: `handleAxisChange` ustawia stan
    lokalny, a efekt synchronizujący z propsem natychmiast cofa go do
    wartości z adresu. Tak wpięty jest też produkt
    (`AssessmentSessionEditorView`), więc harness nie zmienia zachowania.
  */
  const [osAktywna, setOsAktywna] = React.useState<number>(osId);

  const os = DRD_STRUCTURE.find((a) => a.id === osAktywna);

  return (
    <div className="h-screen flex flex-col bg-c-bg text-c-text">
      {/* Pasek harnessu — chowany przy zrzutach (data-dev-render-chrome). */}
      <div
        data-dev-render-chrome
        className="shrink-0 border-b border-c-border bg-c-surface px-4 py-2"
      >
        <div className="text-[11px] font-semibold uppercase tracking-widest text-c-text-muted">
          Stan zastany · harness dev-render · REALNY DRDAssessmentEditor · nic nie wpięte
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {DRD_STRUCTURE.map((a) => (
            <a
              key={a.id}
              href={`?screen=drd-macierz-oceny&os=${a.id}&lang=${jezyk}&theme=${motyw}`}
              className={`px-2.5 py-1 rounded-md text-[11px] border ${
                a.id === osAktywna
                  ? 'bg-c-surface-raised border-c-border-strong text-c-text font-medium'
                  : 'bg-c-surface border-c-border text-c-text-secondary'
              }`}
            >
              {a.id}. {a.namePL || a.name} ({a.areas.length}×{a.levelCount})
            </a>
          ))}
        </div>
      </div>

      {/*
        `AssessmentToolShell` liczy wysokość jako `h-full`, a wewnątrz macierz
        scrolluje się we własnym kontenerze. Bez `min-h-0` flexbox nie oddaje
        dziecku wysokości i ekran zapada się do zera.
      */}
      <div className="flex-1 min-h-0">
        {os ? (
          <DRDAssessmentEditor
            assessmentId="harness-drd-audyt"
            value={odpowiedzi}
            onChange={setOdpowiedzi}
            currentAxisId={osAktywna}
            onAxisChange={setOsAktywna}
            currentUserId="harness-konsultant"
          />
        ) : (
          <div className="p-8">Brak osi {osAktywna} w DRD_STRUCTURE.</div>
        )}
      </div>
    </div>
  );
}
