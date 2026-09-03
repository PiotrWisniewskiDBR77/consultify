import DRD_STRUCTURE from '../../data/drdStructure.js';
import type { MethodSession } from '../../method-core/contracts/index.js';
import type { EvidenceStrength } from '../../method-core/contracts/events.js';
import type { AreaScores } from './drdReportModel.js';

export type EvidenceLabel = 'Brak dowodu' | 'Deklarowany' | 'Niepełny' | 'Potwierdzony';

export function evidenceLabelForStrength(strength: EvidenceStrength): EvidenceLabel {
  if (strength === 'E0') return 'Brak dowodu';
  if (strength === 'E1') return 'Deklarowany';
  if (strength === 'E2') return 'Niepełny';
  return 'Potwierdzony';
}

export interface AcceptedReportMeta {
  klient: string;
  klientOpis: string;
  tytul: string;
  metodyka: string;
  wersja: string;
  dataRaportu: string;
  okresBadania: string;
  zespolDoradczy: string[][];
  zespolKlienta: string[][];
  kalendarz: string[][];
  benchmark: string;
  zakres?: string;
  wylaczenia?: string[];
}

export interface AcceptedAxisContent {
  nr: number;
  nazwa: string;
  skala: number;
  obszary: number;
  asIs: number;
  toBe: number;
  procent: number;
  werdykt: string;
  zakres: string;
  pytania: string[];
  odpowiedzi: string[];
  dowody: string[][];
  tabelaObszarow: Array<Array<string | number>>;
  wnioski: string[];
  rekomendacje: string[][];
  sufit: string;
  liniaDecyzyjna: string[];
}

export interface AcceptedDrdReportModel {
  META: AcceptedReportMeta;
  WYNIK_OGOLNY: { procent: number; benchmark: number };
  OSIE: AcceptedAxisContent[];
  WNIOSKI_PRZEKROJOWE: Array<{ id: string; tytul: string; tresc: string }>;
  MAPA_DROGOWA: Array<{
    fala: string;
    horyzont: string;
    opis: string;
    pozycje: string[][];
  }>;
  KOLEJNY_KROK: string[][];
  GRANICE: string[];
}

export interface AcceptedDrdReportSource extends AcceptedDrdReportModel {
  session: Pick<
    MethodSession,
    'id' | 'organizationId' | 'methodPackId' | 'methodPackVersion' | 'state' | 'version'
  >;
  areaScores: AreaScores;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const round1 = (value: number) => Math.round(value * 10) / 10;

function preciseAxisScore(axisId: number, areaScores: AreaScores) {
  const axis = DRD_STRUCTURE.find((candidate) => candidate.id === axisId);
  if (!axis) return { actual: 0, target: 0 };
  const values = axis.areas.map((area) => areaScores[area.id]).filter(Boolean);
  if (values.length === 0) return { actual: 0, target: 0 };
  return {
    actual: values.reduce((sum, value) => sum + Number(value.actual), 0) / values.length,
    target: values.reduce((sum, value) => sum + Number(value.target), 0) / values.length,
  };
}

/**
 * Builds the exact content model consumed by the accepted prototype layout.
 * Narrative and study metadata must already belong to the frozen session
 * source; this function never invents them. Numeric axis results are always
 * recalculated from the 39 area scores and the native 7/5/5/7/6/6/5 scales.
 */
export function buildAcceptedDrdReportModel(
  source: AcceptedDrdReportSource
): AcceptedDrdReportModel {
  if (source.session.methodPackId !== 'drd') {
    throw new Error('accepted DRD report requires a DRD MethodSession');
  }
  if (source.OSIE.length !== DRD_STRUCTURE.length) {
    throw new Error(`accepted DRD report requires ${DRD_STRUCTURE.length} axes`);
  }

  const axes = DRD_STRUCTURE.map((axis) => {
    const supplied = source.OSIE.find((item) => item.nr === axis.id);
    if (!supplied) throw new Error(`missing report content for DRD axis ${axis.id}`);
    const score = preciseAxisScore(axis.id, source.areaScores);
    return {
      ...supplied,
      nr: axis.id,
      nazwa: axis.namePL || axis.name,
      skala: axis.levelCount,
      obszary: axis.areas.length,
      asIs: round2(score.actual),
      toBe: round2(score.target),
      procent: round1((score.actual / axis.levelCount) * 100),
    };
  });

  const overallPercent = round1(
    axes.reduce((sum, axis) => sum + axis.procent, 0) / Math.max(1, axes.length)
  );

  return {
    META: source.META,
    WYNIK_OGOLNY: { ...source.WYNIK_OGOLNY, procent: overallPercent },
    OSIE: axes,
    WNIOSKI_PRZEKROJOWE: source.WNIOSKI_PRZEKROJOWE,
    MAPA_DROGOWA: source.MAPA_DROGOWA,
    KOLEJNY_KROK: source.KOLEJNY_KROK,
    GRANICE: source.GRANICE,
  };
}
