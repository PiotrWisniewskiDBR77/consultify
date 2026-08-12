/**
 * detectMessageLanguage
 *
 * Lightweight, dependency-free heuristic that infers the language of a chat
 * message so the assistant can reply in the language the user actually writes
 * in — not the UI language. Covers the app's supported languages
 * (en, pl, de, es, ar, ja).
 *
 * Design goals:
 * - High precision over recall: return `null` when not confident, so callers
 *   fall back to the existing chatLanguage resolution (explicit selector /
 *   conversation language / UI language). A wrong guess is worse than no guess.
 * - Script-based detection first (Arabic / Japanese) — effectively certain.
 * - Unique Latin diacritics next (Polish ąćęłńśźż, German ß, Spanish ñ¿¡).
 * - Stopword scoring last to separate pl / de / es / en on plain-ASCII text.
 */
import type { SupportedLanguage } from '../i18n';

const STOPWORDS: Record<'pl' | 'de' | 'es' | 'en', string[]> = {
  pl: [
    'nie',
    'się',
    'jest',
    'czy',
    'jak',
    'dla',
    'oraz',
    'że',
    'do',
    'na',
    'co',
    'coś',
    'mi',
    'mnie',
    'proszę',
    'dziękuję',
    'opowiedz',
    'powiedz',
    'jakie',
    'jaki',
    'dlaczego',
    'gdzie',
    'kiedy',
    'tak',
    'tylko',
    'bardzo',
    'może',
    'już',
    'ale',
    'więc',
    'jestem',
    'masz',
    'mam',
    'zrób',
    'napisz',
    'pokaż',
    // Rozszerzenie recall PL (UWAGA #4): wysokoczęstotliwościowe, jednoznacznie
    // polskie słowa funkcyjne/komendy spoza list de/es/en — bez ryzyka kolizji.
    'jako',
    'lub',
    'albo',
    'przez',
    'pod',
    'nad',
    'przy',
    'wszystko',
    'teraz',
    'dzisiaj',
    'jutro',
    'daj',
    'pomóż',
    'stwórz',
    'przygotuj',
    'wygeneruj',
    'opracuj',
    'wyjaśnij',
    'chcę',
    'muszę',
    'potrzebuję',
    'mój',
    'moja',
    'moje',
    'nasz',
    'twoje',
  ],
  de: [
    'der',
    'die',
    'das',
    'und',
    'ist',
    'nicht',
    'ein',
    'eine',
    'mit',
    'für',
    'auf',
    'wie',
    'was',
    'ich',
    'sie',
    'wir',
    'aber',
    'auch',
    'noch',
    'sehr',
    'bitte',
    'danke',
    'warum',
    'wann',
    'kannst',
    'mir',
    'mich',
    'haben',
  ],
  es: [
    'el',
    'la',
    'los',
    'las',
    'una',
    'que',
    'para',
    'con',
    'por',
    'como',
    'qué',
    'hola',
    'gracias',
    'dónde',
    'cuándo',
    'porque',
    'pero',
    'muy',
    'este',
    'esta',
    'sobre',
    'cuál',
    'puedes',
    'dame',
    'quiero',
  ],
  en: [
    'the',
    'and',
    'is',
    'are',
    'what',
    'how',
    'please',
    'tell',
    'me',
    'about',
    'do',
    'you',
    'your',
    'this',
    'that',
    'with',
    'for',
    'why',
    'where',
    'when',
    'which',
    'can',
    'give',
    'show',
    'write',
    'explain',
  ],
};

const score = (tokens: Set<string>, words: string[]): number =>
  words.reduce((n, w) => n + (tokens.has(w) ? 1 : 0), 0);

/**
 * Returns a confident SupportedLanguage for the message, or `null` when the
 * signal is too weak to override the caller's existing language resolution.
 */
export function detectMessageLanguage(raw: string): SupportedLanguage | null {
  const text = (raw || '').trim();
  if (text.length < 2) return null;

  // 1. Script-based — effectively certain.
  if (/[؀-ۿݐ-ݿ]/.test(text)) return 'ar';
  if (/[぀-ヿㇰ-ㇿｦ-ﾝ一-鿿]/.test(text)) return 'ja';

  const lower = text.toLowerCase();

  // 2. Unique Latin diacritics — strong single-character signals.
  if (/[ąćęłńśźż]/.test(lower)) return 'pl';
  if (/[ß]/.test(lower)) return 'de';
  if (/[ñ¿¡]/.test(lower)) return 'es';

  // 3. Stopword scoring for the plain-ASCII Latin languages.
  const tokens = new Set(lower.split(/[^a-zà-ÿąćęłńśźż]+/).filter(Boolean));
  const scores: Record<'pl' | 'de' | 'es' | 'en', number> = {
    pl: score(tokens, STOPWORDS.pl),
    de: score(tokens, STOPWORDS.de),
    es: score(tokens, STOPWORDS.es),
    en: score(tokens, STOPWORDS.en),
  };

  const ranked = (Object.entries(scores) as Array<['pl' | 'de' | 'es' | 'en', number]>).sort(
    (a, b) => b[1] - a[1]
  );
  const [topLang, topScore] = ranked[0];
  const secondScore = ranked[1][1];

  // Need a clear winner. Two unambiguous hits, or one hit on a short message.
  if (topScore >= 2 && topScore > secondScore) return topLang;
  // UWAGA #4: pojedyncze trafienie słowa unikalnego dla danego języka, przy
  // ZERO trafień konkurentów, to pewny sygnał (listy są wzajemnie rozłączne —
  // nieliczne współdzielone partykuły remisują i są odsiewane przez
  // topScore > secondScore). Ratuje krótkie polskie otwarcia („zrób raport",
  // „pokaż wynik") niezależnie od długości, które wcześniej spadały do UI (EN).
  if (topScore >= 1 && secondScore === 0) return topLang;
  if (topScore >= 1 && topScore > secondScore && tokens.size <= 4) return topLang;
  return null;
}
