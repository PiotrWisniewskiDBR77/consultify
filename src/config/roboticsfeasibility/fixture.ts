/**
 * Robotics Feasibility — worked-example fixture.
 *
 * Sourced from the doctrine's §7 worked example (Harvard/wdrozenie-100/
 * _TOOLS_DOKTRYNA/robotics-feasibility.md): mid-size industrial-components
 * manufacturer, 2 shifts / 5 days-week, end-of-assembly-line station.
 *
 * Operation 1 — pakowanie + paletyzacja (cobot, shared space). Technical gate
 * passes with a caveat (moderate grip — 6 carton variants). Economic gate:
 * CAPEX 280 000 hardware + 30% integration = 364 000 PLN; corrected annual net
 * saving 115 000 PLN/rok (90k redukcja 2 FTE + 28k rotacja + 12k ergonomia -
 * 15k nowy OPEX robota) → payback ~38 miesięcy, powyżej progu 36 mies., ale
 * strategiczny argument (chroniczna rotacja, ryzyko BHP) uzasadnia PILOT na
 * jednej zmianie (doktryna §7, Krok 3).
 *
 * Operation 2 — QC montażu (cobot + vision, drugi kandydat tej samej linii).
 * Technical gate czysta (wysoka powtarzalność/ustrukturyzowanie/chwyt).
 * CAPEX 220 000 hardware + 25% integracja + 8 000 bezpieczeństwo = 283 000 PLN;
 * annual net saving 135 500 PLN/rok (142,5k redukcja 1,5 FTE + 5k rotacja -
 * 12k OPEX) → payback ~25 miesięcy, w progu 36 mies., wolumen rosnący,
 * zmienność niska → GO.
 *
 * Used as: (a) the `toRoboticsSession` self-test fixture, (b) a seed/demo
 * session for the tool, (c) a reference for QA/DoD screenshots.
 */

import type { OperationalToolData } from '@/store/useToolStore';

export const ROBOTICS_FIXTURE: OperationalToolData = {
  context: {
    goal:
      'Ocenić feasibility robotyzacji stanowiska końca linii montażowej — czy TA operacja, w TYM wolumenie i przy TEJ zmienności, da zwrot z inwestycji, zanim wydamy budżet na RFP do integratorów',
    scope:
      'Producent komponentów przemysłowych, 2 zmiany, 5 dni/tydzień; stanowisko końca linii montażowej: pakowanie+paletyzacja gotowych zestawów oraz kontrola jakości (QC) montażu',
    timeframe: 'medium',
    successSignal:
      'Policzalny business case (payback w miesiącach, z jawną linią integracji) do obrony przed zarządem, plus jasny werdykt go/pilot/hybryda/no-go per operacja',
    assumptions:
      'Koszt pracy w pełni obciążony jednolity per stanowisko; integracja budżetowana jako 20-40% ceny hardware\'u (tu 25-30%); próg decyzyjny payback 36 miesięcy bez argumentu strategicznego',
    constraints:
      'Bramka techniczna PRZED ekonomiczną — nie liczymy ROI operacji, która nie przeszła progu powtarzalność/środowisko/chwyt; reżim cobota wymaga procedury re-oceny bezpieczeństwa przy zmianie wariantu',
  },
  sections: {
    operations: [
      {
        id: 'op-packing-palletizing',
        title: 'Pakowanie i paletyzacja (koniec linii montażowej)',
        description:
          '2 operatorów/zmianę, wysoka rotacja (stanowisko monotonne, podnoszenie 4-8 kg). 6 wariantów kartonu, zmiana ~4x dziennie. Reżim cobota (współdzielona przestrzeń ze stacją paletyzacji).',
        impact: 'high',
        effort: 'medium',
        category: 'packing',
        label: 'Pakowanie i paletyzacja',
        repeatability: 'high',
        structuredEnv: 'high',
        gripSolvability: 'medium',
        processStable: true,
        shifts: 2,
        fteReduced: 2,
        annualCostPerFte: 45_000,
        cycleTimeManualSec: 42,
        cycleTimeRobotSec: 30,
        annualVolume: 210_000,
        hardwareCost: 280_000,
        safetyCost: 0,
        integrationOverhead: 0.3,
        robotOpexAnnual: 15_000,
        turnoverSavingAnnual: 28_000,
        ergonomicsSavingAnnual: 12_000,
        volumeTrend: 'stable',
        variability: 'medium',
        topVariantShare: 0.7,
        safetyRegime: 'cobot',
        strategicPressure: 'high',
        measured: true,
      },
      {
        id: 'op-qc-assembly',
        title: 'Kontrola jakości (QC) montażu',
        description:
          'Wizyjna inspekcja zestawów po montażu, obecnie ręczna, wykwalifikowany operator QC. Ustrukturyzowana pozycja detalu na przenośniku, jeden dominujący typ operacji, wolumen rosnący.',
        impact: 'high',
        effort: 'low',
        category: 'quality-control',
        label: 'QC montażu',
        repeatability: 'high',
        structuredEnv: 'high',
        gripSolvability: 'high',
        processStable: true,
        shifts: 2,
        fteReduced: 1.5,
        annualCostPerFte: 95_000,
        cycleTimeManualSec: 28,
        cycleTimeRobotSec: 20,
        annualVolume: 260_000,
        hardwareCost: 220_000,
        safetyCost: 8_000,
        integrationOverhead: 0.25,
        robotOpexAnnual: 12_000,
        turnoverSavingAnnual: 5_000,
        ergonomicsSavingAnnual: 0,
        volumeTrend: 'rising',
        variability: 'low',
        topVariantShare: 1,
        safetyRegime: 'cobot',
        strategicPressure: 'low',
        measured: true,
      },
    ] as unknown as OperationalToolData['sections']['operations'],
    moves: [
      {
        id: 'move-packing-pilot',
        title: 'Pilot na jednej zmianie — pakowanie + paletyzacja',
        description:
          'Payback ~38 miesięcy przekracza próg 36 mies. na czystej redukcji etatów, ale chroniczna rotacja i ryzyko ergonomiczne uzasadniają PILOT zamiast pełnego wdrożenia obu zmian naraz.',
        impact: 'high',
        effort: 'medium',
        category: 'packing',
        operationId: 'op-packing-palletizing',
        verdict: 'pilot',
        rationale:
          'Bramka techniczna zaliczona (z zastrzeżeniem na chwytak wielopozycyjny), payback 38 mies. ponad progiem, argument strategiczny (rotacja, BHP) uzasadnia zdobycie twardych danych przed pełnym CAPEX.',
        tradeOff: 'Wolniejszy start na drugiej zmianie w zamian za twarde dane o cycle time i niezawodności chwytu na pełnym miksie 6 wariantów przed podpisaniem RFP na obie zmiany.',
        rejectedVariant: 'Odrzucamy pełne wdrożenie na 2 zmianach od razu — payback ponad progiem bez pilotażowej walidacji to zakład, nie decyzja.',
      },
      {
        id: 'move-packing-safety-line',
        title: 'Wydzielić integrację i procedurę re-oceny bezpieczeństwa jako jawne linie',
        description:
          'CAPEX musi mieć osobną linię integracji (30% hardware\'u) i wbudowaną procedurę re-oceny zgodności (ISO 10218:2025) przy każdej z ~4 dziennych zmian wariantu kartonu.',
        impact: 'medium',
        effort: 'low',
        category: 'packing',
        operationId: 'op-packing-palletizing',
        verdict: 'pilot',
        rationale: 'Integracja niedoszacowana systematycznie wydłuża realny payback 1,5-2x; reżim cobota + zmiana wariantu 4x dziennie wymaga POWTARZALNEJ oceny zgodności, nie jednorazowego certyfikatu.',
        tradeOff: 'Wyższy, ale prawdziwy CAPEX na papierze w zamian za business case, który przetrwa po podpisaniu kontraktu z integratorem.',
        rejectedVariant: 'Odrzucamy kalkulację z ceny katalogowej cobota bez jawnej linii integracji/bezpieczeństwa.',
      },
      {
        id: 'move-qc-go',
        title: 'Pełne wdrożenie — QC montażu',
        description:
          'Bramka techniczna czysta (powtarzalność/środowisko/chwyt wysokie), payback ~25 miesięcy w progu, wolumen rosnący, zmienność niska — silny kandydat GO, priorytet przed pakowaniem.',
        impact: 'high',
        effort: 'low',
        category: 'quality-control',
        operationId: 'op-qc-assembly',
        verdict: 'go',
        rationale: 'Payback 25 mies. w progu 36 mies., bramka techniczna bez zastrzeżeń, wolumen rosnący — case broni się bez argumentu strategicznego.',
        tradeOff: 'Budżet i inżynieria skoncentrowane na QC jako pierwszym dowodzie wartości, kosztem tempa na stanowisku pakowania.',
        rejectedVariant: 'Odrzucamy równoległe uruchomienie obu operacji naraz — brak skończonego pierwszego wdrożenia nie daje zespołowi wzorca utrzymania.',
      },
    ] as unknown as OperationalToolData['sections']['moves'],
  },
};
