/**
 * Odbiór na żywo 05.09 (04-narzędzia, defekt 7 „tools-sesja-wyjście"):
 * kebab „Więcej" w nagłówku sesji narzędzia miał WYŁĄCZNIE „Skopiuj kod
 * obiektu" i „Kopiuj link". Wyjść z sesji dało się tylko strzałką „<"
 * w nagłówku albo chipem „Lista" w Menu 3 — nie tam, gdzie użytkownik szuka.
 *
 * Czego tu ŚWIADOMIE NIE MA — „wstrzymaj sesję": słownik statusów sesji
 * narzędzia (src/domain/toolStatus.ts) ma dziewięć stanów (draft, in_progress,
 * in_review, approved, generated, finalized, superseded, failed, unknown)
 * i ANI JEDNEGO wstrzymanego. Backend nie ma czego zapisać, więc pozycja
 * „Wstrzymaj" byłaby przyciskiem bez skutku. Potrzebna najpierw decyzja
 * produktowa i pole w danych.
 *
 * Czego tu NIE MA z drugiego powodu — „Zakończ/Finalizuj": te akcje stoją
 * w Menu 3 i w prawym panelu AKCJE. Kanon Menu 1 (TRIADA, nota D-01
 * w AssessmentHub) traktuje powtórzenie akcji z innego menu jako defekt,
 * więc kebab ich nie dubluje.
 */
import type { NModeHeaderOverflowItem } from '@/components/shared/NModeLayout/types';

export function buildToolSessionOverflowItems(params: {
  onBack: () => void;
  isPolish: boolean;
  exitIcon: NModeHeaderOverflowItem['icon'];
}): NModeHeaderOverflowItem[] {
  const { onBack, isPolish, exitIcon } = params;
  return [
    {
      id: 'exit-session',
      label: isPolish ? 'Wyjdź z sesji' : 'Leave session',
      icon: exitIcon,
      onClick: onBack,
      title: isPolish
        ? 'Wraca do listy sesji; postęp zostaje zapisany'
        : 'Back to the session list; progress stays saved',
    },
  ];
}
