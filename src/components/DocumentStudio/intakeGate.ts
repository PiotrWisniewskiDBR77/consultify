/**
 * Brama fazy `intake` w Document Studio — CO ma się wyrenderować, zanim
 * użytkownik zobaczy jakikolwiek kreator.
 *
 * ODBIÓR NA ŻYWO 05.09 (pakiet 10 · Materiały, różnica #5) — FAIL-OPEN.
 * Blokada „Nie da się użyć tego wzorca" włączała się WYŁĄCZNIE przy
 * `?entry=template`, bo w łańcuchu ternary gałęzie `docEntryMode === 'blank'`
 * i `triMode && docEntryMode === 'choose'` stały WYŻEJ niż sprawdzenie stanu
 * rozwiązywania wzorca. Skutki zmierzone na żywo:
 *   - `?templateArtifactId=<nieistniejący>` (bez `entry`) → zwykła brama
 *     „Jak chcesz zacząć dokument?", zero informacji o odrzuconym wzorcu;
 *   - `?entry=blank&templateArtifactId=<nieistniejący>` → auto-tworzenie
 *     PUSTEGO dokumentu, czyli dokładnie ten cichy fallback do Mode 1,
 *     którego zakazuje gwiazdka przy `templateResolveMessage`.
 *
 * Reguła jest teraz jedna i policzalna w jednym miejscu: JEŚLI adres niesie
 * `templateArtifactId`, to o wejściu decyduje WYŁĄCZNIE wynik serwerowego
 * rozwiązania wzorca — dopóki nie jest `resolved`, nie renderuje się żaden
 * kreator (fail-closed), niezależnie od `entry`/`docEntryMode`.
 */
export type DocumentIntakeGate =
  | 'template-resolving'
  | 'template-blocked'
  | 'blank-creating'
  | 'mode-chooser'
  | 'ai-entry'
  | 'intake-form';

export type TemplateResolveState = 'idle' | 'resolving' | 'resolved' | 'error';

export interface DocumentIntakeGateInput {
  /** `?templateArtifactId=` z adresu (już przycięte, `null` gdy brak). */
  templateArtifactId: string | null;
  /** Stan serwerowego rozwiązania wzorca. */
  templateResolveState: TemplateResolveState;
  docEntryMode: 'choose' | 'ai' | 'template' | 'blank';
  triMode: boolean;
  zaiTeresaEnabled: boolean;
}

export function resolveDocumentIntakeGate(input: DocumentIntakeGateInput): DocumentIntakeGate {
  if (input.templateArtifactId) {
    // `idle` liczy się jak `resolving`: efekt rozwiązujący wzorzec startuje PO
    // pierwszym renderze, więc bez tego pierwsza klatka byłaby fail-open.
    if (input.templateResolveState === 'idle' || input.templateResolveState === 'resolving') {
      return 'template-resolving';
    }
    if (input.templateResolveState === 'error') return 'template-blocked';
  }
  if (input.docEntryMode === 'blank') return 'blank-creating';
  if (input.triMode && input.docEntryMode === 'choose') return 'mode-chooser';
  if (input.zaiTeresaEnabled && input.docEntryMode === 'ai') return 'ai-entry';
  return 'intake-form';
}
