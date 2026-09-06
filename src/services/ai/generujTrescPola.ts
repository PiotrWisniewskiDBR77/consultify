/**
 * generujTrescPola — JEDEN generator treści pola dla całej aplikacji.
 *
 * DLACZEGO EKSTRAKCJA, A NIE NOWY GENERATOR (DEC-407, zasada 3 SSOT
 * `docs/ssot/STEROWANIE_KART_N_I_AI.md`): pozycja „Uzupełnij tę sekcję" /
 * „Uzupełnij cały dokument" w „Pracuj z AI" ma wołać ISTNIEJĄCY generator, a nie
 * dokładać siódmej ścieżki do modelu. Do 2026-09-06 ten kod (prompt + wywołanie
 * `POST /ai/refine-text` w trybie `generate`) mieszkał WYŁĄCZNIE wewnątrz
 * `AIFieldEnhancer.handleGenerate` — czyli był osiągalny tylko przez przycisk AI
 * przy pojedynczym polu. Ten plik przenosi go bit w bit na zewnątrz komponentu;
 * `AIFieldEnhancer` jest teraz jego pierwszym konsumentem, a `PracujZAI` drugim.
 *
 * ZAKAZ ZAPISU: funkcja ZWRACA tekst. Nie zna setterów karty i nie ma dostępu do
 * żadnego stanu — zapis może zrobić wyłącznie wołający, po zatwierdzeniu przez
 * człowieka (`ZASADY_AI_TERESA_SSOT` §3: „AI proposes. User reviews.").
 *
 * ZAKAZ ATRAPY: pusta odpowiedź modelu to BŁĄD (`EMPTY_AI_RESPONSE`), nigdy
 * treść wyprodukowana lokalnie — ta reguła kosztowała już jedną naprawę
 * (`fallbackRefineText`, usunięty 2026-07-23) i tu obowiązuje tak samo.
 *
 * @see src/components/shared/AIFieldEnhancer.tsx — poziom 2 (przycisk przy polu)
 * @see src/components/standard/PracujZAI.tsx     — poziom 1 (karta)
 */

import { Api } from '@/services/api';

/** Kontekst artefaktu wysyłany do promptu (1:1 z `AIFieldEnhancer`). */
export interface KontekstArtefaktuAI {
  title?: string;
  status?: string;
  priority?: string;
  /** Etykieta typu artefaktu, np. 'task', 'decision', 'initiative'. */
  type: string;
}

/** Oczekiwany kształt wyniku — steruje instrukcją formatu w prompcie. */
export type FormatWyjsciaAI = 'paragraph' | 'short' | 'list';

/** Błąd „AI odpowiedziało, ale pusto" — traktowany jak każda inna awaria AI. */
export function pustaOdpowiedzAI(): Error & { code?: string } {
  const err = new Error('Empty AI response') as Error & { code?: string };
  err.code = 'EMPTY_AI_RESPONSE';
  return err;
}

// Język wyjścia AI jest ustandaryzowany na angielski (zespoły międzynarodowe) —
// dokładnie ta sama decyzja co w `AIFieldEnhancer`; UI pozostaje lokalizowane.
const JEZYK_AI = 'en';
const NAZWA_JEZYKA_AI = 'English';

function instrukcjaFormatu(format: FormatWyjsciaAI): string {
  if (format === 'list') {
    return [
      `Format: return 5–8 distinct items.`,
      `- ONE item per line`,
      `- No bullets, no numbering, no markdown`,
      `- No empty lines`,
    ].join('\n');
  }
  if (format === 'short') {
    return [
      `Format: return ONE concise line (max ~12–16 words).`,
      `- No quotes, no markdown, no prefixes.`,
    ].join('\n');
  }
  return `Length: 2–4 sentences. Style: concrete, delivery-oriented, executive/PMO.`;
}

/**
 * Wygeneruj treść JEDNEGO pola od zera.
 *
 * @throws błąd transportu z backendu (kod w `err.data.code`) albo
 *         `EMPTY_AI_RESPONSE`. Wołający NIE MOŻE połknąć błędu i podstawić
 *         własnej treści — „AI niedostępne" jest poprawnym wynikiem.
 */
export async function generujTrescPola(opts: {
  /** Czytelna etykieta pola (idzie do promptu jako nazwa pola). */
  etykietaPola: string;
  kontekstArtefaktu: KontekstArtefaktuAI;
  format?: FormatWyjsciaAI;
}): Promise<string> {
  const { etykietaPola, kontekstArtefaktu, format = 'paragraph' } = opts;

  const systemInstruction = [
    `You are a senior PMO consultant and an expert business writer.`,
    kontekstArtefaktu.title
      ? `Generate professional content for the field "${etykietaPola}" in the context of the artifact "${kontekstArtefaktu.title}".`
      : `Generate professional content for the field "${etykietaPola}" of a "${kontekstArtefaktu.type}" artifact.`,
    `Rules:`,
    `- Output language MUST be ${NAZWA_JEZYKA_AI}. If the input/context is in another language, translate as needed.`,
    `- Do NOT invent new facts, numbers, dates, systems, or KPI values that are not present in the provided context. If information is missing, keep it generic and/or explicitly mark what needs confirmation in a single short sentence.`,
    `- Return ONLY the final field text. No commentary, no quotes, no prefixes, no markdown.`,
    instrukcjaFormatu(format),
  ].join('\n');

  const res = await Api.post('/ai/refine-text', {
    // Do promptu idą TYLKO pola, które faktycznie mamy — `|| 'draft'` wmawiałoby
    // modelowi status, którego karta nie ma (ta sama choroba co atrapa w wyniku).
    text: [
      `[GENERATE FROM SCRATCH]`,
      `Field: ${etykietaPola}`,
      kontekstArtefaktu.title
        ? `Artifact: ${kontekstArtefaktu.title} (${kontekstArtefaktu.type})`
        : `Artifact type: ${kontekstArtefaktu.type}`,
      kontekstArtefaktu.status ? `Status: ${kontekstArtefaktu.status}` : '',
      kontekstArtefaktu.priority ? `Priority: ${kontekstArtefaktu.priority}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    mode: 'generate',
    systemInstruction,
    fieldLabel: etykietaPola,
    artifactContext: kontekstArtefaktu,
    language: JEZYK_AI,
  });

  const tekst = String((res as { text?: unknown })?.text ?? '').trim();
  if (!tekst) throw pustaOdpowiedzAI();
  return tekst;
}

export default generujTrescPola;
