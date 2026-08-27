export const METALPOL_IDS = Object.freeze({
  organization: 'demo-metalpol-org',
  user: 'demo-metalpol-user-akowalczyk',
  project: 'demo-metalpol-project',
  session: 'demo-metalpol-session',
  snapshot: 'demo-metalpol-snapshot',
  output: 'demo-metalpol-output-v1',
});

export const METALPOL_CLIENT = Object.freeze({
  name: 'Metalpol Sp. z o.o.',
  site: 'Zakład Ostrów Wielkopolski',
  headcount: 214,
  industry: 'Obróbka i przetwórstwo metali · komponenty dla motoryzacji',
  assessor: 'Anna Kowalczyk',
  sponsor: 'Marek Zieliński, Dyrektor Operacyjny',
  period: '4–21 sierpnia 2026',
  issued: '26 sierpnia 2026',
  methodVersion: 'Digital Pathfinder · pakiet metodyczny 2026.2',
  sessionRef: 'DRD-2026-0817-MTP',
});

export type EvidenceClass = 'evidenced' | 'incomplete' | 'declared';

export type MetalpolDrdArea = Readonly<{
  axisId: number;
  unitId: string;
  namePL: string;
  currentLevel: number;
  targetLevel: number;
  evidenceClass: EvidenceClass;
}>;

export const METALPOL_DRD_AREAS: readonly MetalpolDrdArea[] = Object.freeze([
  {
    axisId: 1,
    unitId: '1A',
    namePL: 'Procesy Sprzedaży',
    currentLevel: 3,
    targetLevel: 5,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 1,
    unitId: '1E',
    namePL: 'Procesy Logistyczne',
    currentLevel: 2,
    targetLevel: 4,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 1,
    unitId: '1F',
    namePL: 'Procesy Produkcyjne',
    currentLevel: 4,
    targetLevel: 6,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 1,
    unitId: '1G',
    namePL: 'Procesy Jakości',
    currentLevel: 2,
    targetLevel: 3,
    evidenceClass: 'incomplete',
  },
  {
    axisId: 2,
    unitId: '2A',
    namePL: 'Produkty Cyfrowe',
    currentLevel: 1,
    targetLevel: 3,
    evidenceClass: 'declared',
  },
  {
    axisId: 2,
    unitId: '2D',
    namePL: 'Dopasowanie Produktu do Oczekiwań Klienta',
    currentLevel: 2,
    targetLevel: 4,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 2,
    unitId: '2E',
    namePL: 'Skalowalność Produktu',
    currentLevel: 2,
    targetLevel: 3,
    evidenceClass: 'declared',
  },
  {
    axisId: 3,
    unitId: '3A',
    namePL: 'Modele E-commerce',
    currentLevel: 2,
    targetLevel: 4,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 3,
    unitId: '3C',
    namePL: 'Model As-a-Service',
    currentLevel: 1,
    targetLevel: 2,
    evidenceClass: 'declared',
  },
  {
    axisId: 3,
    unitId: '3E',
    namePL: 'Modele Monetyzacji Danych',
    currentLevel: 1,
    targetLevel: 3,
    evidenceClass: 'incomplete',
  },
  {
    axisId: 4,
    unitId: '4A',
    namePL: 'Zbieranie Danych',
    currentLevel: 4,
    targetLevel: 6,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 4,
    unitId: '4B',
    namePL: 'Metodologia Przechowywania Danych',
    currentLevel: 2,
    targetLevel: 5,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 4,
    unitId: '4C',
    namePL: 'Komunikacja Danych',
    currentLevel: 3,
    targetLevel: 5,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 4,
    unitId: '4D',
    namePL: 'Analiza Big Data',
    currentLevel: 2,
    targetLevel: 4,
    evidenceClass: 'incomplete',
  },
  {
    axisId: 5,
    unitId: '5A',
    namePL: 'Postawy przywódcze',
    currentLevel: 4,
    targetLevel: 5,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 5,
    unitId: '5B',
    namePL: 'Gotowość na zmianę',
    currentLevel: 3,
    targetLevel: 5,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 5,
    unitId: '5C',
    namePL: 'Ciągły rozwój kompetencji',
    currentLevel: 2,
    targetLevel: 4,
    evidenceClass: 'declared',
  },
  {
    axisId: 6,
    unitId: '6A',
    namePL: 'Strategia i zarządzanie ryzykiem',
    currentLevel: 2,
    targetLevel: 5,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 6,
    unitId: '6C',
    namePL: 'Ochrona danych',
    currentLevel: 3,
    targetLevel: 5,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 6,
    unitId: '6E',
    namePL: 'Plany awaryjne',
    currentLevel: 1,
    targetLevel: 4,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 7,
    unitId: '7A',
    namePL: 'Dane i Fundamenty AI',
    currentLevel: 2,
    targetLevel: 4,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 7,
    unitId: '7B',
    namePL: 'Procesy Wspierane przez AI',
    currentLevel: 1,
    targetLevel: 3,
    evidenceClass: 'declared',
  },
  {
    axisId: 7,
    unitId: '7E',
    namePL: 'Kompetencje i Kultura AI',
    currentLevel: 1,
    targetLevel: 3,
    evidenceClass: 'declared',
  },
]);

export const EXPECTED_RADAR = Object.freeze({
  1: { currentLevel: 39, targetLevel: 64 },
  2: { currentLevel: 33, targetLevel: 67 },
  3: { currentLevel: 27, targetLevel: 60 },
  4: { currentLevel: 39, targetLevel: 71 },
  5: { currentLevel: 50, targetLevel: 78 },
  6: { currentLevel: 33, targetLevel: 78 },
  7: { currentLevel: 27, targetLevel: 67 },
} as const);

export type SkipCode =
  | 'poza_modelem_operacyjnym'
  | 'poza_zakresem_zlecenia'
  | 'odroczone_do_kolejnej_rewizji'
  | 'zastapione_innym_rozwiazaniem';

export type MetalpolSkipDecision = Readonly<{
  unitId: string;
  level: number;
  questionId: string;
  skipCode: SkipCode;
}>;

function levels(unitId: string, count: number, skipCode: SkipCode): MetalpolSkipDecision[] {
  return Array.from({ length: count }, (_, index) => ({
    unitId,
    level: index + 1,
    questionId: `${unitId}-L${index + 1}`,
    skipCode,
  }));
}

export const METALPOL_SKIP_DECISIONS: readonly MetalpolSkipDecision[] = Object.freeze([
  ...levels('1B', 7, 'poza_zakresem_zlecenia'),
  ...levels('3B', 5, 'poza_modelem_operacyjnym'),
  ...levels('6B', 6, 'zastapione_innym_rozwiazaniem'),
  ...levels('4E', 2, 'odroczone_do_kolejnej_rewizji'),
  { unitId: '7C', level: 1, questionId: '7C-L1', skipCode: 'odroczone_do_kolejnej_rewizji' },
  { unitId: '5D', level: 1, questionId: '5D-L1', skipCode: 'poza_zakresem_zlecenia' },
  { unitId: '5D', level: 2, questionId: '5D-L2', skipCode: 'poza_modelem_operacyjnym' },
]);
