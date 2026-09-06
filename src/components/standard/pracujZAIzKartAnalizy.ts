/**
 * pracujZAIzKartAnalizy — most między ISTNIEJĄCĄ deklaracją pól karty
 * (`CardAnalysisField` + `onApplyChange` z ETAPU 3 „Analizuj z AI") a nowym
 * wejściem „Pracuj z AI → Uzupełnij…" (DEC-407).
 *
 * DLACZEGO MOST, A NIE NOWY KONTRAKT: cztery karty (Zadanie, Decyzja,
 * Powiadomienie, Wniosek) już deklarują dla analizy DOKŁADNIE to, czego
 * potrzebuje uzupełnianie: jakie pola sekcja ma, jaka jest ich treść i które
 * z nich wolno zapisać (`writable`) — plus JEDNĄ drogę zapisu (`applyChange`).
 * Budowanie drugiej deklaracji obok tej pierwszej dałoby dwie prawdy o tej
 * samej karcie i naprawę „po jednej powierzchni" przy każdej zmianie sekcji.
 *
 * ZAKAZ ZAPISU BEZ ZATWIERDZENIA: ten plik NIE woła `applyChange`. Zwraca
 * `ZrodloUzupelnienia`, którego `zastosuj` odpala wyłącznie `PracujZAI` po
 * kliknięciu „Zatwierdź".
 */

import type { CardAnalysisChange, CardAnalysisField } from '@/services/cardAnalysis';

import type { PoleDoUzupelnienia, ZrodloUzupelnienia } from './PracujZAI.types';

export interface SekcjaKarty {
  id: string;
  label: { en: string; pl: string };
}

export interface MostPracujZAIOpcje {
  /** Sekcje karty w kolejności nawigacji (do „Uzupełnij cały dokument"). */
  sekcje: SekcjaKarty[];
  /** Ta sama funkcja, która karmi „Analizuj z AI" dla danej sekcji. */
  polaSekcji: (sekcjaId: string) => CardAnalysisField[];
  /** Jedyna droga zapisu karty (`useCardAIAnalysis.applyChange`). */
  applyChange: (change: CardAnalysisChange) => boolean;
  isPolish: boolean;
}

function naPole(
  pole: CardAnalysisField,
  sekcja: SekcjaKarty | undefined,
  isPolish: boolean
): PoleDoUzupelnienia {
  return {
    id: pole.id,
    etykieta: pole.label,
    wartosc: String(pole.value ?? ''),
    format: pole.kind === 'list' ? 'list' : 'paragraph',
    sekcjaId: sekcja?.id,
    sekcjaEtykieta: sekcja ? (isPolish ? sekcja.label.pl : sekcja.label.en) : undefined,
  };
}

/**
 * Buduje oba źródła („ta sekcja" i „cały dokument") z jednej deklaracji karty.
 *
 * Pola `writable: false` (zależności, dowody, alternatywy — fakty i wybory, nie
 * proza) są ODFILTROWANE: karta jawnie powiedziała, że nie potrafi tam zapisać,
 * więc proponowanie treści do nich byłoby obietnicą bez pokrycia.
 */
export function zbudujZrodlaPracujZAI(opcje: MostPracujZAIOpcje): {
  sekcja: ZrodloUzupelnienia;
  dokument: ZrodloUzupelnienia;
} {
  const { sekcje, polaSekcji, applyChange, isPolish } = opcje;

  const zastosuj = (poleId: string, wartosc: string): boolean =>
    applyChange({
      id: `pracuj-z-ai-${poleId}`,
      fieldId: poleId,
      fieldLabel: poleId,
      rationale: isPolish
        ? 'Uzupełnienie pustego pola przez „Pracuj z AI".'
        : 'Empty field filled in via "Work with AI".',
      currentValue: '',
      proposedValue: wartosc,
      // `replace` na PUSTYM polu — „Pracuj z AI" nie dotyka pól z treścią,
      // więc nie ma czego dopisywać (append) ani czego nadpisać.
      mode: 'replace',
      severity: 'medium',
    });

  const polaZakresu = (sekcjaId: string | null, caly: boolean): PoleDoUzupelnienia[] => {
    const idsDoObjecia = caly
      ? sekcje.map((s) => s.id)
      : sekcjaId
        ? [sekcjaId]
        : [];
    return idsDoObjecia.flatMap((id) =>
      polaSekcji(id)
        .filter((p) => p.writable)
        .map((p) => naPole(p, sekcje.find((s) => s.id === id), isPolish))
    );
  };

  return {
    sekcja: {
      rodzaj: 'pola',
      pola: ({ sekcjaId }) => polaZakresu(sekcjaId, false),
      zastosuj,
    },
    dokument: {
      rodzaj: 'pola',
      pola: () => polaZakresu(null, true),
      zastosuj,
    },
  };
}

export default zbudujZrodlaPracujZAI;
