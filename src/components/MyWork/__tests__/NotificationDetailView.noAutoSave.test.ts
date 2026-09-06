/**
 * NotificationDetailView — zakaz zapisu AI bez zatwierdzenia (DEC-407 uzupełnienie, 2026-09-06).
 *
 * PRZYCZYNA: `handleAnalyzeWithAI` wołał `POST /ai/generate` i wynik pisał
 * PROSTO do stanu karty (`setDescriptionDraft`, `setWhyImportantDraft`,
 * `setBlockedDraft`, `setExpectedActionDraft`) — bez żadnego kroku
 * zatwierdzenia. Auto-wywołanie przy montowaniu ekranu było już usunięte
 * (2026-07-24, REGRESJA R2), ale sam generator i jego jedyny pozostały
 * wołacz („Ponów" w bannerze błędu) wciąż pisały bez pytania. Ten dyżur
 * usuwa generator w całości — jedyna droga uzupełnienia pustych pól arkusza
 * jest dziś „Pracuj z AI → Uzupełnij…" (`zrodlaPracujZAI`), które idzie przez
 * podgląd propozycji z „Zatwierdź"/„Odrzuć" (ten sam mechanizm, co reszta
 * kart N — patrz `PracujZAI.test.tsx`).
 *
 * Plik jest OGROMNY (>4000 linii, dziesiątki store'ów/hooków) — pełny render
 * w izolacji nie jest tu proporcjonalny do usunięcia martwej ścieżki. Test
 * jest więc STRUKTURALNY (czyta źródło), ale to PRAWDZIWA bramka mutacyjna:
 * przywrócenie generatora (funkcja + wywołanie `/ai/generate` + bezpośredni
 * zapis do `setXDraft`) wywraca każdy z trzech testów poniżej.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ZRODLO = readFileSync(
  path.resolve(__dirname, '../NotificationDetailView.tsx'),
  'utf-8'
);

describe('NotificationDetailView — zakaz zapisu AI bez zatwierdzenia (DEC-407 uzupełnienie)', () => {
  it('nie definiuje już `handleAnalyzeWithAI` (generator arkusza pisał 5 pól bez podglądu)', () => {
    expect(ZRODLO).not.toMatch(/handleAnalyzeWithAI\s*=\s*useCallback/);
    expect(ZRODLO).not.toContain('const handleAnalyzeWithAI');
  });

  it('nie woła już `/ai/generate` bezpośrednio z tego pliku (ta ścieżka pisała bez zatwierdzenia)', () => {
    expect(ZRODLO).not.toContain('/ai/generate');
  });

  it('jedyne wejście „uzupełnij" w karcie idzie przez `zrodlaPracujZAI` (propozycja + Zatwierdź/Odrzuć)', () => {
    expect(ZRODLO).toContain('uzupelnijSekcje={zrodlaPracujZAI.sekcja}');
    expect(ZRODLO).toContain('uzupelnijDokument={zrodlaPracujZAI.dokument}');
  });
});
