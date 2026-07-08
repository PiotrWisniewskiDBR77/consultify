/**
 * Logistics Automation — worked-example fixture.
 *
 * Sourced verbatim from the doctrine's §7 worked example
 * (Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/logistics-automation.md): a B2B/
 * e-commerce hybrid distributor, one 15 000 m² warehouse, 8 000 order-lines/day
 * baseline, Q4 peak ~x3.2 baseline, 70 FTE baseline / 140 FTE peak, labour =
 * 62% of warehouse opex.
 *
 * Zone facts (Krok 1 table): fully-loaded labour cost is uniform across the
 * flow (~180 PLN/h fully loaded ~= 150 000 PLN/FTE/year), which reproduces the
 * doctrine's headline picking figure exactly: 38 FTE x 150 000 x 58% ~= 3.3M
 * PLN/year of non-productive-motion cost (Insight #1).
 *
 * Used as: (a) the `toLogisticsSession` self-test fixture, (b) a seed/demo
 * session for the tool, (c) a reference for QA/DoD screenshots.
 */

import type { OperationalToolData } from '@/store/useToolStore';

const FULLY_LOADED_COST_PER_FTE = 150_000; // PLN/year, ~180 PLN/h fully loaded

export const LOGISTICS_FIXTURE: OperationalToolData = {
  context: {
    goal:
      'Zdecydować gdzie w magazynie automatyzacja faktycznie tworzy wartość — co, jaką technologią, w jakiej kolejności i z jakim zwrotem',
    scope:
      'Jeden magazyn B2B/e-commerce hybrydowy, 15 000 m², 5 stref (przyjęcie, składowanie, kompletacja, pakowanie, wysyłka), 8 000 linii zamówień/dzień baseline',
    timeframe: 'medium',
    successSignal:
      'Policzalny business case (payback w miesiącach) do obrony przed zarządem, nie katalog sprzętu',
    assumptions:
      'Koszt pracy w pełni obciążony ~180 PLN/godz jednolity w przepływie; peak Q4 (listopad-grudzień) ~x3,2 baseline; 62% kosztów operacyjnych magazynu to praca ludzka',
    constraints:
      'Wizyta na hali obowiązkowa (gemba); reżimy baseline i peak obserwowane osobno, nie uśredniane',
  },
  sections: {
    zones: [
      {
        id: 'zone-receiving',
        title: 'Receiving — przyjęcie',
        description:
          'Ręczne skanowanie, rozładunek. 6 FTE, 25% czasu nieprodukcyjnego (chodzenie/szukanie/czekanie).',
        impact: 'low',
        effort: 'medium',
        category: 'receiving',
        zone: 'receiving',
        fte: 6,
        laborCostPerFte: FULLY_LOADED_COST_PER_FTE,
        nonProductiveShare: 0.25,
        processOrdered: true,
        candidateTech: 'receiving-auto',
        measured: true,
      },
      {
        id: 'zone-storage',
        title: 'Storage — składowanie',
        description:
          'Wózki, regały statyczne, 40% wysokości budynku niewykorzystane. 4 FTE, 15% czasu nieprodukcyjnego. Dokładność zapasu 91% — poniżej progu 95%.',
        impact: 'medium',
        effort: 'high',
        category: 'storage',
        zone: 'storage',
        fte: 4,
        laborCostPerFte: FULLY_LOADED_COST_PER_FTE,
        nonProductiveShare: 0.15,
        inventoryAccuracy: 0.91,
        processOrdered: true,
        candidateTech: 'asrs',
        measured: true,
      },
      {
        id: 'zone-picking',
        title: 'Picking — kompletacja',
        description:
          'W pełni ręczne. 38 FTE, 58% czasu nieprodukcyjnego (chodzenie po całej hali, losowy slotting wg daty przyjęcia, nie rotacji). Mispick 3,1%. Peak Q4 x3,2 baseline.',
        impact: 'high',
        effort: 'high',
        category: 'picking',
        zone: 'picking',
        fte: 38,
        laborCostPerFte: FULLY_LOADED_COST_PER_FTE,
        nonProductiveShare: 0.58,
        baselineVolume: 8000,
        peakVolume: 25600,
        processOrdered: false,
        candidateTech: 'amr',
        measured: true,
      },
      {
        id: 'zone-packing',
        title: 'Packing — pakowanie',
        description: 'Ręczne stacje. 12 FTE, 20% czasu nieprodukcyjnego.',
        impact: 'low',
        effort: 'low',
        category: 'packing',
        zone: 'packing',
        fte: 12,
        laborCostPerFte: FULLY_LOADED_COST_PER_FTE,
        nonProductiveShare: 0.2,
        processOrdered: true,
        candidateTech: 'pack-station',
        measured: true,
      },
      {
        id: 'zone-shipping',
        title: 'Shipping — wysyłka',
        description: 'Ręczne sortowanie na doki. 10 FTE, 18% czasu nieprodukcyjnego.',
        impact: 'low',
        effort: 'medium',
        category: 'shipping',
        zone: 'shipping',
        fte: 10,
        laborCostPerFte: FULLY_LOADED_COST_PER_FTE,
        nonProductiveShare: 0.18,
        processOrdered: true,
        candidateTech: 'sorter',
        measured: true,
      },
    ] as unknown as OperationalToolData['sections']['zones'],
    moves: [
      {
        id: 'move-picking-reslot',
        title: 'Re-slotting ABC + konsolidacja tras kompletacji',
        description:
          '18% SKU generuje 79% ruchu kompletacji, rozrzucone losowo (slotting wg daty przyjęcia). Reorganizacja (najszybciej rotujące SKU najbliżej pakowania) — symulacja na próbie tras daje 17% redukcji dystansu, 0 PLN CAPEX, wdrożenie 6 tygodni.',
        impact: 'high',
        effort: 'low',
        category: 'picking',
        zone: 'picking',
        processFirst: true,
        evidence: [
          'Analiza ABC: 18% SKU = 79% ruchu kompletacji',
          'Symulacja tras: 17% redukcji dystansu bez CAPEX',
        ],
      },
      {
        id: 'move-picking-amr',
        title: 'AMR + stacje goods-to-person dla top-18% SKU',
        description:
          'Po re-slottingu czas nieprodukcyjny w pickingu spada z 58% do ~41%, nadal dominuje FTE-koszt obszaru. CAPEX ~3,8 mln PLN, redukcja FTE z 38 do 24, redukcja mispick z 3,1% do ~0,8%. Payback ~22 miesiące (pasmo AMR 18-24 mies.) — dobrze zwalidowany business case.',
        impact: 'high',
        effort: 'medium',
        category: 'picking',
        zone: 'picking',
        processFirst: false,
        evidence: [
          'Obserwacja pickera ze stoperem (gemba)',
          'Symulacja floty AMR na próbie top-18% SKU',
          'Business case: CAPEX 3,8 mln PLN, payback ~22 mies.',
        ],
      },
      {
        id: 'move-storage-accuracy',
        title: 'Cykliczne liczenie zapasu i dyscyplina WMS',
        description:
          'Dokładność zapasu 91% < próg 95% — pierwsza inwestycja to dane, nie roboty, mimo 40% niewykorzystanej wysokości budynku atrakcyjnej dla ASRS.',
        impact: 'high',
        effort: 'medium',
        category: 'storage',
        zone: 'storage',
        processFirst: true,
        evidence: ['Audyt WMS: dokładność zapasu 91%', 'Cykliczne liczenie — plan wdrożenia'],
      },
      {
        id: 'move-storage-asrs-deferred',
        title: 'ASRS dla storage — ocena odroczona',
        description:
          '40% wysokości budynku niewykorzystane wygląda atrakcyjnie, ale odroczone do dokładności zapasu >97% przez min. 2 kwartały i pewnego horyzontu wolumenu (ASRS: 15-25 lat życia, payback 36-60 mies.).',
        impact: 'medium',
        effort: 'high',
        category: 'storage',
        zone: 'storage',
        processFirst: false,
        evidence: ['Pomiar wysokości budynku: 40% niewykorzystane'],
      },
      {
        id: 'move-receiving-auto',
        title: 'Automatyczne skanowanie / OCR przy przyjęciu',
        description:
          '25% czasu nieprodukcyjnego przy 6 FTE — niska absolutna dźwignia finansowa względem pickingu (laborWeight 900k vs 5,7 mln). Kandydat drugiej fali: jeszcze niezwalidowany biznesowo, oceniany dopiero po fazie 1 pickingu.',
        impact: 'low',
        effort: 'high',
        category: 'receiving',
        zone: 'receiving',
        processFirst: false,
        evidence: [],
      },
      {
        id: 'move-shipping-sorter',
        title: 'Sorter / automatyczne ładowanie na doki',
        description:
          '18% czasu nieprodukcyjnego przy 10 FTE — podobnie jak receiving, niska absolutna dźwignia; niezwalidowany kandydat drugiej fali, ocena po fazie 1 pickingu.',
        impact: 'low',
        effort: 'high',
        category: 'shipping',
        zone: 'shipping',
        processFirst: false,
        evidence: [],
      },
      {
        id: 'move-packing-standard',
        title: 'Standaryzacja opakowań w packing',
        description:
          '20% czasu nieprodukcyjnego przy 12 FTE — brak dziś wystarczającego wolumenu standaryzowanych opakowań, aby uzasadnić automatyczną stację pakującą. Niezwalidowany kandydat drugiej fali.',
        impact: 'low',
        effort: 'high',
        category: 'packing',
        zone: 'packing',
        processFirst: true,
        evidence: [],
      },
    ] as unknown as OperationalToolData['sections']['moves'],
  },
};
