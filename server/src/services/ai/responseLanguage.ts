/**
 * responseLanguage — JEDNO wspólne miejsce ustalania języka odpowiedzi AI.
 *
 * Defekt, który to naprawia: użytkownik pracuje po polsku (mapa „Wejście na rynek
 * DACH"), a panel AI Blind Spots zwracał analizę po angielsku. Przyczyna była
 * podwójna:
 *   1. źródłem języka była WYŁĄCZNIE flaga interfejsu (`i18n.language`), która przy
 *      polskiej treści potrafi być `en` — wtedy prompt szedł w wariancie angielskim;
 *   2. prompt nie zawierał JAWNEJ instrukcji „odpowiadaj w języku treści", więc nawet
 *      polski prompt nie gwarantował polskiej odpowiedzi.
 *
 * Reguła: TREŚĆ WYGRYWA Z USTAWIENIEM UI. Jeżeli materiał użytkownika (tytuł, seed,
 * etykiety węzłów) jest rozpoznawalnie polski/angielski — odpowiadamy w tym języku.
 * Dopiero gdy treść nie rozstrzyga, sięgamy po flagę UI, a na końcu po `en`.
 */

export type ResponseLanguage = 'pl' | 'en';

/** Polskie znaki diakrytyczne — najmocniejszy pojedynczy sygnał. */
const PL_DIACRITICS = /[ąćęłńóśźż]/i;

/** Polskie słowa funkcyjne + typowe słowa biznesowe (dopasowanie po granicy słowa). */
const PL_MARKERS =
  /(^|[^\p{L}])(i|w|we|na|do|od|nie|tak|jest|są|być|dla|oraz|albo|lub|że|się|przez|pod|nad|przy|po|za|ten|ta|to|te|który|która|które|jak|czy|ale|już|może|mamy|nasz|nasza|nasze|rynek|rynku|wejście|klient|klienci|klientów|firma|firmy|koszt|koszty|ryzyko|ryzyka|cel|cele|produkt|sprzedaż|wdrożenie|analiza|proces|dane|zespół|plan|etap|etapy)([^\p{L}]|$)/giu;

/** Angielskie słowa funkcyjne — kontrsygnał, żeby nie polonizować tekstów EN. */
const EN_MARKERS =
  /(^|[^\p{L}])(the|and|of|to|for|with|is|are|be|this|that|these|those|from|into|about|our|your|their|which|what|how|market|customer|customers|company|cost|costs|risk|risks|goal|goals|product|sales|rollout|analysis|process|data|team|plan|stage|stages)([^\p{L}]|$)/giu;

function countMatches(text: string, re: RegExp): number {
  // RegExp z flagą /g trzyma stan lastIndex — liczymy przez match(), nie exec().
  const m = text.match(re);
  return m ? m.length : 0;
}

/**
 * Rozpoznaje język próbek TREŚCI użytkownika.
 * Zwraca `null`, gdy sygnał jest zbyt słaby, żeby cokolwiek rozstrzygać
 * (za krótko / same nazwy własne / cyfry) — wtedy decyduje flaga UI.
 */
export function detectTextLanguage(
  samples: Array<string | null | undefined>
): ResponseLanguage | null {
  const text = samples
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(' \n ')
    .slice(0, 4000);

  if (text.replace(/[^\p{L}]/gu, '').length < 12) return null;

  const plHits = countMatches(text, PL_MARKERS) + (PL_DIACRITICS.test(text) ? 3 : 0);
  const enHits = countMatches(text, EN_MARKERS);

  if (plHits >= 2 && plHits > enHits) return 'pl';
  if (enHits >= 2 && enHits > plHits) return 'en';
  return null;
}

/**
 * Ustala język odpowiedzi AI: treść → flaga UI → 'en'.
 *
 * @param requested wartość z żądania (zwykle `i18n.language` klienta)
 * @param samples   materiał użytkownika: tytuł, seed, etykiety węzłów, komendy
 */
export function resolveResponseLanguage(params: {
  requested?: string | null;
  samples?: Array<string | null | undefined>;
}): ResponseLanguage {
  const fromContent = detectTextLanguage(params.samples || []);
  if (fromContent) return fromContent;

  const requested = String(params.requested || '')
    .toLowerCase()
    .trim();
  if (requested.startsWith('pl')) return 'pl';
  return 'en';
}

/**
 * JAWNA instrukcja językowa doklejana do system promptu.
 * Bez niej model potrafi odpowiedzieć po angielsku nawet na polski prompt.
 */
export function languageInstruction(lang: ResponseLanguage): string {
  return lang === 'pl'
    ? 'JĘZYK ODPOWIEDZI (BEZWZGLĘDNIE): odpowiadaj WYŁĄCZNIE po polsku. Wszystkie wartości tekstowe w JSON — tytuły, opisy, uzasadnienia, etykiety — muszą być po polsku. Klucze JSON i wartości enum zostaw po angielsku. Nie tłumacz nazw własnych ani terminów, których użytkownik użył w swoim materiale.'
    : 'RESPONSE LANGUAGE (STRICT): respond ONLY in English. All text values in the JSON — titles, descriptions, rationales, labels — must be in English. Keep JSON keys and enum values in English as defined. Do not translate proper nouns or terms the user used in their own material.';
}

/**
 * Skrót: doklej instrukcję językową do istniejącego system promptu.
 * Instrukcja idzie NA KONIEC — ostatnia sekcja ma największą siłę wiążącą.
 */
export function withLanguageInstruction(systemPrompt: string, lang: ResponseLanguage): string {
  return `${systemPrompt}\n\n${languageInstruction(lang)}`;
}
