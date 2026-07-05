/**
 * DRD Industry Reference Profiles (expert hypothesis v1)
 *
 * Implements DRD Canon §8.2 (docs/product/DRD_CANON.md): expert reference
 * profiles per industry segment, expressed on the universal DRD I–V
 * interpretation scale (Canon §4.1) across the 8 reporting dimensions
 * D1–D8 (Canon §3.2, MAP-1.0).
 *
 * IMPORTANT:
 * - These values are an EXPERT HYPOTHESIS ("solidny środek stawki",
 *   PL/CEE market, 2026) — NOT a statistical benchmark. Per Canon §8.1
 *   they must be replaced/calibrated by platform data once a segment
 *   reaches n ≥ 10 closed assessments (median + quartiles, anonymised).
 * - Every consumer (report, radar, deck) MUST render the disclaimer.
 * - `typical` = expected level of a typical, mid-pack company in the
 *   segment; `leader` = industry leader / top-quartile expectation.
 *   Invariant: leader >= typical for every dimension.
 * - NOT wired into the client report yet — pending owner decision P3
 *   (publish immediately with annotation vs after calibration).
 */

/** The 8 DRD reporting dimensions (Canon §3.2, MAP-1.0). */
export type DRDDimensionId = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8';

export const DRD_DIMENSION_IDS: readonly DRDDimensionId[] = [
  'D1',
  'D2',
  'D3',
  'D4',
  'D5',
  'D6',
  'D7',
  'D8',
] as const;

export const DRD_DIMENSION_LABELS: Record<DRDDimensionId, { pl: string; en: string }> = {
  D1: { pl: 'Procesy cyfrowe', en: 'Digital Processes' },
  D2: { pl: 'Produkty cyfrowe', en: 'Digital Products' },
  D3: { pl: 'Cyfrowe modele biznesowe', en: 'Digital Business Models' },
  D4: { pl: 'Dane i analityka', en: 'Data & Analytics' },
  D5: { pl: 'Technologia i infrastruktura', en: 'Technology & Infrastructure' },
  D6: { pl: 'Ludzie i kultura', en: 'People & Culture' },
  D7: { pl: 'Cyberbezpieczeństwo', en: 'Cybersecurity' },
  D8: { pl: 'Dojrzałość AI', en: 'AI Maturity' },
};

/**
 * Universal DRD interpretation level (Canon §4.1).
 * 1 = I (Analog), 2 = II (Fragmented), 3 = III (Connected),
 * 4 = IV (Optimized), 5 = V (Self-optimizing).
 */
export type DRDReferenceLevel = 1 | 2 | 3 | 4 | 5;

export const DRD_REFERENCE_LEVEL_MIN: DRDReferenceLevel = 1;
export const DRD_REFERENCE_LEVEL_MAX: DRDReferenceLevel = 5;

/** Roman-numeral presentation of the I–V scale (client-facing convention). */
export const DRD_REFERENCE_LEVEL_ROMAN: Record<DRDReferenceLevel, 'I' | 'II' | 'III' | 'IV' | 'V'> =
  {
    1: 'I',
    2: 'II',
    3: 'III',
    4: 'IV',
    5: 'V',
  };

export interface DRDDimensionBenchmark {
  /** Expected level of a typical ("mid-pack") company in the segment. */
  typical: DRDReferenceLevel;
  /** Expected level of an industry leader / top quartile. Always >= typical. */
  leader: DRDReferenceLevel;
}

export type DRDIndustryId =
  | 'discrete-manufacturing'
  | 'process-manufacturing'
  | 'professional-services';

export const DRD_INDUSTRY_IDS: readonly DRDIndustryId[] = [
  'discrete-manufacturing',
  'process-manufacturing',
  'professional-services',
] as const;

export const DRD_INDUSTRY_PROFILE_SOURCE = 'expert-hypothesis-v1' as const;

export interface DRDIndustryProfile {
  industry: DRDIndustryId;
  label: { pl: string; en: string };
  dimensionBenchmarks: Record<DRDDimensionId, DRDDimensionBenchmark>;
  /** 3–5 sentences: what is typically strong/weak in the segment and why. */
  narrative: { pl: string; en: string };
  source: typeof DRD_INDUSTRY_PROFILE_SOURCE;
  disclaimer: { pl: string; en: string };
}

/** Shared disclaimer per Canon §8.1/§8.2 — must accompany every rendering. */
export const DRD_INDUSTRY_PROFILE_DISCLAIMER = {
  pl: 'Profil referencyjny ekspercki DBR77 (hipoteza, wersja v1) — nie jest benchmarkiem statystycznym. Wartości podlegają kalibracji danymi platformy od n ≥ 10 zamkniętych ocen w segmencie (mediana + kwartyle, dane zanonimizowane). Benchmark statystyczny w budowie.',
  en: 'DBR77 expert reference profile (hypothesis, version v1) — not a statistical benchmark. Values are subject to calibration with platform data once a segment reaches n ≥ 10 closed assessments (median + quartiles, anonymised). Statistical benchmark under construction.',
} as const;

export const DRD_INDUSTRY_PROFILES: DRDIndustryProfile[] = [
  {
    industry: 'discrete-manufacturing',
    label: { pl: 'Produkcja dyskretna', en: 'Discrete manufacturing' },
    dimensionBenchmarks: {
      D1: { typical: 3, leader: 5 },
      D2: { typical: 2, leader: 4 },
      D3: { typical: 2, leader: 3 },
      D4: { typical: 3, leader: 4 },
      D5: { typical: 3, leader: 4 },
      D6: { typical: 2, leader: 4 },
      D7: { typical: 3, leader: 4 },
      D8: { typical: 1, leader: 3 },
    },
    narrative: {
      pl: 'Produkcja dyskretna (maszyny, komponenty, automotive) jest zwykle najmocniejsza w procesach rdzeniowych: wymogi klientów OEM, traceability i certyfikacje (ISO/IATF) wymuszają udokumentowane, mierzone procesy, a liderzy — zwłaszcza dostawcy tier-1 — pracują na MES z harmonogramowaniem wspieranym algorytmicznie, stąd realny sufit lidera to poziom V w D1. Dane procesowe są zbierane od lat (jakość, OEE), ale typowo pozostają w silosach maszynowo-działowych, więc analityka przekrojowa i AI kuleją — dojrzałość AI to najczęściej prywatne eksperymenty pracowników (poziom I). Wymiar produktowy i modele biznesowe są strukturalnie słabe: firma sprzedaje wyrób fizyczny w kanale B2B przez handlowców, warstwa cyfrowa produktu i przychód cyfrowy prawie nie istnieją. Kultura bywa hamulcem — organizacje inżynierskie z długim stażem załogi wdrażają narzędzia, ale rzadko prowadzą zmianę (komunikacja top-down, brak koalicji zmiany), co ogranicza utrzymanie poziomu IV w pozostałych wymiarach.',
      en: 'Discrete manufacturing (machinery, components, automotive) is usually strongest in core processes: OEM customer requirements, traceability and certifications (ISO/IATF) force documented, measured processes, and leaders — especially tier-1 suppliers — run MES with algorithm-assisted scheduling, hence a realistic leader ceiling of level V in D1. Process data has been collected for years (quality, OEE) but typically stays in machine- and department-level silos, so cross-cutting analytics and AI lag behind — AI maturity is most often private employee experimentation (level I). The product dimension and business models are structurally weak: the company sells a physical good through a B2B sales force, so the digital product layer and digital revenue barely exist. Culture is often the brake — engineering organisations with long-tenured workforces deploy tools but rarely lead change (top-down communication, no change coalition), which limits sustaining level IV elsewhere.',
    },
    source: DRD_INDUSTRY_PROFILE_SOURCE,
    disclaimer: DRD_INDUSTRY_PROFILE_DISCLAIMER,
  },
  {
    industry: 'process-manufacturing',
    label: { pl: 'Produkcja procesowa', en: 'Process manufacturing' },
    dimensionBenchmarks: {
      D1: { typical: 3, leader: 4 },
      D2: { typical: 2, leader: 3 },
      D3: { typical: 2, leader: 3 },
      D4: { typical: 3, leader: 4 },
      D5: { typical: 3, leader: 5 },
      D6: { typical: 2, leader: 3 },
      D7: { typical: 3, leader: 5 },
      D8: { typical: 1, leader: 3 },
    },
    narrative: {
      pl: 'Produkcja procesowa (chemia, spożywka, farmacja, energetyka) ma naturalnie wysoką dojrzałość infrastruktury i bezpieczeństwa: instalacje ciągłe od dekad pracują na DCS/SCADA z gęstą siecią sensorów, a reżimy compliance (HACCP, GMP, Seveso, NIS2) wymuszają zarządzanie ryzykiem i reagowanie na incydenty na poziomie systemowym — liderzy sięgają poziomu V w D5 i D7 (edge przy instalacji, certyfikowany SZBI). Paradoks segmentu: dane telemetryczne istnieją w nadmiarze, ale służą sterowaniu i raportowaniu zgodności, nie decyzjom biznesowym — warstwa analityczna między OT a zarządem jest typowo najsłabszym ogniwem. Produkt (commodity, receptura) i model biznesowy (kontrakty wolumenowe) dają mało przestrzeni na cyfryzację oferty, stąd niskie D2/D3 nawet u liderów. Kultura jest zorientowana na stabilność i bezpieczeństwo („nie dotykaj instalacji, która działa"), co jest zaletą operacyjną, ale systemowo tłumi eksperymentowanie i innowację — najtrudniejszy do podniesienia wymiar w tym segmencie.',
      en: 'Process manufacturing (chemicals, food, pharma, energy) has naturally high infrastructure and security maturity: continuous installations have run on DCS/SCADA with dense sensor networks for decades, and compliance regimes (HACCP, GMP, Seveso, NIS2) force systemic risk management and incident response — leaders reach level V in D5 and D7 (edge at the installation, certified ISMS). The segment paradox: telemetry data exists in abundance but serves control and compliance reporting, not business decisions — the analytics layer between OT and the board is typically the weakest link. The product (commodity, recipe) and business model (volume contracts) leave little room for digitising the offer, hence low D2/D3 even among leaders. Culture is oriented toward stability and safety ("don’t touch a running installation"), which is an operational asset but systematically suppresses experimentation and innovation — the hardest dimension to raise in this segment.',
    },
    source: DRD_INDUSTRY_PROFILE_SOURCE,
    disclaimer: DRD_INDUSTRY_PROFILE_DISCLAIMER,
  },
  {
    industry: 'professional-services',
    label: { pl: 'Usługi profesjonalne', en: 'Professional services' },
    dimensionBenchmarks: {
      D1: { typical: 3, leader: 4 },
      D2: { typical: 3, leader: 4 },
      D3: { typical: 3, leader: 4 },
      D4: { typical: 2, leader: 4 },
      D5: { typical: 3, leader: 4 },
      D6: { typical: 3, leader: 4 },
      D7: { typical: 2, leader: 4 },
      D8: { typical: 2, leader: 4 },
    },
    narrative: {
      pl: 'Usługi profesjonalne (doradztwo, IT, księgowość, kancelarie, agencje) mają najbardziej wyrównany profil: praca jest z natury cyfrowa (dokumenty, komunikacja, chmura SaaS), więc front kliencki, kanały cyfrowe i modele abonamentowe osiągają poziom III szybciej niż w przemyśle. Największa słabość jest wewnętrzna: wiedza — jedyny realny zasób firmy — żyje w skrzynkach mailowych i głowach seniorów, a dane o realizacji projektów są rozproszone między narzędziami, stąd D4 typowo na poziomie II mimo „cyfrowego" charakteru pracy. Cyberbezpieczeństwo jest systematycznie niedoinwestowane względem ryzyka (dane klienckie objęte tajemnicą zawodową przy higienie „antywirus i dobre chęci"), co czyni D7 najczęstszą krytyczną luką segmentu. Za to adopcja AI jest tu najszybsza na rynku — praca dokumentowo-językowa to naturalne pole dla asystentów generatywnych i liderzy realnie osiągają poziom IV, choć zwykle bez governance. Wysoka wariancja segmentu (butik 10 osób vs sieć międzynarodowa) sprawia, że rozrzut wokół wartości typowych jest większy niż w przemyśle.',
      en: 'Professional services (consulting, IT, accounting, law firms, agencies) have the most balanced profile: work is inherently digital (documents, communication, SaaS cloud), so the client front, digital channels and subscription models reach level III faster than in industry. The biggest weakness is internal: knowledge — the firm’s only real asset — lives in mailboxes and senior staff heads, and project delivery data is scattered across tools, hence D4 typically at level II despite the "digital" nature of the work. Cybersecurity is systematically under-invested relative to risk (client data under professional secrecy protected by "antivirus and good intentions"), making D7 the segment’s most common critical gap. AI adoption, by contrast, is the fastest on the market — document- and language-centric work is natural ground for generative assistants and leaders genuinely reach level IV, though usually without governance. High segment variance (a 10-person boutique vs an international network) means the spread around typical values is wider than in industry.',
    },
    source: DRD_INDUSTRY_PROFILE_SOURCE,
    disclaimer: DRD_INDUSTRY_PROFILE_DISCLAIMER,
  },
];

/** Convenience lookup by industry id. */
export function getDRDIndustryProfile(industry: DRDIndustryId): DRDIndustryProfile {
  const profile = DRD_INDUSTRY_PROFILES.find((p) => p.industry === industry);
  if (!profile) {
    throw new Error(`Unknown DRD industry profile: ${industry}`);
  }
  return profile;
}
