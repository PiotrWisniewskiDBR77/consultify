/**
 * materialFeedbackLoop (F10.4) — pętla zwrotna: materiał → artefakty.
 *
 * Materiał (deck/raport) zawiera REKOMENDACJE. Zamiast martwego tekstu —
 * zamieniamy je w śledzone INICJATYWY z linkiem zwrotnym do materiału. System
 * się „uczy": rekomendacja → inicjatywa → wykonanie → wynik → kolejny materiał.
 *
 * Ten moduł: ekstrakcja rekomendacji z sekcji materiału + mapowanie na „stuby"
 * inicjatyw (gotowe do utworzenia w M13). Czyste funkcje, nigdy nie rzucają.
 */

export interface MaterialSectionLike {
  /** Intencja/typ sekcji (np. 'recommendations', 'next_steps'). */
  intent?: string;
  title?: string;
  /** Pozycje listy (rekomendacje) jeśli sekcja je niesie. */
  items?: string[];
  /** Albo proza — z której wyłuskujemy zdania-rekomendacje. */
  text?: string;
}

export interface Recommendation {
  text: string;
  /** Skąd pochodzi (tytuł sekcji). */
  sourceSection?: string;
}

// Intencje sekcji niosące rekomendacje.
const RECOMMENDATION_INTENTS = new Set([
  'recommendations',
  'recommendation_single',
  'recommendation_portfolio',
  'next_steps',
]);

// Czasowniki rozpoczynające zdanie-rekomendację (PL imperatyw / „należy/warto").
const RECOMMENDATION_CUE =
  /^(należy|warto|trzeba|rekomenduj|zaleca|wdroż|powoła|uruchom|zbuduj|przeprowadź|wprowadź|rozważ|priorytetyzuj|skonsoliduj|zautomatyzuj)/i;

/** Wyłuskaj rekomendacje z sekcji materiału (listy + zdania z prozy). */
export function extractRecommendations(sections: MaterialSectionLike[]): Recommendation[] {
  const out: Recommendation[] = [];
  for (const s of sections) {
    const isRecoSection = s.intent ? RECOMMENDATION_INTENTS.has(s.intent) : false;

    if (Array.isArray(s.items)) {
      for (const item of s.items) {
        const t = String(item ?? '').trim();
        if (!t) continue;
        // W sekcji rekomendacyjnej bierzemy wszystkie pozycje; poza nią tylko te z cue.
        if (isRecoSection || RECOMMENDATION_CUE.test(t)) {
          out.push({ text: t, sourceSection: s.title });
        }
      }
    }

    if (s.text) {
      const sentences = s.text.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
      for (const sent of sentences) {
        if (RECOMMENDATION_CUE.test(sent)) {
          out.push({ text: sent, sourceSection: s.title });
        }
      }
    }
  }
  return out;
}

export interface InitiativeStub {
  title: string;
  description: string;
  status: 'proposed';
  /** Link zwrotny do materiału (artefakt źródłowy). */
  sourceMaterialId: string;
  sourceSection?: string;
}

/** Skróć rekomendację do zwięzłego tytułu inicjatywy (≤80 znaków). */
function toTitle(text: string): string {
  const firstClause = text.split(/[:–—.]/)[0].trim();
  const t = firstClause.length > 0 ? firstClause : text.trim();
  return t.length > 80 ? `${t.slice(0, 77).trimEnd()}…` : t;
}

/**
 * Zamień rekomendacje na stuby inicjatyw z linkiem zwrotnym do materiału.
 * Dedupe po tytule (te same rekomendacje → jedna inicjatywa).
 */
export function toInitiativeStubs(
  recommendations: Recommendation[],
  sourceMaterialId: string
): InitiativeStub[] {
  const seen = new Set<string>();
  const stubs: InitiativeStub[] = [];
  for (const r of recommendations) {
    const title = toTitle(r.text);
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    stubs.push({
      title,
      description: r.text,
      status: 'proposed',
      sourceMaterialId,
      sourceSection: r.sourceSection,
    });
  }
  return stubs;
}

/** Wygodny skrót: sekcje materiału → stuby inicjatyw (cała pętla). */
export function materialToInitiativeStubs(
  sections: MaterialSectionLike[],
  sourceMaterialId: string
): InitiativeStub[] {
  return toInitiativeStubs(extractRecommendations(sections), sourceMaterialId);
}
