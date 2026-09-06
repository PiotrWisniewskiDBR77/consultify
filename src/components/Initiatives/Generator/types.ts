/**
 * JEDEN generator inicjatyw (DEC-413) — kontrakt adapterów źródeł.
 *
 * Anatomia (numerowane kroki 1–5 na jednym ekranie, przycisk „Generuj
 * inicjatywy") pochodzi 1:1 z modalu Oceny —
 * `src/components/assessment/InitiativesGenerationWizardModal.tsx` — który
 * właściciel ocenił 06.09 jako „metodologicznie fantastyczny". Modal NIE wie
 * nic o module: całą wiedzę o tym, skąd brać listy i jaki endpoint wołać,
 * niesie adapter.
 *
 * Uwaga na uczciwość powierzchni: krok „template inicjatywy" pokazuje się
 * WYŁĄCZNIE dla adapterów, których serwer template'y naprawdę przyjmuje
 * (dziś: assessment). Rysowanie pola, którego backend ignoruje, byłoby
 * kłamstwem UI.
 */

/** Pozycja listy źródeł (ocena, wniosek, sesja narzędzia, program audytu…). */
export interface OpcjaZrodla {
  id: string;
  nazwa: string;
  opis?: string;
}

/** Kafel kroku 1 „Źródło danych". */
export interface TrybZrodla {
  wartosc: string;
  etykieta: string;
  opis: string;
}

/** Deskryptor jednego kroku wyboru (krok 2 = główny, krok 3 = wtórny). */
export interface KrokWyboru {
  etykieta: string;
  placeholder: string;
  /** true → checkboxy (np. wnioski z wywiadu, ustalenia audytu). */
  wielokrotny: boolean;
  /** Krok jest niewidoczny, gdy zwróci false (np. raport przy „Tylko Assessment"). */
  widoczny?: (tryb: string) => boolean;
  /** Pusty tekst, gdy krok zależy od wcześniejszego wyboru. */
  tekstBezPoprzednika?: string;
  lista: (ctx: { tryb: string; glowny: string[] }) => Promise<OpcjaZrodla[]>;
}

export interface PodgladInicjatywy {
  id: string;
  title: string;
  status: string;
}

export interface PostepBiegu {
  status: 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';
  generatedCount: number;
  requestedCount: number;
  batchesPlanned: number;
  batchesSucceeded: number;
  batchesFailed: number;
  error?: string | null;
}

/** Uchwyt do biegu asynchronicznego (dziś tylko Ocena — runId + odpytywanie). */
export interface UchwytBiegu {
  runId: string;
  kontekstId: string;
}

export type WynikStartu =
  /** Serwer uruchomił bieg w tle — modal odpytuje `postep`. */
  | { rodzaj: 'bieg'; uchwyt: UchwytBiegu }
  /** Serwer odpowiedział od razu gotowymi inicjatywami/propozycjami. */
  | { rodzaj: 'gotowe'; inicjatywy: PodgladInicjatywy[] };

export interface ArgumentyGeneracji {
  tryb: string;
  glowny: string[];
  wtorny: string[];
  templateId: string;
  methodologyId: string;
  liczba: number;
  includeChatContext: boolean;
  consultantBrief: string;
}

export interface AdapterGeneratora {
  id: 'assessment' | 'interview' | 'tool' | 'audit';
  etykieta: string;
  /** Kafle kroku 1. Assessment ma trzy (1:1 z dzisiejszym), reszta po jednym. */
  tryby: readonly TrybZrodla[];
  krokGlowny: KrokWyboru;
  krokWtorny?: KrokWyboru;
  /** Krok „template inicjatywy" — tylko gdy serwer go naprawdę przyjmuje. */
  wymagaTemplate: boolean;
  /** Wiersz „Metodologia + Liczba inicjatyw". */
  wymagaMetodologii: boolean;
  /** Górny limit pola „Liczba inicjatyw" (tools: twarde 7 w walidatorze zod). */
  maxLiczba: number;
  domyslnaLiczba: number;
  generuj: (a: ArgumentyGeneracji) => Promise<WynikStartu>;
  postep?: (u: UchwytBiegu) => Promise<PostepBiegu | null>;
  wynikBiegu?: (u: UchwytBiegu) => Promise<PodgladInicjatywy[]>;
  przeslijDoPrzegladu?: (u: UchwytBiegu) => Promise<number>;
}
