/**
 * chat-split-teresa-right — canvas toolbar icon-parity guard (dyżur 05.09).
 *
 * Odbiór na żywo 05.09 zgłosił: "pasek kanwy ma inny zestaw ikon niż
 * zatwierdzony obraz (brak Main/share/save, jest globe/szablon)" dla świeżego
 * dokumentu w widoku podzielonym (evidence/grafika/crimson-czat-20260903/
 * chat-split-teresa-right__PRZED__pl__1440__light.png — uwaga: ten zrzut jest
 * atrapą obu stron, ArtifactMock + mock czatu, per
 * docs/program/AUDYT_16_MODULOW_20260905/01_Czat.md §B2, więc nie jest 1:1
 * dowodem na to, co dziś renderuje realny komponent).
 *
 * Zmierzone w tym dyżurze (source-grep, brak żywego zrzutu — sesja
 * ODBIOR_AUTH_STATE wygasła w trakcie pracy i nie odświeżyła się na czas):
 *
 * 1. "Main" (BranchSelector) w UnifiedChatPanel.tsx renderuje się TYLKO gdy
 *    `activeConversationId && !activeConversationId.startsWith('local-')` —
 *    świadome (finding M01-035, komentarz w kodzie): rozmowa `local-*` nie ma
 *    jeszcze wiersza na serwerze, więc GET /:id/branches dałby 404. Świeży
 *    dokument w nowej rozmowie ZACZYNA jako `local-*` — brak "Main" na tym
 *    etapie jest oczekiwanym zachowaniem, NIE regresją.
 * 2. `copy/share/save/close` w WorkCanvasDocumentPanel.tsx (`canvas-file-
 *    actions`) są renderowane BEZWARUNKOWO przez `renderCommandButton` z
 *    ikonami Copy/Share2/Save/X (`actionIcons` w tym samym pliku) — nawet gdy
 *    `getCanvasActionAvailability` zwraca `disabled_*`, ikona zostaje ta sama
 *    (przycisk jest wyszarzony, nie podmieniony). Nie znaleziono żadnej ikony
 *    Globe ani "szablonu" w tym komponencie ani w sąsiednich
 *    (CanvasArtifactSwitcher.tsx, canvasActionAvailability.ts).
 *
 * Ten plik NIE potwierdza ani nie zaprzecza "globe/szablon" z raportu — blokuje
 * tylko regresję punktów 1-2, które są zmierzone i pewne. Jeśli źródło
 * "globe/szablon" zostanie znalezione później, dopisz tu asercję na nie.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const unifiedChatPanelSource = fs.readFileSync(
  path.resolve(__dirname, '../UnifiedChatPanel.tsx'),
  'utf8'
);
const workCanvasSource = fs.readFileSync(
  path.resolve(__dirname, '../WorkCanvasDocumentPanel.tsx'),
  'utf8'
);

describe('chat-split-teresa-right — canvas/chat header icon-parity guard', () => {
  it('keeps "Main" (BranchSelector) gated behind a real, persisted (non-local-*) conversation', () => {
    expect(unifiedChatPanelSource).toContain(
      "activeConversationId && !String(activeConversationId).startsWith('local-')"
    );
    expect(unifiedChatPanelSource).toContain('<BranchSelector');
  });

  it('keeps copy/share/save/close as the unconditional canvas-file-actions icon set', () => {
    const fileActionsBlock = workCanvasSource.match(
      /data-testid="canvas-file-actions">([\s\S]{0,400}?)<\/div>/
    )?.[1];
    expect(fileActionsBlock).toBeTruthy();
    expect(fileActionsBlock).toContain("renderCommandButton('copy')");
    expect(fileActionsBlock).toContain("renderCommandButton('share')");
    expect(fileActionsBlock).toContain("renderCommandButton('save')");
    expect(fileActionsBlock).toContain("renderCommandButton('close')");

    // The icon map itself: share/save must stay Share2/Save, never swapped
    // for an unrelated icon (e.g. a "Globe" or template icon) even when the
    // action is disabled — getCanvasActionAvailability only changes status,
    // renderCommandButton always uses the same actionIcons[actionId].
    expect(workCanvasSource).toMatch(/share:\s*Share2/);
    expect(workCanvasSource).toMatch(/save:\s*Save/);
    expect(workCanvasSource).not.toMatch(/import\s+\{[^}]*\bGlobe\b[^}]*\}\s+from\s+'lucide-react'/);
  });
});
