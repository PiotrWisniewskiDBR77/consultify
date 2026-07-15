import type { ShortcutHelp } from '../hooks/useKeyboardShortcuts';

export type WhiteboardMode = 'board' | 'draw';

export interface WhiteboardModeCopy {
  modeLabel: string;
  toggleLabel: string;
  helper: string;
  exitHint: string;
}

// NOTE (i18n sweep): this module is intentionally NOT routed through i18next's
// `t()`. It is a pure helper that takes `isPolish` as an explicit, caller-supplied
// selector (not the ambient i18n language), and `tests/unit/mywork/
// whiteboardInteractionGrammar.test.ts` asserts on the exact PL/EN copy returned
// for a given `isPolish` value. Importing the real `@/i18n` singleton here (which
// calls `.use(initReactI18next)` at module load) would crash the narrow-mock
// component tests and break these literal-string assertions. Mirrors the sibling
// exception in `../mindmap/mindmapInteractionGrammar.ts`.
export function getWhiteboardModeCopy(
  mode: WhiteboardMode,
  isPolish: boolean,
  locked: boolean
): WhiteboardModeCopy {
  if (mode === 'draw') {
    return {
      modeLabel: isPolish ? 'Tryb rysowania' : 'Draw mode',
      toggleLabel: isPolish ? 'Canvas' : 'Canvas',
      helper: isPolish
        ? 'Rysujesz po warstwie boardu. Elementy tablicy sa chwilowo zablokowane, aby uniknac przypadkowych przesuniec.'
        : 'You are drawing on top of the board. Board elements are temporarily locked to avoid accidental moves.',
      exitHint: isPolish
        ? 'Esc lub Canvas wraca do boardu.'
        : 'Esc or Canvas returns to board mode.',
    };
  }

  return {
    modeLabel: isPolish ? 'Tryb boardu' : 'Board mode',
    toggleLabel: isPolish ? 'Rysuj' : 'Draw',
    helper: locked
      ? isPolish
        ? 'Board jest tylko do odczytu. Mozesz przegladac uklad, ale nie edytowac elementow.'
        : 'The board is read-only. You can inspect the layout, but not edit elements.'
      : isPolish
        ? 'Ukladasz i edytujesz elementy tablicy. Uzyj Rysuj tylko wtedy, gdy chcesz dopisac odrebna warstwe od reki.'
        : 'You are arranging and editing board elements. Use Draw only when you want a separate freehand layer.',
    exitHint: isPolish
      ? 'Dwuklik edytuje tresc, a Cmd/Ctrl+S zapisuje stan boardu.'
      : 'Double-click edits content, and Cmd/Ctrl+S saves the board state.',
  };
}

export function getWhiteboardShortcuts(isPolish: boolean): ShortcutHelp[] {
  return [
    {
      key: '?',
      description: isPolish ? 'Pokaz / ukryj pomoc whiteboardu' : 'Show / hide whiteboard help',
      category: 'navigation',
    },
    {
      key: 'Escape',
      description: isPolish
        ? 'Zamknij pomoc albo wyjdz z trybu rysowania'
        : 'Close help or leave draw mode',
      category: 'navigation',
    },
    {
      key: 'Ctrl+S',
      description: isPolish ? 'Zapisz aktualny stan boardu' : 'Save the current board state',
      category: 'actions',
    },
    {
      key: 'Ctrl/Cmd+Z',
      description: isPolish ? 'Cofnij ostatnia zmiane' : 'Undo the latest change',
      category: 'actions',
    },
    {
      key: 'Ctrl/Cmd+Shift+Z',
      description: isPolish ? 'Ponow cofniecie (redo)' : 'Redo the previously undone change',
      category: 'actions',
    },
    {
      key: 'Ctrl/Cmd+G',
      description: isPolish ? 'Grupuj zaznaczone elementy' : 'Group selected elements',
      category: 'actions',
    },
    {
      key: 'Ctrl/Cmd+Shift+G',
      description: isPolish ? 'Rozgrupuj zaznaczona grupe' : 'Ungroup selected frame/group',
      category: 'actions',
    },
    {
      key: 'Ctrl/Cmd+A',
      description: isPolish ? 'Zaznacz wszystko na boardzie' : 'Select all board elements',
      category: 'selection',
    },
    {
      key: 'Delete / Backspace',
      description: isPolish ? 'Usun zaznaczone elementy' : 'Delete selected elements',
      category: 'actions',
    },
    {
      key: '/',
      description: isPolish ? 'Otworz menu szybkich komend' : 'Open quick command menu',
      category: 'navigation',
    },
  ];
}
