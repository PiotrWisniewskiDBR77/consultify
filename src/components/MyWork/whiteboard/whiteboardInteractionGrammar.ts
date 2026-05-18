import type { ShortcutHelp } from '../hooks/useKeyboardShortcuts';

export type WhiteboardMode = 'board' | 'draw';

export interface WhiteboardModeCopy {
  modeLabel: string;
  toggleLabel: string;
  helper: string;
  exitHint: string;
}

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
  ];
}
