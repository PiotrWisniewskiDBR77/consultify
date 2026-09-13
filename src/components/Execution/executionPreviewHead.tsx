/**
 * executionPreviewHead — GÓRA podglądu (bloki 1–2) dla całego modułu Realizacja.
 *
 * K5-5 (odbiór właściciela na stagingu `cf3fded7e4`, Realizacja → Work,
 * podgląd zadania): „tutaj preview też na górze nie jest zgodne".
 *
 * CO BYŁO NIEZGODNE (pomiar na 10 deklaracjach podglądu Realizacji):
 *  · `meta.recommendation` niósł ZDANIE — instrukcję albo opis („Check
 *    completeness and the next step.", „Finish preparing the report",
 *    „Overdue by 17 days — resolve or escalate."). `TABLE_AND_PREVIEW_CANON.md`
 *    §7.3 pkt 2 mówi o bloku 2 jednoznacznie: „statusy/typ/sesje/priorytet/
 *    SLA/data — to STAN, nie treść". Zdanie w bloku 2 to treść.
 *  · `meta.trailing` niósł numer wersji (`v0`, `v3`) zamiast TERMINU, mimo że
 *    kanon nazywa tę strefę „termin (trailing)" — a dla zadań `version` jest
 *    zaszyte na 0 (`ExecutionWorkSurface.tsx`), więc właściciel oglądał „v0"
 *    jako jedyną informację po prawej stronie karty meta.
 *  · trailing miał za każdym razem inne klasy (`text-xs`, `text-xs
 *    text-c-text-muted`), choć zaakceptowany wzorzec (Inicjatywy 2026-09-13,
 *    bank Realizacji DEC-491) ma jedne: `text-[11px] font-semibold
 *    text-c-text-secondary`.
 *
 * DLACZEGO BUDOWNICZY, A NIE POPRAWKA PER EKRAN: to jest dokładnie ten defekt,
 * o którym mówi pamięć „naprawa per-wywołanie odrasta" — ta sama reguła
 * złamana w dziesięciu miejscach wraca, jeśli poprawić dziesięć miejsc zamiast
 * jednego. Tutaj powłoka NARZUCA kształt: ekran deklaruje `pills`/`term`/
 * `stateLine`/`nextStep`, a kształt bloku 2 (co wolno, gdzie i jakimi klasami)
 * mieszka w jednym pliku.
 *
 * ZDANIE NIE GINIE — WĘDRUJE. Sanitizer nie kasuje prozy wstawionej w
 * `stateLine`: przenosi ją do dopisku bloku „Co dalej" (ten sam zabieg, którym
 * `executionBankPreviewDeclaration.tsx` rozwiązał „następny krok bez wołacza").
 * Dzięki temu poprawka jest addytywna informacyjnie: blok 2 przestaje być
 * akapitem, a treść dalej jest na ekranie — tyle że w bloku, który o niej mówi.
 */
import React from 'react';

import type {
  MetaPill,
  StandardPreviewMeta,
  StandardPreviewWhatsNext,
} from '@/components/standard/StandardPreview';

/** Termin / data — prawa strona karty meta (kanon §7.3 pkt 2). */
export interface ExecutionPreviewTerm {
  /** Krótka etykieta, np. „Due", „Data as of", „Needed by". */
  label: string;
  /** Wartość — data albo nazwany brak („No due date"). */
  value: string;
}

export interface ExecutionPreviewHeadInput {
  /** Blok 2 — chipy STANU (status, rodzaj, poziom, wersja). */
  pills: MetaPill[];
  /** Blok 2 — termin po prawej. `null`/brak ⇒ strefa pominięta. */
  term?: ExecutionPreviewTerm | null;
  /**
   * Blok 2 — jedna KRÓTKA linia stanu pod chipami (np. „Updated 12/09/2026").
   * Proza trafia stąd do dopisku „Co dalej" — patrz `czyProza`.
   */
  stateLine?: string | null;
  /** Blok „Co dalej" — zdanie o następnym kroku. */
  nextStep?: string | null;
  /** Nagłówek bloku „Co dalej" (domyślnie tłumaczenie `common.whatsNext`). */
  whatsNextLabel?: string;
}

export interface ExecutionPreviewHead {
  meta: StandardPreviewMeta;
  whatsNext?: StandardPreviewWhatsNext;
}

/**
 * Próg prozy — GRANICA WZIĘTA Z POMIARU, nie z wyczucia.
 *
 * Blok 2 wolno zapisać ETYKIETĄ STANU albo ZMIERZONĄ WARTOŚCIĄ; wszystko inne
 * jest akapitem i należy do innego bloku. Reguła (w tej kolejności):
 *  1. kropka / wykrzyknik / pytajnik albo myślnik zdaniowy („ — ", „ - ") —
 *     to interpunkcja zdania, nie etykiety;
 *  2. dłuższe niż 48 znaków — akapit, choćby bez kropki;
 *  3. więcej niż 3 słowa BEZ zmierzonej wartości (cyfry lub „%").
 *
 * Punkt 3 jest tym, który odróżnia dwa napisy realnie zastane w podglądach
 * Realizacji: „Days overdue 19" i „Progress 45%" NIOSĄ pomiar (zostają),
 * a „Finish preparing the report" — cztery słowa, zero pomiaru — jest
 * poleceniem (wędruje do „Co dalej"). Bez tej gałęzi samo liczenie znaków
 * przepuszczało polecenia krótsze od 48 znaków.
 */
const MAX_DLUGOSC_STANU = 48;
const MAX_SLOW_ETYKIETY = 3;

export function czyProza(tekst: string): boolean {
  const t = tekst.trim();
  if (!t) return false;
  if (/[.!?]/.test(t)) return true;
  if (t.includes(' — ') || t.includes(' - ')) return true;
  if (t.length > MAX_DLUGOSC_STANU) return true;
  if (t.split(/\s+/).length <= MAX_SLOW_ETYKIETY) return false;
  return !/[0-9%]/.test(t);
}

/**
 * Trailing bloku 2 — JEDNE klasy dla całego modułu. Bajt-w-bajt te same, co w
 * podglądzie Inicjatyw (`CanonicalInitiativeRegister.tsx`) i banku Realizacji
 * (`executionBankPreviewDeclaration.tsx`), czyli w dwóch podglądach, które
 * właściciel widział i przyjął.
 */
export const EXECUTION_PREVIEW_TRAILING_CLASS = 'text-[11px] font-semibold text-c-text-secondary';

export function buildExecutionPreviewHead({
  pills,
  term,
  stateLine,
  nextStep,
  whatsNextLabel,
}: ExecutionPreviewHeadInput): ExecutionPreviewHead {
  const dopiski: string[] = [];

  const stan = stateLine?.trim() ? stateLine.trim() : null;
  const stanKanoniczny = stan && !czyProza(stan) ? stan : null;
  if (stan && !stanKanoniczny) dopiski.push(stan);
  if (nextStep?.trim()) dopiski.push(nextStep.trim());

  const meta: StandardPreviewMeta = {
    pills,
    ...(term
      ? {
          trailing: (
            <span className={EXECUTION_PREVIEW_TRAILING_CLASS}>
              {term.label} {term.value}
            </span>
          ),
        }
      : {}),
    ...(stanKanoniczny ? { recommendation: stanKanoniczny } : {}),
  };

  if (dopiski.length === 0) return { meta };

  return {
    meta,
    whatsNext: {
      ...(whatsNextLabel ? { label: whatsNextLabel } : {}),
      note: dopiski.join(' '),
      items: [],
    },
  };
}

export default buildExecutionPreviewHead;
