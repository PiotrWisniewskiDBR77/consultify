/**
 * ═══════════════════════════════════════════════════════════════════════
 * STATUS: NOT_WIRED / NORMALISATION_MISSING  (COORD-06, skorygowane 2026-08-13)
 * ─────────────────────────────────────────────────────────────────────
 * KOREKTA: pierwotnie oznaczone jako INCOMPATIBLE_LEGACY_MODEL. To bylo
 * NIEDOKLADNE. Model D1..D8 NIE jest obcym modelem legacy — jest
 * KANONICZNA WARSTWA KOMUNIKACJI zdefiniowana w DRD_CANON.md §1
 * (dwie warstwy: POMIAR 39 obszarow / KOMUNIKACJA 8 wymiarow) oraz §3.2
 * (mapowanie MAP-1.0, MECE, suma 39). Realny brak to WIRING i krok
 * normalizacji §6.1, nie niezgodnosc modeli.
 * ═══════════════════════════════════════════════════════════════════════
 * Full analysis: `docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/
 * DRD_PATHWAY_MAPPING_TASK.md`. Coordinator decision record: COORD-06 in
 * `docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/COORDINATION.md`.
 *
 * MODEL CARRIED IN THIS FILE (measured, not estimated):
 *   - 8 dimensions, ids `D1`..`D8` (see `DRD_DIMENSION_ORDER` below).
 *   - ONE uniform 5-rung scale for every dimension: levels 1..5, labelled
 *     I..V (`DRD_PATHWAY_LEVEL_ROMAN`).
 *   - 32 transition steps total = 8 dimensions × 4 transitions
 *     (I→II, II→III, III→IV, IV→V) — `CANON_TRANSITIONS` has exactly 32
 *     entries; `buildPathways()` throws if any is missing.
 *
 * CANONICAL DRD MEASUREMENT MODEL (`docs/product/DRD_CANON.md` §2.3, frozen
 * v1.0; implemented in `src/services/drdStructure.ts` → `DRD_STRUCTURE`):
 *   - 7 axes (id 1..7).
 *   - 39 areas total, unevenly distributed: axis 1 = 9 areas, axes 2–7 =
 *     5 areas each (9+5+5+5+5+5+5 = 39).
 *   - MIXED native scales per axis, NOT a uniform 1..5:
 *       axis1 = 1..7, axis2 = 1..5, axis3 = 1..5, axis4 = 1..7,
 *       axis5 = 1..6, axis6 = 1..6, axis7 = 1..5.
 *
 * THE TWO MODELS ARE NOT 1:1: 8 dimensions vs. 39 areas; one uniform 1..5
 * scale here vs. mixed 5/6/7-rung native scales in the canon. Canon §3.2
 * ("MAP-1.0") DOES define an official aggregation of the 39 areas into the
 * same `D1`..`D8` ids used here (e.g. D1 ← areas 1A–1I, D5 ← areas 4C+4E),
 * each keeping ITS OWN native scale — but turning a real assessment's
 * 39 area-level scores into the single I..V level this file expects as
 * `currentLevel` requires the canon §6 normalisation step, and that step is
 * NOT implemented in `calculateOverallScore()` / `calculateAxisScore()`
 * (`src/services/drdStructure.ts`) today — those currently average raw,
 * un-normalised levels across axes of different scale length (see the
 * implementation note in `DRD_CANON.md` near §6).
 *
 * CONSEQUENCE: no code path exists that takes real 39-area assessment
 * results and produces a trustworthy `D1`..`D8` / I..V input for this file.
 * `src/method-core/methods/drd/compileDrdPack.ts` (the actual DRD Method
 * Pack compiler) knows this and deliberately does NOT wire this pathway
 * data into the compiled pack — it only reports the discrepancy.
 *
 * DO NOT, without an explicit decision from the DRD methodology owner AND
 * full traceability (each `D_x#level` action mapped to its source area(s),
 * the formula step used, and who approved it — see the mapping task doc):
 *   - wire `getDRDPathway()` / `getMaturityPathway()` to real assessment
 *     scores;
 *   - invent a shortcut mapping between the 39 areas and `D1`..`D8` by
 *     name-matching, heuristics, or any other approximation — the canon
 *     already defines the mapping (§3.2); anything else creates a second,
 *     conflicting truth about DRD maturity;
 *   - let an LLM infer, complete, or "clean up" the mapping or the
 *     normalisation step.
 *
 * The prescriptive TEXT below (`CANON_TRANSITIONS`) is itself a verbatim,
 * canon-sourced transcription of `docs/product/DRD_CANON.md` §5 ("Ścieżka
 * przejścia N→N+1 per wymiar") — that part is not in question. What is
 * unresolved is exclusively the wiring between this D1–D8/I–V shape and the
 * 7-axis/39-area shape that real assessments actually score against.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * DRD Maturity Pathway Data (N → N+1, per reporting dimension D1–D8)
 *
 * SOURCE OF TRUTH: `docs/product/DRD_CANON.md` §5 ("Ścieżka przejścia N→N+1 per
 * wymiar"). This file transcribes the canon's 32 transition paths (8 dimensions
 * × 4 transitions I→II→III→IV→V) verbatim into structured data so the runtime
 * can look them up deterministically — no LLM required, no paraphrasing drift
 * from the frozen canon text.
 *
 * OXFORD Round 4 #4 (O1 — maturity pathway engine). This is DATA ONLY; the
 * lookup/formatting logic lives in `maturityPathwayService.ts`.
 *
 * Governance: the canon (§11) is the SSOT. If §5 changes, this file must be
 * updated to match — a divergence is a P1 bug per canon governance rules.
 */

import type { DRDDimensionId } from './drdIndustryProfiles';

/** The canonical DRD I–V interpretation scale (Canon §4.1). */
export type DRDPathwayLevel = 1 | 2 | 3 | 4 | 5;

export const DRD_PATHWAY_LEVEL_ROMAN: Record<DRDPathwayLevel, 'I' | 'II' | 'III' | 'IV' | 'V'> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
};

/**
 * One N→N+1 transition path for a single dimension. `actions` are the
 * concrete build items transcribed from Canon §5 (already imperative,
 * system/practice/governance-flavoured — this is prescription, not
 * description).
 */
export interface DRDPathwayStep {
  dimension: DRDDimensionId;
  fromLevel: DRDPathwayLevel;
  toLevel: DRDPathwayLevel;
  /** 2–4 concrete build items, transcribed verbatim from Canon §5 (semicolon-split). */
  actions: string[];
  /** PL prose exactly as it appears in the canon (single field; canon is PL-only today). */
  canonText: string;
}

function splitCanonActions(text: string): string[] {
  return text
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Raw canon text per dimension × transition (Canon §5, verbatim). Kept as a
 * flat table keyed by `${dimension}#${fromLevel}` so adding/auditing a single
 * transition is a one-line diff against the canon.
 */
const CANON_TRANSITIONS: Record<string, string> = {
  // D1 — Procesy cyfrowe
  'D1#1':
    'elektroniczna rejestracja u źródła (nie post factum) w 2–3 procesach o największym wolumenie; standard danych podstawowych (indeksy, kontrahenci); właściciel procesu wskazany imiennie.',
  'D1#2':
    'mapowanie i standaryzacja procesu end-to-end (SOP); workflow dla obiegów zatwierdzeń; automatyczny raport operacyjny dzienny/tygodniowy; kody kreskowe/terminale tam, gdzie dane wpisuje człowiek.',
  'D1#3':
    'wdrożenie/domknięcie systemu dziedzinowego (MES/ERP/CRM/WMS zależnie od luki) z integracją między działami; KPI procesowe w rytmie zarządczym; eliminacja podwójnego wprowadzania danych (integracje zamiast eksportów).',
  'D1#4':
    '2–3 przypadki użycia AI na procesach o największym koszcie odchyleń (prognoza, harmonogram, anomalie); pętla zamknięta alert→działanie→weryfikacja; pomiar efektu AI w złotówkach.',

  // D2 — Produkty cyfrowe
  'D2#1':
    'cyfrowa warstwa obsługi produktu (dokumentacja online, konfigurator, portal zgłoszeń); pomiar użycia tej warstwy.',
  'D2#2':
    'funkcja cyfrowa wnosząca wartość (monitoring, aplikacja, treści); roadmapa produktu cyfrowego z ownerem po stronie biznesu, nie IT.',
  'D2#3':
    'telemetria produktu + personalizacja na jej podstawie; integracje z ekosystemem klienta (API); proces discovery oparty o dane użycia.',
  'D2#4':
    'model przychodowy na warstwie cyfrowej (subskrypcja, dane, usługi dodane); zespół produktowy z pełnym cyklem build-measure-learn.',

  // D3 — Cyfrowe modele biznesowe
  'D3#1':
    'uruchomienie pierwszego kanału cyfrowego (e-commerce/marketplace) na istniejącej ofercie; podstawowa analityka konwersji.',
  'D3#2':
    'kanał cyfrowy z celem przychodowym i budżetem; pilotaż jednego modelu nietransakcyjnego (abonament, wynajem, platforma) na wycinku oferty.',
  'D3#3':
    'automatyzacja marketingu i samoobsługa klienta end-to-end; dynamiczna personalizacja oferty; rachunek rentowności per kanał/model.',
  'D3#4':
    'strategia monetyzacji danych (jakie dane, dla kogo, w jakiej formie, za ile) + pierwszy płatny produkt danych; zdolność uruchamiania nowego modelu w kwartał (playbook).',

  // D4 — Dane i analityka
  'D4#1':
    'cyfrowe zbieranie danych u źródła (formularze, skanery, odczyty z kluczowych maszyn); jedna konwencja nazewnicza i miejsce składowania per dział.',
  'D4#2':
    'centralne repozytorium (hurtownia/lakehouse) + ETL z systemów źródłowych; narzędzie BI z jednym kompletem definicji wskaźników; proces zarządzania jakością danych (właściciele, reguły, czyszczenie).',
  'D4#3':
    'dane maszynowe/IoT wpięte do analityki; analizy big data i symulacje w co najmniej 2 decyzjach cyklicznych (np. planowanie, utrzymanie ruchu); katalog danych.',
  'D4#4':
    'modele ML w produkcji z monitoringiem (MLOps); automatyczne akcje na podstawie predykcji; wycena i rachunek wartości danych jako aktywa.',

  // D5 — Technologia i infrastruktura
  'D5#1':
    'uporządkowana sieć LAN, centralny serwer plików/domena, inwentaryzacja sprzętu i systemów.',
  'D5#2':
    'segmentacja sieci (biuro/produkcja), przemysłowy Ethernet/WLAN tam gdzie maszyny, architektura integracji (szyna/API zamiast eksportów CSV).',
  'D5#3':
    'strategia chmurowa (co public, co private, co on-prem) i migracja pierwszych obciążeń; skalowalna moc obliczeniowa na żądanie; IaC/standard środowisk.',
  'D5#4':
    'edge computing przy procesach czasu rzeczywistego; orkiestracja obciążeń cloud+edge; infrastruktura jako produkt wewnętrzny z SLA i rachunkiem kosztów per usługa.',

  // D6 — Ludzie i kultura
  'D6#1':
    'jawna deklaracja kierunku cyfrowego od zarządu; wskazanie lidera transformacji; pierwsze szkolenia dla kadry kierowniczej.',
  'D6#2':
    'koalicja zmiany (sponsor + liderzy obszarów); komunikacja wizji w rytmie (townhall, tablice); program szkoleń z budżetem; międzydziałowe zespoły projektowe.',
  'D6#3':
    'system zgłaszania i nagradzania pomysłów; budżet na eksperymenty z jawnym prawem do porażki; mentoring i ścieżki kompetencji cyfrowych; przegląd trendów jako stały punkt agendy zarządu.',
  'D6#4':
    'instytucjonalizacja (cele cyfrowe w ocenach i premiach); R&D i partnerstwa zewnętrzne w strategii; sukcesja kompetencji — organizacja rozwija liderów transformacji, nie wynajmuje.',

  // D7 — Cyberbezpieczeństwo
  'D7#1':
    'polityka haseł + MFA; backup z testem odtworzenia; zarządzany firewall i antywirus; rejestr kont i dostępów.',
  'D7#2':
    'analiza ryzyka i plan postępowania; segmentacja sieci + VPN; procedury reagowania na incydenty (kto, co, w jakiej kolejności); coroczne szkolenie z testem dla wszystkich.',
  'D7#3':
    'SIEM/IDS z korelacją; audyty wewnętrzne wg planu; testy planów awaryjnych (ćwiczenia); polityki bezpieczeństwa wpięte w HR (onboarding/offboarding, role).',
  'D7#4':
    'system zarządzania klasy ISO 27001 (wdrożenie lub certyfikacja); pełna pętla doskonalenia po każdym incydencie i teście; raportowanie ryzyka cyber do zarządu w rytmie kwartalnym.',

  // D8 — Dojrzałość AI
  'D8#1':
    'polityka użycia AI (co wolno, na jakich danych, jakie narzędzia); 2–3 pilotaże asystenckie w zespołach o pracy dokumentowej; podstawowa higiena danych pod pilotaże.',
  'D8#2':
    'centralizacja danych pod AI (patrz D4 III); framework governance (rejestr przypadków użycia, ocena ryzyka, właściciel); program kompetencji AI per rola.',
  'D8#3':
    'procesy pół-autonomiczne z human-in-the-loop w 2–3 obszarach rdzeniowych; monitoring modeli (jakość, dryf, koszt); AI w co najmniej jednym produkcie/usłudze dla klienta.',
  'D8#4':
    'orkiestracja wieloagentowa procesów operacyjnych; oferta AI-native; rada ds. etyki/transparentności AI z realnymi uprawnieniami; mierzony udział AI w wyniku firmy.',
};

const DRD_DIMENSION_ORDER: DRDDimensionId[] = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'];

function buildPathways(): DRDPathwayStep[] {
  const out: DRDPathwayStep[] = [];
  for (const dimension of DRD_DIMENSION_ORDER) {
    for (const fromLevel of [1, 2, 3, 4] as DRDPathwayLevel[]) {
      const key = `${dimension}#${fromLevel}`;
      const canonText = CANON_TRANSITIONS[key];
      if (!canonText) {
        throw new Error(
          `[maturityPathwayDrdData] Missing Canon §5 transition for ${key} — data must cover all 32 DRD paths.`
        );
      }
      out.push({
        dimension,
        fromLevel,
        toLevel: (fromLevel + 1) as DRDPathwayLevel,
        actions: splitCanonActions(canonText),
        canonText,
      });
    }
  }
  return out;
}

/** All 32 DRD pathway steps (8 dimensions × 4 transitions I→II→III→IV→V), Canon §5. */
export const DRD_MATURITY_PATHWAYS: DRDPathwayStep[] = buildPathways();

/** Fast lookup: `${dimension}#${fromLevel}` → pathway step. */
export const DRD_MATURITY_PATHWAY_BY_KEY: Record<string, DRDPathwayStep> = Object.fromEntries(
  DRD_MATURITY_PATHWAYS.map((p) => [`${p.dimension}#${p.fromLevel}`, p])
);

export function getDRDPathway(
  dimension: DRDDimensionId,
  fromLevel: DRDPathwayLevel
): DRDPathwayStep | undefined {
  return DRD_MATURITY_PATHWAY_BY_KEY[`${dimension}#${fromLevel}`];
}

/**
 * Foundation graph (Canon §7.3) — used to surface "this also requires X first"
 * prerequisites when generating a pathway recommendation. Directed: key depends
 * on / is unlocked by every dimension in its value list at level >= III unless
 * noted. Text kept short; full rationale lives in the canon.
 */
export const DRD_FOUNDATION_GRAPH: Partial<
  Record<DRDDimensionId, { requires: DRDDimensionId[]; note: string }>
> = {
  D8: {
    requires: ['D4'],
    note: 'Bez danych ≥ III (D4) nie ma AI ≥ III (D8) — Canon §7.3.',
  },
  D4: {
    requires: ['D5'],
    note: 'Bez sieci/mocy ≥ II (D5) nie ma centralizacji danych (D4) — Canon §7.3.',
  },
  D3: {
    requires: ['D7', 'D1'],
    note: 'Skalowanie kanałów/modeli bez cyber ≥ III (D7) to ryzyko niedopuszczalne; cyfrowy front na analogowym zapleczu (D1) się wywraca — Canon §7.3.',
  },
};
