/**
 * deckChatBrief — wyprowadza brief prezentacji (audience · goal · tytuł) z prośby
 * użytkownika w czacie, zamiast hardkodować `audience:'internal'`/`goal:'inform'`.
 *
 * Kontekst (audyt 2026-07-22): ścieżka Teresy → deck budowała `DeckSetup` na
 * sztywno (`generateDeliverable.ts`), więc silnik NIGDY nie wiedział, że deck jest
 * „dla zarządu" / „do decyzji". Register `executive` (Narrative Engine,
 * `presentationGeneratorService.ts` ~1499) zapala się WYŁĄCZNIE dla
 * `audience==='executive'|'sponsor'` — hardkod `internal` gasił go zawsze.
 *
 * Ten moduł jest CZYSTY (bez I/O), deterministyczny i testowalny — wnioskowanie z
 * `intent` to sieć bezpieczeństwa działająca od zaraz; jeśli model poda `audience`/
 * `goal` jawnie przez narzędzie, te wartości WYGRYWAJĄ (patrz `resolveDeckBrief`).
 *
 * Mapujemy na enum `DeckSetup` (`sponsor|executive|investor|internal`,
 * `inform|decide|sell|align`) — celowo na wartości realnie zmieniające zachowanie
 * (executive-register / cel decyzyjny), nie na szersze etykiety UI kreatora.
 */

export type DeckAudience = 'sponsor' | 'executive' | 'investor' | 'internal';
export type DeckGoal = 'inform' | 'decide' | 'sell' | 'align';

/** Dopasowanie „całych słów" — diakrytyki PL zostają, granice na nie-literach. */
function hasAny(haystack: string, needles: string[]): boolean {
  const s = ` ${haystack.toLowerCase()} `;
  return needles.some((n) => s.includes(n));
}

/**
 * Odbiorca z tekstu prośby. Kolejność = priorytet (zarząd/komitet decyzyjny bije
 * ogólne „klient"). Nierozpoznane → 'internal' (dziś domyślne, bez regresji).
 */
export function inferDeckAudience(text: string): DeckAudience {
  const t = String(text || '');
  // Zarząd / komitet / c-level / rada → executive (zapala register 'executive').
  if (
    hasAny(t, [
      'zarząd',
      'zarzad',
      'zarządu',
      'zarzadu',
      'komitet',
      'rada nadzorcza',
      'radzie nadzorczej',
      'c-level',
      'clevel',
      'ceo',
      'cfo',
      'board',
      'steering',
      'executive',
      'leadership',
    ])
  ) {
    return 'executive';
  }
  // Inwestor / VC / fundusz → investor.
  if (
    hasAny(t, ['inwestor', 'inwestora', 'inwestorów', 'investor', ' vc ', 'venture', 'fundusz'])
  ) {
    return 'investor';
  }
  // Klient / oferta / sprzedaż → sponsor (zewnętrzny decydent; też zapala register executive).
  if (
    hasAny(t, ['klient', 'klienta', 'klientowi', 'client', 'customer', 'sponsor', 'zamawiając'])
  ) {
    return 'sponsor';
  }
  return 'internal';
}

/**
 * Cel prezentacji z tekstu. Kolejność = priorytet (decyzja/rekomendacja bije
 * „align"). Nierozpoznane → 'inform' (dzisiejsze domyślne).
 */
export function inferDeckGoal(text: string): DeckGoal {
  const t = String(text || '');
  if (
    hasAny(t, [
      'decyzj',
      'decyzy',
      'rekomendacj',
      'do zatwierdzenia',
      'zatwierdz',
      'akcept',
      'decide',
      'decision',
      'approve',
      'approval',
      'recommend',
      'go/no-go',
    ])
  ) {
    return 'decide';
  }
  if (
    hasAny(t, ['sprzedaż', 'sprzedazy', 'oferta', 'ofert', 'pitch', 'sell', 'sales', 'proposal'])
  ) {
    return 'sell';
  }
  if (
    hasAny(t, [
      'uzgodni',
      'uzgadnia',
      'align',
      'alignment',
      'konsensus',
      'wyrówna',
      'na jednej stronie',
    ])
  ) {
    return 'align';
  }
  return 'inform';
}

/**
 * Czysty tytuł decka z prośby. Ścina wiodące polecenie („zrób/przygotuj/stwórz
 * prezentację [dla …] [o/na temat/z] …"), żeby cover NIE był dosłownym poleceniem
 * („zrób prezentację dla zarządu z wyników pilota…"). Fail-soft: gdy po ścięciu
 * zostaje pusto, wraca oryginał (przycięty), nigdy pusty string.
 */
export function deriveDeckTitle(intent: string, rawTitle?: string): string {
  const explicit = String(rawTitle || '').trim();
  if (explicit) return explicit.slice(0, 200);

  let s = String(intent || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';

  // Zdejmij wiodący czasownik-polecenie + rzeczownik „prezentacja/deck/slajdy".
  const leadVerb =
    /^(zrób|zrob|przygotuj|stwórz|stworz|utwórz|utworz|wygeneruj|napisz|przygotujmy|zróbmy|zrobmy|make|create|prepare|build|generate|draft|put together)\s+/i;
  s = s.replace(leadVerb, '');
  const deckNoun =
    /^(mi\s+|nam\s+)?(a\s+|an\s+|the\s+)?(prezentacj[ęea]|prezentacyjn[ąa]|deck|slajd[yów]*|slides?|presentation)\s+/i;
  s = s.replace(deckNoun, '');
  // Zdejmij wiodącą klauzulę ODBIORCY („dla/for <ktoś> …") aż do łącznika tematu
  // lub myślnika/dwukropka — inaczej „dla zarządu"/„for the board" wchodzi w tytuł.
  const topicConnector =
    '(?:o\\s+|na\\s+temat\\s+|z\\s+|ze\\s+|dotycząc\\w*\\s+|dot\\.\\s*|w\\s+sprawie\\s+|about\\s+|on\\s+|regarding\\s+|to\\s+\\w+\\s+(?:on|about|for)\\s+)';
  s = s.replace(new RegExp(`^(?:dla|for)\\s+[^—:,]{1,40}?\\s+${topicConnector}`, 'i'), '');
  s = s.replace(/^(?:dla|for)\s+[^—:]{1,40}?\s*[—:]\s*/i, '');
  // Zdejmij ewentualny goły łącznik tematu na początku.
  s = s.replace(new RegExp(`^${topicConnector}`, 'i'), '');

  s = s.trim();
  // Kapitalizacja pierwszej litery (bez psucia akronimów w środku).
  if (s) s = s.charAt(0).toUpperCase() + s.slice(1);

  const fallback = String(intent || '')
    .replace(/\s+/g, ' ')
    .trim();
  return (s || fallback).slice(0, 120);
}

/**
 * Czytelna ETYKIETA odbiorcy (dla dokumentów Word — `documentBlockProseGenerator`
 * wstawia `schema.audience.join(', ')` wprost do promptu „written for the
 * audience: …"). Zwraca ludzki label albo `null` (caller → fallback „internal
 * stakeholders"). Odróżnij od `inferDeckAudience`, które mapuje na enum silnika deck.
 */
export function inferAudienceLabel(text: string, isPolish = true): string | null {
  const a = inferDeckAudience(text);
  switch (a) {
    case 'executive':
      return isPolish ? 'zarząd' : 'the board / executives';
    case 'investor':
      return isPolish ? 'inwestorzy' : 'investors';
    case 'sponsor':
      return isPolish ? 'klient' : 'the client';
    default:
      return null; // 'internal' — brak wyraźnego sygnału, nie zgaduj
  }
}

export interface DeckBriefOverrides {
  audience?: string;
  goal?: string;
  title?: string;
}

export interface ResolvedDeckBrief {
  audience: DeckAudience;
  goal: DeckGoal;
  title: string;
  /** Skąd wzięto audience/goal — do logu/telemetrii i harnessu. */
  audienceSource: 'model' | 'inferred';
  goalSource: 'model' | 'inferred';
}

const AUDIENCE_ENUM: DeckAudience[] = ['sponsor', 'executive', 'investor', 'internal'];
const GOAL_ENUM: DeckGoal[] = ['inform', 'decide', 'sell', 'align'];

/** Normalizuje audience podany przez model (może użyć etykiet kreatora). */
function coerceAudience(raw?: string): DeckAudience | null {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (!v) return null;
  if ((AUDIENCE_ENUM as string[]).includes(v)) return v as DeckAudience;
  // Etykiety kreatora / naturalne → enum silnika.
  if (v === 'board' || v === 'zarząd' || v === 'zarzad' || v === 'leadership') return 'executive';
  if (v === 'client' || v === 'klient' || v === 'customer' || v === 'project_team')
    return v === 'project_team' ? 'internal' : 'sponsor';
  return inferDeckAudience(v);
}

function coerceGoal(raw?: string): DeckGoal | null {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (!v) return null;
  if ((GOAL_ENUM as string[]).includes(v)) return v as DeckGoal;
  if (v === 'educate') return 'inform';
  return inferDeckGoal(v);
}

/**
 * Ustala brief decka: jawne wartości od modelu WYGRYWAJĄ, inaczej wnioskujemy z
 * `intent`. Tytuł: `overrides.title` → oczyszczony `intent`.
 */
export function resolveDeckBrief(
  intent: string,
  overrides: DeckBriefOverrides = {}
): ResolvedDeckBrief {
  const modelAudience = coerceAudience(overrides.audience);
  const modelGoal = coerceGoal(overrides.goal);
  return {
    audience: modelAudience ?? inferDeckAudience(intent),
    goal: modelGoal ?? inferDeckGoal(intent),
    title: deriveDeckTitle(intent, overrides.title),
    audienceSource: modelAudience ? 'model' : 'inferred',
    goalSource: modelGoal ? 'model' : 'inferred',
  };
}
