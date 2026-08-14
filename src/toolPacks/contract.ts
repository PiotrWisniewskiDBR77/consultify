/**
 * Tool Pack — kanoniczny kontrakt treści narzędzia konsultingowego.
 *
 * ŹRÓDŁA (konsolidacja, nie wymyślanie):
 * - `knowledge/tool-kb/_templates/tool-pack.v1.md` — istniejący szablon packów
 *   (pack_type: methodology | qbank | initiatives | benchmarks | help).
 * - `docs/ui-standards/03-modules/tools-library-detail-standard.md` — FROZEN
 *   standard Library (4 sekcje: goal/process/outcomes/example i ich bloki).
 * - `docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/TOOL_ARTIFACT_TYPE_CONTRACT.md`
 * - `TOOLS_CANONICAL_ROSTER.md` — 31 kanonicznych narzędzi (Gate T0).
 *
 * ZASADA NACZELNA (decyzja właściciela 2026-08-13):
 * Rozdzielamy DWA niezależne pojęcia. Kompletna treść NIE czyni narzędzia
 * dostępnym; dostępność wymaga działającego runtime i ręcznego odbioru.
 */

import type { ToolType } from '@/store/useToolStore';
import type { RuntimeReadinessManifest } from './runtimeReadiness';

/** Stan TREŚCI — czy narzędzie ma kompletny, zweryfikowany opis i Pack. */
export type PackContentStatus =
  /** Wszystkie wymagane sekcje wypełnione i oparte na potwierdzonym źródle. */
  | 'PACK_COMPLETE'
  /** Część sekcji wypełniona, reszta jawnie oznaczona jako brakująca. */
  | 'PACK_PARTIAL'
  /**
   * Merytoryka ISTNIEJE i jest zweryfikowana (np. silnik w `src/config/<tool>/`),
   * ale Pack nie został jeszcze spisany. To NIE jest brak dowodów — mylenie tych
   * dwóch stanów zaniżałoby realny stan 18 narzędzi z działającymi silnikami.
   */
  | 'PACK_NOT_AUTHORED'
  /** Brak potwierdzonej merytoryki w repo — NIE zgadujemy. */
  | 'EVIDENCE_MISSING';

/**
 * Stan RUNTIME — czy narzędzie wolno pokazać jako dostępne.
 * Zdejmowane POJEDYNCZO, dopiero po pełnym DoD (sesja, persistence, renderer,
 * Output, review/approval, testy automatyczne, ręczna akceptacja właściciela).
 */
export type PackRuntimeStatus =
  /** Pełne DoD dowiezione i odebrane. */
  | 'RUNTIME_ACTIVE'
  /** W trakcie rolloutu runtime — nie pokazywać jako gotowe. */
  | 'RUNTIME_PENDING'
  /** Świadomie poza rolloutem; Library mówi „coming soon" uczciwie. */
  | 'COMING_SOON';

/**
 * Archetyp geometrii sygnaturowej. Archetyp NIE jest nowym narzędziem —
 * narzuca tylko sposób prezentacji centrum artefaktu.
 */
export type SignatureArchetype =
  | 'quadrant-strategic-field'
  | 'force-radial'
  | 'decision-matrix-portfolio'
  | 'flow-value-stream'
  | 'causal-problem-solving'
  | 'architecture-capability'
  | 'operating-model-standard'
  | 'discovery-candidate-funnel';

/** Znacznik braku dowodu — używany zamiast zgadywania treści. */
export const EVIDENCE_MISSING = 'EVIDENCE_MISSING' as const;
export type EvidenceMissing = typeof EVIDENCE_MISSING;

/** Wartość, która może być jawnie nieznana. Nigdy nie zmyślamy. */
export type Evidenced<T> = T | EvidenceMissing;

export function isEvidenceMissing(value: unknown): value is EvidenceMissing {
  return value === EVIDENCE_MISSING;
}

/** Dwujęzyczny tekst — standard Library wymaga PL + EN. */
export interface Bilingual {
  pl: string;
  en: string;
}

/** Odwołanie do źródła. Bez tego treść nie może być PACK_COMPLETE. */
export interface ProvenanceRef {
  /** Ścieżka w repo, dokument SSOT albo zewnętrzne źródło metody. */
  source: string;
  /** Czy plik da się zweryfikować w repo (zipy metod są gitignorowane). */
  verifiableInRepo: boolean;
  note?: string;
}

/** Faza sesji. Rytm: frame→elicit→challenge→substantiate→place→interpret→confirm. */
export interface PackPhase {
  id: string;
  title: Bilingual;
  goal: Bilingual;
  /** Jak wygląda dobry rezultat tej fazy. */
  whatGoodLooksLike: Evidenced<string>;
  /** Jakich dowodów wymagać od uczestnika. */
  evidenceToAskFor: Evidenced<string>;
  /** Kryterium przejścia dalej. */
  completionCriterion: Evidenced<string>;
}

/** Pytanie prowadzące sesję. */
export interface PackQuestion {
  id: string;
  phaseId: string;
  prompt: Bilingual;
  answerType: 'text' | 'list' | 'choice' | 'scale' | 'matrix-placement' | 'evidence';
  /** Reguła challenge'u — jak AI ma podważyć płytką odpowiedź. */
  challengeRule: Evidenced<string>;
  followUpProbes?: string[];
}

/**
 * Kontrakt konkluzji W2 — `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2
 * („Output toola — rekomendacja z rationale i trade-offami").
 *
 * Twarda reguła standardu: K1 pochodzi z SILNIKA, nigdy z LLM. K2-K4 mogą być
 * formułowane przez model, ale wyłącznie na zamkniętym groundingu.
 */
export interface PackConclusionContract {
  /** K1 CO JEST — fakt liczony deterministycznie przez silnik metody. */
  k1FactSource: Evidenced<string>;
  /** K2 CO TO ZNACZY — na jakim groundingu wolno interpretować. */
  k2GroundingScope: Evidenced<string>;
  /** K3 CO ROBIĆ NAJPIERW — skąd bierze się kolejność (ranking silnika). */
  k3PrioritySource: Evidenced<string>;
  /** K4 JAKI EFEKT — jak wyrazić rezultat i horyzont czasowy. */
  k4EffectRule: Evidenced<string>;
  /** Trade-offy wymagane przez W2: co wybrano, co odrzucono i dlaczego. */
  tradeoffRule: Evidenced<string>;
}

/** Mapowanie na 5 funkcji modułu. Bez tego brak traceability. */
export interface PackMapping {
  /** Co trafia do Output po zatwierdzeniu. */
  output: Evidenced<string>;
  /** Jak Output wchodzi do raportu/prezentacji. */
  report: Evidenced<string>;
  /** Wzorzec „napięcie/luka → ruch → inicjatywa". */
  initiative: Evidenced<string>;
}

/** Treść dla ekranu Library (arkusz informacyjno-edukacyjno-sprzedażowy). */
export interface PackLibraryContent {
  /** Czym narzędzie naprawdę jest. */
  whatItIs: Bilingual;
  /** Czego NIE rozwiązuje — blok rose w standardzie Library. */
  whatItIsNot: Bilingual;
  whenToUse: Bilingual;
  whenNotToUse: Bilingual;
  /** Dlaczego warto — USP, blok violet. */
  whyItMatters: Bilingual;
  /** Co przygotować przed startem. */
  inputsRequired: Bilingual;
  /** Kto powinien brać udział. */
  roles: Bilingual;
  /** Co wychodzi z sesji. */
  outcome: Bilingual;
  /** Realistyczny czas trwania. */
  estimatedEffort: Evidenced<string>;
  /** Licencja/płatność. Klasyczne metody bywają cudzą własnością. */
  license: Evidenced<string>;
}

/**
 * Wiązanie packa z realnym kodem metody.
 *
 * Pytania w packu są INDEKSEM STERUJĄCYM fazami, a nie kopią banku pytań.
 * Realny bank (np. drabinka 4 ćwiartki × 4 poziomy w Dynamic SWOT) żyje
 * w `src/config/<tool>/`. Ta relacja musi być zakodowana i testowalna,
 * inaczej „pack kompletny" znaczyłoby „ma pięć pytań".
 */
export interface PackEngineBinding {
  /** Katalog silnika, np. `src/config/swot`. */
  engineDir: string;
  /** Moduł banku pytań będącego źródłem drabinki. */
  questionBankModule: string;
  /** Ile węzłów bank musi mieć — weryfikowane testem wobec realnego modułu. */
  expectedQuestionNodeCount: number;
  /** Które fazy packa są obsługiwane przez bank (reszta to sterowanie). */
  bankBackedPhaseIds: string[];
  /** Komponent renderujący geometrię sygnaturową; brak = renderer generyczny. */
  rendererComponent: Evidenced<string>;
}

/**
 * Rejestr praw i atrybucji. Flaga `license='free'` w bazie jest wyłącznie
 * flagą produktową i NIE jest dowodem prawnym.
 */
export interface PackRightsEntry {
  methodologyName: string;
  /** Powszechnie przypisywany autor/organizacja — stwierdzenie o atrybucji. */
  commonlyAttributedTo: Evidenced<string>;
  sourceUsed: Evidenced<string>;
  sourceType:
    | 'REPO_CANON'
    | 'ENGINE_DERIVED'
    | 'AUTHORITATIVE_EXTERNAL_SOURCE'
    | 'EDITORIAL_DRAFT'
    | 'EVIDENCE_MISSING';
  /** Czy w repo reprodukowano cudzą treść. */
  copiedContent: 'yes' | 'no' | 'UNKNOWN';
  trademarkNote: Evidenced<string>;
  /** Nigdy nie wpisujemy automatycznie „Free". */
  commercialUseStatus: 'LEGAL_REVIEW_REQUIRED' | string;
  legalReviewStatus: 'LEGAL_REVIEW_REQUIRED' | 'CLEARED';
  publicationStatus: 'LEGAL_REVIEW_REQUIRED' | 'APPROVED';
  uncertainty: string;
}

/** Kompletny Tool Pack. */
export interface ToolPack {
  // --- identity + wersja + provenance ---
  toolType: ToolType;
  displayName: Bilingual;
  category: 'strategic' | 'operational' | 'digital' | 'automation';
  packVersion: string;
  contentStatus: PackContentStatus;
  runtimeStatus: PackRuntimeStatus;
  provenance: ProvenanceRef[];

  // --- treść Library ---
  library: PackLibraryContent;

  // --- mechanika sesji ---
  purpose: Bilingual;
  useCases: string[];
  contraindications: string[];
  phases: PackPhase[];
  questions: PackQuestion[];

  /** Reguły klasyfikacji obiektów (np. S/W/O/T, oś portfela). */
  classificationRules: Evidenced<string>;
  /** Czego oczekujemy jako dowodu (fakt/obserwacja/hipoteza). */
  evidenceExpectations: Evidenced<string>;
  /** Relacje między obiektami (np. konflikt, wzmocnienie). */
  relationships: Evidenced<string>;
  /** Jak czytać wynik — interpretacja, nie opis. */
  interpretationRules: Evidenced<string>;
  /** Kiedy sesja jest kompletna. */
  completionCriteria: Evidenced<string>;

  // --- prezentacja ---
  signatureArchetype: SignatureArchetype;
  /** Dlaczego ten archetyp jest właściwy dla tej metody. */
  signatureRationale: Evidenced<string>;

  // --- 5 funkcji ---
  mapping: PackMapping;
  /** Kontrakt konkluzji W2 (CONCLUSION_LAYER_STANDARD). */
  conclusion: PackConclusionContract;

  /**
   * Wiązanie z realnym silnikiem, bankiem pytań i rendererem.
   * Opcjonalne w typie, ale WYMAGANE przez walidator dla PACK_COMPLETE —
   * pack bez wiązania nie udowadnia, że pokrywa realną metodę.
   */
  engine?: PackEngineBinding;
  /** Rejestr praw i atrybucji — WYMAGANY przez walidator dla PACK_COMPLETE. */
  rights?: PackRightsEntry;
  /**
   * Dowód gotowości runtime. Wymagany, by narzędzie mogło być RUNTIME_ACTIVE.
   * Brak manifestu = brak publikacji, niezależnie od kompletności treści.
   */
  runtimeReadiness?: RuntimeReadinessManifest;
}

/** Minimalny pack — narzędzie bez potwierdzonej merytoryki. */
export function evidenceMissingPack(
  toolType: ToolType,
  displayName: Bilingual,
  category: ToolPack['category'],
  signatureArchetype: SignatureArchetype,
  runtimeStatus: PackRuntimeStatus
): ToolPack {
  const missing: Bilingual = {
    pl: 'EVIDENCE_MISSING — brak potwierdzonej merytoryki w repo.',
    en: 'EVIDENCE_MISSING — no confirmed substance in the repository.',
  };
  return {
    toolType,
    displayName,
    category,
    packVersion: '0.0.0',
    contentStatus: 'EVIDENCE_MISSING',
    runtimeStatus,
    provenance: [],
    library: {
      whatItIs: missing,
      whatItIsNot: missing,
      whenToUse: missing,
      whenNotToUse: missing,
      whyItMatters: missing,
      inputsRequired: missing,
      roles: missing,
      outcome: missing,
      estimatedEffort: EVIDENCE_MISSING,
      license: EVIDENCE_MISSING,
    },
    purpose: missing,
    useCases: [],
    contraindications: [],
    phases: [],
    questions: [],
    classificationRules: EVIDENCE_MISSING,
    evidenceExpectations: EVIDENCE_MISSING,
    relationships: EVIDENCE_MISSING,
    interpretationRules: EVIDENCE_MISSING,
    completionCriteria: EVIDENCE_MISSING,
    signatureArchetype,
    signatureRationale: EVIDENCE_MISSING,
    mapping: {
      output: EVIDENCE_MISSING,
      report: EVIDENCE_MISSING,
      initiative: EVIDENCE_MISSING,
    },
    conclusion: {
      k1FactSource: EVIDENCE_MISSING,
      k2GroundingScope: EVIDENCE_MISSING,
      k3PrioritySource: EVIDENCE_MISSING,
      k4EffectRule: EVIDENCE_MISSING,
      tradeoffRule: EVIDENCE_MISSING,
    },
  };
}
