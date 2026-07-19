/**
 * SIRI Knowledge Base
 *
 * Source of truth for SIRI (Smart Industry Readiness Index) assessment:
 * - 3 yes/no questions per dimension/level
 * - Example per dimension/level
 * - Suggested technologies per dimension/level
 *
 * Structure: 3 Building Blocks, 8 Dimensions, Scale 0-5
 */
import {
  SIRI_BUILDING_BLOCKS,
  SIRI_DIMENSIONS,
  SIRI_MATURITY_LEVELS,
  SIRIDimension,
} from '@/services/siriStructure';

export type SIRILevelKnowledge = {
  questions: [string, string, string];
  example: string;
  suggestedTechnologies: string[];
  evidenceGuidance: string;
  commonMistakes: string[];
  levelMeaning: string;
};

export type SIRIDimensionLevelKey = `${string}#${number}`; // e.g. "operations#3"

// ============================================
// TECHNOLOGY SUGGESTIONS PER DIMENSION
// ============================================

const DIMENSION_TECH: Record<string, Record<number, string[]>> = {
  operations: {
    0: ['Process Documentation', 'Standard Operating Procedures (SOP)'],
    1: ['Basic MES', 'Production Planning Spreadsheets', 'Work Instructions'],
    2: ['MES', 'OEE Dashboard', 'Quality Management System (QMS)'],
    3: ['MES with ERP Integration', 'Real-time Production Monitoring', 'Digital Andon'],
    4: ['AI-driven Production Scheduling', 'Predictive Quality Analytics', 'Digital Twin'],
    5: ['Autonomous Production Control', 'Self-optimizing MES', 'Cognitive Manufacturing'],
  },
  supply_chain: {
    0: ['Manual Procurement', 'Spreadsheet Tracking'],
    1: ['Basic ERP', 'Order Management System', 'Supplier Database'],
    2: ['EDI Integration', 'Warehouse Management System (WMS)', 'Demand Planning'],
    3: ['End-to-end SCM Platform', 'Track & Trace', 'Supplier Portal'],
    4: ['AI Demand Forecasting', 'Control Tower', 'Autonomous Procurement'],
    5: ['Self-orchestrating Supply Chain', 'Blockchain Traceability', 'Cognitive Logistics'],
  },
  product_lifecycle: {
    0: ['Paper-based Documentation', 'Local File Storage'],
    1: ['Basic CAD', 'Document Management', 'Version Control'],
    2: ['PLM/PDM', 'CAD/CAM Integration', 'BOM Management'],
    3: ['Integrated PLM', 'Digital Mock-up', 'Simulation & Testing'],
    4: ['Digital Twin (Product)', 'Model-Based Systems Engineering', 'Generative Design'],
    5: [
      'AI-driven Product Innovation',
      'Autonomous Design Optimization',
      'Smart Connected Products',
    ],
  },
  automation: {
    0: ['Manual Operations', 'Hand Tools'],
    1: ['Basic CNC/PLC', 'Semi-automated Machines', 'Conveyor Systems'],
    2: ['Industrial Robots', 'SCADA', 'Automated Material Handling'],
    3: ['Flexible Manufacturing Cells', 'Cobots', 'AGV/AMR'],
    4: ['AI-guided Robots', 'Adaptive Manufacturing', 'Predictive Maintenance'],
    5: ['Fully Autonomous Production', 'Self-configuring Cells', 'Lights-out Manufacturing'],
  },
  connectivity: {
    0: ['Isolated Systems', 'Air-gapped Networks'],
    1: ['Basic LAN/WiFi', 'Email Communication', 'Shared Drives'],
    2: ['IIoT Sensors', 'Edge Computing', 'Machine Connectivity'],
    3: ['IT/OT Convergence', 'Cloud Platform', 'API-first Architecture'],
    4: ['5G/Private Networks', 'Digital Thread', 'Real-time Streaming'],
    5: ['Mesh Networks', 'Autonomous Edge Intelligence', 'Universal Connectivity'],
  },
  intelligence: {
    0: ['No Analytics', 'Manual Reporting'],
    1: ['Basic Reports', 'Spreadsheet Analytics', 'Static Dashboards'],
    2: ['BI Platform', 'Data Warehouse', 'Descriptive Analytics'],
    3: ['Predictive Analytics', 'Machine Learning Models', 'Data Lake'],
    4: ['AI/ML at Scale', 'Prescriptive Analytics', 'Real-time Decision Support'],
    5: ['Autonomous AI Decision-making', 'Self-learning Systems', 'Cognitive Analytics'],
  },
  talent_readiness: {
    0: ['No Training Program', 'Ad-hoc Learning'],
    1: ['Basic Training Plan', 'Onboarding Program', 'Skills Inventory'],
    2: ['LMS (Learning Management System)', 'Digital Skills Assessment', 'E-learning'],
    3: ['Competency Framework', 'Digital Academy', 'Cross-functional Development'],
    4: ['AI-personalized Learning', 'VR/AR Training', 'Skills Analytics'],
    5: ['Self-directed Learning Culture', 'Knowledge Marketplace', 'Innovation Labs'],
  },
  structure_management: {
    0: ['Traditional Hierarchy', 'Manual Governance'],
    1: ['Basic Digital Strategy', 'Initial Governance Framework', 'Steering Committee'],
    2: ['Digital Transformation Office', 'KPI Dashboard', 'Change Management'],
    3: ['Agile Organization', 'Data Governance', 'Innovation Management'],
    4: ['Platform Organization', 'AI Governance', 'Ecosystem Management'],
    5: ['Adaptive Organization', 'Self-organizing Teams', 'Autonomous Decision-making'],
  },
};

// ============================================
// LEVEL MEANINGS
// ============================================

export const SIRI_LEVEL_MEANINGS: Record<
  number,
  { title: string; meaning: string; evidencePattern: string }
> = {
  0: {
    title: 'Not Started',
    meaning:
      'No formal approach exists. Processes are ad-hoc, undocumented, or non-existent. There is no awareness of Industry 4.0 in this dimension.',
    evidencePattern: 'Absence of documentation, no KPIs, manual/paper-based workflows only.',
  },
  1: {
    title: 'Defined',
    meaning:
      'Basic processes are documented and understood. Initial standardization exists but execution is inconsistent. Isolated digital tools may be in use.',
    evidencePattern:
      'SOPs or process maps exist; basic tools (spreadsheets, standalone software) are used; training materials available.',
  },
  2: {
    title: 'Digital',
    meaning:
      'Core processes are digitized with basic monitoring. Automation handles routine tasks. Data is collected but analysis is limited to descriptive reporting.',
    evidencePattern:
      'Digital systems in daily use (MES, ERP, CRM); dashboards showing KPIs; automated workflows for repetitive tasks.',
  },
  3: {
    title: 'Integrated',
    meaning:
      'Systems are integrated across functions. Real-time data flows between departments. Decision-making uses data analytics. Cross-functional collaboration is standard.',
    evidencePattern:
      'Integrated platforms (ERP-MES-CRM); real-time dashboards; documented data flows between systems; cross-team digital processes.',
  },
  4: {
    title: 'Automated',
    meaning:
      'Advanced automation with predictive analytics. AI assists decisions. Processes self-adjust based on data. Proactive rather than reactive operations.',
    evidencePattern:
      'AI/ML models in production; predictive maintenance active; automated decision support; measurable ROI from digital initiatives.',
  },
  5: {
    title: 'Intelligent',
    meaning:
      'Self-optimizing systems operate autonomously. Continuous innovation is embedded. The organization leads industry transformation and creates new digital value.',
    evidencePattern:
      'Autonomous operations; self-learning systems; innovation pipeline documented; industry benchmarks exceeded; digital revenue streams.',
  },
};

/**
 * PL counterpart of SIRI_LEVEL_MEANINGS (OXFORD O8 — SIRI/ADMA parity with DRD,
 * which has always shipped PL as the default). Mirrors the EN meanings 1:1, HBS-
 * consultant tone, plain language, no filler.
 */
export const SIRI_LEVEL_MEANINGS_PL: Record<
  number,
  { title: string; meaning: string; evidencePattern: string }
> = {
  0: {
    title: 'Nierozpoczęty',
    meaning:
      'Brak jakiegokolwiek sformalizowanego podejścia. Procesy są doraźne, nieudokumentowane albo nie istnieją. Brak świadomości Przemysłu 4.0 w tym wymiarze.',
    evidencePattern: 'Brak dokumentacji, brak KPI, wyłącznie ręczne/papierowe procesy pracy.',
  },
  1: {
    title: 'Zdefiniowany',
    meaning:
      'Podstawowe procesy są udokumentowane i zrozumiałe. Istnieje wstępna standaryzacja, ale wykonanie jest niespójne. Mogą występować pojedyncze, izolowane narzędzia cyfrowe.',
    evidencePattern:
      'Istnieją SOP-y lub mapy procesów; używane są podstawowe narzędzia (arkusze, samodzielne oprogramowanie); dostępne materiały szkoleniowe.',
  },
  2: {
    title: 'Cyfrowy',
    meaning:
      'Kluczowe procesy są ucyfrowione z podstawowym monitoringiem. Automatyzacja obsługuje rutynowe zadania. Dane są zbierane, ale analiza ogranicza się do raportowania opisowego.',
    evidencePattern:
      'Systemy cyfrowe w codziennym użyciu (MES, ERP, CRM); dashboardy pokazujące KPI; zautomatyzowane przepływy dla zadań powtarzalnych.',
  },
  3: {
    title: 'Zintegrowany',
    meaning:
      'Systemy są zintegrowane między funkcjami. Dane przepływają w czasie rzeczywistym między działami. Decyzje opierają się na analityce danych. Współpraca międzyfunkcyjna jest standardem.',
    evidencePattern:
      'Zintegrowane platformy (ERP-MES-CRM); dashboardy czasu rzeczywistego; udokumentowane przepływy danych między systemami; procesy cyfrowe obejmujące zespoły.',
  },
  4: {
    title: 'Zautomatyzowany',
    meaning:
      'Zaawansowana automatyzacja z analityką predykcyjną. AI wspiera decyzje. Procesy same się dostrajają na podstawie danych. Działania proaktywne zamiast reaktywnych.',
    evidencePattern:
      'Modele AI/ML w produkcyjnym użyciu; aktywne utrzymanie predykcyjne; zautomatyzowane wsparcie decyzji; mierzalny zwrot z inwestycji cyfrowych.',
  },
  5: {
    title: 'Inteligentny',
    meaning:
      'Samo-optymalizujące się systemy działają autonomicznie. Ciągła innowacja jest częścią codzienności. Organizacja prowadzi transformację branży i tworzy nową wartość cyfrową.',
    evidencePattern:
      'Autonomiczne operacje; systemy samo-uczące się; udokumentowany pipeline innowacji; wyniki przewyższające benchmarki branżowe; cyfrowe strumienie przychodu.',
  },
};

// ============================================
// EVIDENCE GUIDANCE PER DIMENSION
// ============================================

const DIMENSION_EVIDENCE_GUIDANCE: Record<string, Record<number, string>> = {
  operations: {
    0: 'Look for absence of production tracking systems. Are work orders paper-based?',
    1: 'Check for documented SOPs and basic production planning tools (even spreadsheets count).',
    2: 'Verify MES or equivalent is actively used. Are OEE metrics tracked digitally?',
    3: 'Confirm ERP-MES integration exists. Can production data flow to business planning in real-time?',
    4: 'Look for AI-driven scheduling or predictive quality systems. Are decisions automated?',
    5: 'Verify autonomous production control. Do systems self-optimize without human intervention?',
  },
  supply_chain: {
    0: 'Confirm procurement and logistics are manual (phone, email, paper POs).',
    1: 'Check for basic ERP modules for purchasing. Is there a supplier database?',
    2: 'Verify EDI or e-procurement is active. Is warehouse management digitized?',
    3: 'Look for end-to-end supply chain visibility platform. Can you track orders across tiers?',
    4: 'Check for AI-powered demand forecasting or autonomous procurement triggers.',
    5: 'Verify self-orchestrating supply chain with blockchain traceability and autonomous routing.',
  },
  product_lifecycle: {
    0: 'Are product designs stored locally or on paper? No version control?',
    1: 'Check for basic CAD usage and document management systems.',
    2: 'Verify PLM/PDM system is in use with CAD integration and BOM management.',
    3: 'Look for integrated PLM with simulation capabilities and digital mock-ups.',
    4: 'Check for digital twin of products and model-based systems engineering.',
    5: 'Verify AI-driven product innovation with autonomous design optimization.',
  },
  automation: {
    0: 'Confirm operations are fully manual with hand tools only.',
    1: 'Check for basic CNC or PLC machines. Any semi-automated processes?',
    2: 'Look for industrial robots, SCADA systems, and automated material handling.',
    3: 'Verify flexible manufacturing cells, cobots, and AGV/AMR deployments.',
    4: 'Check for AI-guided robotics and predictive maintenance systems.',
    5: 'Look for fully autonomous production lines (lights-out manufacturing capability).',
  },
  connectivity: {
    0: 'Confirm systems are isolated with no network connectivity between machines.',
    1: 'Check for basic LAN/WiFi and shared drives. Any machine connectivity?',
    2: 'Verify IIoT sensors are deployed. Is edge computing in use?',
    3: 'Look for IT/OT convergence. Is there a cloud platform with API-first architecture?',
    4: 'Check for 5G/private networks and digital thread implementation.',
    5: 'Verify mesh networks with autonomous edge intelligence across all systems.',
  },
  intelligence: {
    0: 'Confirm there is no analytics capability. All reporting is manual.',
    1: 'Check for basic reporting (spreadsheets, static dashboards).',
    2: 'Verify BI platform or data warehouse with descriptive analytics.',
    3: 'Look for predictive analytics and ML models in active use.',
    4: 'Check for AI/ML at scale with prescriptive analytics and real-time decision support.',
    5: 'Verify autonomous AI decision-making with self-learning systems.',
  },
  talent_readiness: {
    0: 'Confirm no digital training program exists. Learning is ad-hoc.',
    1: 'Check for basic training plans and skills inventory.',
    2: 'Verify LMS is in use. Are digital skills formally assessed?',
    3: 'Look for a competency framework and digital academy program.',
    4: 'Check for AI-personalized learning paths and VR/AR training tools.',
    5: 'Verify self-directed learning culture with knowledge marketplace.',
  },
  structure_management: {
    0: 'Confirm traditional hierarchy with no digital governance.',
    1: 'Check for basic digital strategy document and initial governance framework.',
    2: 'Verify Digital Transformation Office exists with KPI dashboards.',
    3: 'Look for agile organization structure with data governance and innovation management.',
    4: 'Check for platform organization model and AI governance framework.',
    5: 'Verify adaptive organization with self-organizing teams.',
  },
};

const DIMENSION_EVIDENCE_GUIDANCE_PL: Record<string, Record<number, string>> = {
  operations: {
    0: 'Sprawdź brak systemów śledzenia produkcji. Czy zlecenia produkcyjne są papierowe?',
    1: 'Zweryfikuj udokumentowane SOP-y i podstawowe narzędzia planowania produkcji (liczy się nawet arkusz kalkulacyjny).',
    2: 'Potwierdź, że MES lub odpowiednik jest realnie używany. Czy metryki OEE są śledzone cyfrowo?',
    3: 'Potwierdź integrację ERP-MES. Czy dane produkcyjne płyną do planowania biznesowego w czasie rzeczywistym?',
    4: 'Sprawdź harmonogramowanie sterowane AI lub predykcyjne systemy jakości. Czy decyzje są zautomatyzowane?',
    5: 'Zweryfikuj autonomiczne sterowanie produkcją. Czy systemy same się optymalizują bez udziału człowieka?',
  },
  supply_chain: {
    0: 'Potwierdź, że zakupy i logistyka są ręczne (telefon, e-mail, papierowe zamówienia).',
    1: 'Sprawdź podstawowe moduły ERP do zakupów. Czy istnieje baza dostawców?',
    2: 'Zweryfikuj aktywne EDI lub e-zaopatrzenie. Czy magazyn jest ucyfrowiony?',
    3: 'Sprawdź platformę end-to-end widoczności łańcucha dostaw. Czy można śledzić zamówienia między warstwami?',
    4: 'Sprawdź prognozowanie popytu oparte na AI lub autonomiczne wyzwalacze zaopatrzenia.',
    5: 'Zweryfikuj samo-organizujący się łańcuch dostaw z traceability blockchain i autonomicznym trasowaniem.',
  },
  product_lifecycle: {
    0: 'Czy projekty produktów są przechowywane lokalnie lub na papierze? Brak kontroli wersji?',
    1: 'Sprawdź podstawowe użycie CAD i systemy zarządzania dokumentami.',
    2: 'Zweryfikuj system PLM/PDM z integracją CAD i zarządzaniem BOM.',
    3: 'Sprawdź zintegrowany PLM z możliwościami symulacji i cyfrowymi makietami.',
    4: 'Sprawdź cyfrowego bliźniaka produktu i inżynierię systemów opartą na modelu.',
    5: 'Zweryfikuj innowację produktową sterowaną AI z autonomiczną optymalizacją projektu.',
  },
  automation: {
    0: 'Potwierdź, że operacje są w pełni ręczne, wyłącznie narzędzia ręczne.',
    1: 'Sprawdź podstawowe maszyny CNC lub PLC. Czy są jakiekolwiek procesy półautomatyczne?',
    2: 'Sprawdź roboty przemysłowe, systemy SCADA i zautomatyzowany transport materiałów.',
    3: 'Zweryfikuj elastyczne komórki produkcyjne, koboty i wdrożenia AGV/AMR.',
    4: 'Sprawdź roboty sterowane AI i systemy utrzymania predykcyjnego.',
    5: 'Sprawdź w pełni autonomiczne linie produkcyjne (zdolność do produkcji „lights-out").',
  },
  connectivity: {
    0: 'Potwierdź, że systemy są izolowane, brak łączności sieciowej między maszynami.',
    1: 'Sprawdź podstawowe LAN/WiFi i wspólne dyski. Czy istnieje jakakolwiek łączność maszyn?',
    2: 'Zweryfikuj wdrożone czujniki IIoT. Czy edge computing jest w użyciu?',
    3: 'Sprawdź konwergencję IT/OT. Czy istnieje platforma chmurowa z architekturą API-first?',
    4: 'Sprawdź sieci 5G/prywatne i wdrożenie digital thread.',
    5: 'Zweryfikuj sieci mesh z autonomiczną inteligencją brzegową we wszystkich systemach.',
  },
  intelligence: {
    0: 'Potwierdź brak jakiejkolwiek zdolności analitycznej. Całe raportowanie jest ręczne.',
    1: 'Sprawdź podstawowe raportowanie (arkusze, statyczne dashboardy).',
    2: 'Zweryfikuj platformę BI lub hurtownię danych z analityką opisową.',
    3: 'Sprawdź analitykę predykcyjną i modele ML w aktywnym użyciu.',
    4: 'Sprawdź AI/ML na dużą skalę z analityką preskryptywną i wsparciem decyzji w czasie rzeczywistym.',
    5: 'Zweryfikuj autonomiczne podejmowanie decyzji przez AI z systemami samo-uczącymi się.',
  },
  talent_readiness: {
    0: 'Potwierdź brak cyfrowego programu szkoleniowego. Nauka jest doraźna.',
    1: 'Sprawdź podstawowe plany szkoleń i inwentarz kompetencji.',
    2: 'Zweryfikuj wdrożony LMS. Czy kompetencje cyfrowe są formalnie oceniane?',
    3: 'Sprawdź ramę kompetencji i program cyfrowej akademii.',
    4: 'Sprawdź spersonalizowane przez AI ścieżki nauki i narzędzia szkoleniowe VR/AR.',
    5: 'Zweryfikuj kulturę samodzielnej nauki z rynkiem wiedzy wewnątrz organizacji.',
  },
  structure_management: {
    0: 'Potwierdź tradycyjną hierarchię bez cyfrowego zarządzania.',
    1: 'Sprawdź podstawowy dokument strategii cyfrowej i wstępne ramy zarządzania.',
    2: 'Zweryfikuj istnienie biura transformacji cyfrowej z dashboardami KPI.',
    3: 'Sprawdź zwinną strukturę organizacyjną z zarządzaniem danymi i zarządzaniem innowacją.',
    4: 'Sprawdź model organizacji platformowej i ramy zarządzania AI.',
    5: 'Zweryfikuj adaptacyjną organizację z samo-organizującymi się zespołami.',
  },
};

// ============================================
// COMMON MISTAKES PER DIMENSION
// ============================================

const DIMENSION_COMMON_MISTAKES: Record<string, string[]> = {
  operations: [
    'Rating based on tool ownership rather than actual daily usage and process integration.',
    'Confusing having an MES license with having a functioning, data-producing MES deployment.',
    'Ignoring sub-processes: operations includes planning, execution, quality, and maintenance.',
  ],
  supply_chain: [
    'Rating the internal logistics only without considering supplier and customer integration.',
    'Confusing order tracking within ERP with true end-to-end supply chain visibility.',
    'Overlooking procurement digitization — SCM is not just warehouse management.',
  ],
  product_lifecycle: [
    'Equating CAD usage with PLM maturity. PLM covers the entire product lifecycle.',
    'Missing version control and collaboration aspects — file sharing is not PLM.',
    'Overlooking the connection between design, manufacturing, and service data.',
  ],
  automation: [
    'Rating CNC machines as advanced automation when they still require full manual setup.',
    'Confusing isolated robot cells with flexible, integrated manufacturing systems.',
    'Ignoring the human-machine interface — cobots and AMRs need proper integration assessment.',
  ],
  connectivity: [
    'Assuming internet access equals connectivity maturity. Focus on machine-to-machine data flow.',
    'Overlooking OT network security when assessing IT/OT convergence.',
    'Rating cloud adoption without assessing actual real-time data streaming capabilities.',
  ],
  intelligence: [
    'Confusing dashboards with analytics. Descriptive reporting is not predictive analytics.',
    'Rating AI pilots as production-grade. Check if models are in daily decision workflows.',
    'Overlooking data quality — analytics maturity depends on clean, governed data pipelines.',
  ],
  talent_readiness: [
    'Equating having an LMS with a learning culture. Check actual participation and impact.',
    'Rating management awareness as organization-wide readiness. Assess shop-floor skills too.',
    'Overlooking change management. Skills training without cultural adoption has limited impact.',
  ],
  structure_management: [
    'Confusing digital strategy document with strategy execution and governance.',
    'Rating a committee as a transformation office. Check actual mandate and budget.',
    'Overlooking middle management alignment — strategy-execution gap is common here.',
  ],
};

const DIMENSION_COMMON_MISTAKES_PL: Record<string, string[]> = {
  operations: [
    'Ocena na podstawie posiadania narzędzia, a nie faktycznego codziennego użycia i integracji z procesem.',
    'Mylenie posiadania licencji MES z funkcjonującym, produkującym dane wdrożeniem MES.',
    'Pomijanie podprocesów: operacje obejmują planowanie, wykonanie, jakość i utrzymanie ruchu.',
  ],
  supply_chain: [
    'Ocena wyłącznie logistyki wewnętrznej bez uwzględnienia integracji z dostawcami i klientami.',
    'Mylenie śledzenia zamówień w ERP z prawdziwą widocznością łańcucha dostaw end-to-end.',
    'Pomijanie cyfryzacji zakupów — SCM to nie tylko zarządzanie magazynem.',
  ],
  product_lifecycle: [
    'Utożsamianie użycia CAD z dojrzałością PLM. PLM obejmuje cały cykl życia produktu.',
    'Pomijanie kontroli wersji i współpracy — dzielenie się plikami to nie PLM.',
    'Pomijanie połączenia między danymi projektowymi, produkcyjnymi i serwisowymi.',
  ],
  automation: [
    'Ocena maszyn CNC jako zaawansowanej automatyzacji, gdy nadal wymagają pełnej ręcznej obsługi.',
    'Mylenie izolowanych komórek robotycznych ze zintegrowanymi, elastycznymi systemami produkcyjnymi.',
    'Pomijanie interfejsu człowiek-maszyna — koboty i AMR-y wymagają odpowiedniej oceny integracji.',
  ],
  connectivity: [
    'Zakładanie, że dostęp do internetu oznacza dojrzałość łączności. Liczy się przepływ danych maszyna-maszyna.',
    'Pomijanie bezpieczeństwa sieci OT przy ocenie konwergencji IT/OT.',
    'Ocena adopcji chmury bez weryfikacji faktycznych możliwości strumieniowania danych w czasie rzeczywistym.',
  ],
  intelligence: [
    'Mylenie dashboardów z analityką. Raportowanie opisowe to nie analityka predykcyjna.',
    'Ocena pilotaży AI jako rozwiązań produkcyjnych. Sprawdź, czy modele są w codziennych procesach decyzyjnych.',
    'Pomijanie jakości danych — dojrzałość analityczna zależy od czystych, zarządzanych pipeline’ów danych.',
  ],
  talent_readiness: [
    'Utożsamianie posiadania LMS z kulturą uczenia się. Sprawdź faktyczny udział i wpływ.',
    'Ocena świadomości kadry zarządzającej jako gotowości całej organizacji. Oceń też kompetencje na hali.',
    'Pomijanie zarządzania zmianą. Szkolenie bez adopcji kulturowej ma ograniczony wpływ.',
  ],
  structure_management: [
    'Mylenie dokumentu strategii cyfrowej z jej realizacją i zarządzaniem.',
    'Ocena komitetu jako biura transformacji. Sprawdź faktyczny mandat i budżet.',
    'Pomijanie zaangażowania średniej kadry zarządzającej — luka strategia-wykonanie to częsty problem.',
  ],
};

// ============================================
// OVERRIDES (empty by default, fill as needed)
// ============================================

const SIRI_KNOWLEDGE_OVERRIDES: Partial<
  Record<SIRIDimensionLevelKey, Partial<SIRILevelKnowledge>>
> = {};

// ============================================
// HELPER FUNCTIONS
// ============================================

function defaultQuestions(
  dimension: SIRIDimension,
  level: number,
  lang: 'pl' | 'en' = 'en'
): [string, string, string] {
  const dimName = dimension.name;
  const levelTitle = SIRI_MATURITY_LEVELS[level]?.title || `Level ${level}`;
  if (lang === 'pl') {
    return [
      `W wymiarze „${dimName}" — czy poziom ${level} ("${levelTitle}") jest osiągnięty zgodnie z opisem?`,
      `Czy możemy pokazać dowód dla poziomu ${level} (np. system, metryki, proces, dokumentacja)?`,
      `Czy jest to stosowane konsekwentnie w całej organizacji (nie tylko jako pilotaż lub odosobniony przypadek)?`,
    ];
  }
  return [
    `In "${dimName}", is level ${level} ("${levelTitle}") achieved as described?`,
    `Can we show evidence for level ${level} (e.g. system, metrics, process, documentation)?`,
    `Is this consistently applied across the organization (not just a pilot or isolated case)?`,
  ];
}

function defaultExample(dimension: SIRIDimension, level: number, lang: 'pl' | 'en' = 'en'): string {
  const dimName = dimension.name;
  const levelTitle = SIRI_MATURITY_LEVELS[level]?.title || `Level ${level}`;
  if (lang === 'pl') {
    return `Przykład: w wymiarze „${dimName}" na poziomie ${level} ("${levelTitle}") dostarczamy konkretny artefakt potwierdzający dojrzałość (np. zrzut ekranu systemu, raport analityczny, dokumentację procesu, dowód KPI).`;
  }
  return `Example: in "${dimName}" at level ${level} ("${levelTitle}"), we provide a concrete artifact confirming maturity (e.g. system screenshot, analytics report, process documentation, KPI evidence).`;
}

function getTechnologies(dimensionId: string, level: number): string[] {
  const dimTech = DIMENSION_TECH[dimensionId];
  if (dimTech && dimTech[level]) return dimTech[level];
  // Fallback
  return ['Process Documentation', 'KPI Dashboard', 'Standard Operating Procedures (SOP)'];
}

// ============================================
// PUBLIC API
// ============================================

function getEvidenceGuidance(dimensionId: string, level: number, lang: 'pl' | 'en' = 'en'): string {
  if (lang === 'pl') {
    return (
      DIMENSION_EVIDENCE_GUIDANCE_PL[dimensionId]?.[level] ||
      DIMENSION_EVIDENCE_GUIDANCE[dimensionId]?.[level] ||
      'Szukaj udokumentowanych procesów, systemów w aktywnym użyciu i mierzalnych efektów na tym poziomie.'
    );
  }
  return (
    DIMENSION_EVIDENCE_GUIDANCE[dimensionId]?.[level] ||
    'Look for documented processes, systems in active use, and measurable outcomes at this level.'
  );
}

function getCommonMistakes(dimensionId: string, lang: 'pl' | 'en' = 'en'): string[] {
  if (lang === 'pl') {
    return (
      DIMENSION_COMMON_MISTAKES_PL[dimensionId] || [
        'Upewnij się, że oceny odzwierciedlają rzeczywistą praktykę, nie aspiracje.',
        'Weryfikuj dowodem, nie tylko percepcją zarządu.',
        'Sprawdź spójność w całej organizacji.',
      ]
    );
  }
  return (
    DIMENSION_COMMON_MISTAKES[dimensionId] || [
      'Ensure scores reflect actual practice, not aspirations.',
      'Verify with evidence, not just management perception.',
      'Check consistency across the organization.',
    ]
  );
}

function getLevelMeaning(level: number, lang: 'pl' | 'en' = 'en'): string {
  if (lang === 'pl') {
    return SIRI_LEVEL_MEANINGS_PL[level]?.meaning || `Dojrzałość na poziomie ${level}.`;
  }
  return SIRI_LEVEL_MEANINGS[level]?.meaning || `Level ${level} maturity.`;
}

export function getSIRIKnowledge(
  dimensionId: string,
  levelNumber: number,
  lang: 'pl' | 'en' = 'en'
): SIRILevelKnowledge {
  const dimension = SIRI_DIMENSIONS.find((d) => d.id === dimensionId);

  const fallback: SIRILevelKnowledge =
    lang === 'pl'
      ? {
          questions: [
            'Czy ten poziom jest osiągnięty?',
            'Czy mamy dowód, że ten poziom jest spełniony?',
            'Czy jest stosowany konsekwentnie?',
          ],
          example: 'Przykład: dostarcz dowód (system/metryki/dokumentacja).',
          suggestedTechnologies: ['KPI Dashboard', 'Process Documentation'],
          evidenceGuidance: getEvidenceGuidance(dimensionId, levelNumber, lang),
          commonMistakes: getCommonMistakes(dimensionId, lang),
          levelMeaning: getLevelMeaning(levelNumber, lang),
        }
      : {
          questions: [
            'Is this level achieved?',
            'Do we have evidence that this level is met?',
            'Is it consistently applied?',
          ],
          example: 'Example: provide evidence (system/metrics/documentation).',
          suggestedTechnologies: ['KPI Dashboard', 'Process Documentation'],
          evidenceGuidance: getEvidenceGuidance(dimensionId, levelNumber, lang),
          commonMistakes: getCommonMistakes(dimensionId, lang),
          levelMeaning: getLevelMeaning(levelNumber, lang),
        };

  if (!dimension) return fallback;

  const base: SIRILevelKnowledge = {
    questions: defaultQuestions(dimension, levelNumber, lang),
    example: defaultExample(dimension, levelNumber, lang),
    suggestedTechnologies: getTechnologies(dimensionId, levelNumber),
    evidenceGuidance: getEvidenceGuidance(dimensionId, levelNumber, lang),
    commonMistakes: getCommonMistakes(dimensionId, lang),
    levelMeaning: getLevelMeaning(levelNumber, lang),
  };

  const key: SIRIDimensionLevelKey = `${dimensionId}#${levelNumber}`;
  const override = SIRI_KNOWLEDGE_OVERRIDES[key];
  if (!override) return base;

  return {
    questions: (override.questions as any) || base.questions,
    example: override.example || base.example,
    suggestedTechnologies: override.suggestedTechnologies || base.suggestedTechnologies,
    evidenceGuidance: override.evidenceGuidance || base.evidenceGuidance,
    commonMistakes: override.commonMistakes || base.commonMistakes,
    levelMeaning: base.levelMeaning,
  };
}

export function getSIRILevelMeaning(
  level: number
): { title: string; meaning: string; evidencePattern: string } | null {
  return SIRI_LEVEL_MEANINGS[level] || null;
}

/**
 * Get building block context (useful for overview panels)
 */
export function getSIRIBuildingBlockInfo(blockId: string) {
  const block = SIRI_BUILDING_BLOCKS[blockId as keyof typeof SIRI_BUILDING_BLOCKS];
  if (!block) return null;
  return {
    name: block.name,
    description: block.description,
    dimensions: SIRI_DIMENSIONS.filter((d) => d.buildingBlock === blockId),
  };
}
