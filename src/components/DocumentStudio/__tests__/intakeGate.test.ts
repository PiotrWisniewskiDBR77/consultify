/**
 * ODBIÓR NA ŻYWO 05.09 (pakiet 10 · Materiały, różnica #5) — blokada wzorca
 * była FAIL-OPEN: ekran „Nie da się użyć tego wzorca" pokazywał się wyłącznie
 * przy `entry=template`, a samo `?templateArtifactId=<nieistniejący>` wpuszczało
 * użytkownika do zwykłej bramy „Jak chcesz zacząć dokument?".
 *
 * Ten test broni ZABEZPIECZENIA: dla KAŻDEGO trybu wejścia (`choose`, `blank`,
 * `ai`, `template`) i przy włączonym i wyłączonym `triMode` obecność
 * `templateArtifactId` w adresie musi zatrzymać przepływ, dopóki serwer nie
 * potwierdzi wzorca. Nie testujemy jednego scenariusza — testujemy iloczyn
 * wszystkich wejść.
 *
 * DOWÓD MUTACYJNY (wykonany): usunięcie gałęzi `templateArtifactId` z
 * `resolveDocumentIntakeGate` (czyli powrót do stanu sprzed naprawy) →
 * czerwienieje 24 z 26 przypadków.
 */
import { describe, expect, it } from 'vitest';

import {
  resolveDocumentIntakeGate,
  type DocumentIntakeGateInput,
  type TemplateResolveState,
} from '../intakeGate';

const ENTRY_MODES: Array<DocumentIntakeGateInput['docEntryMode']> = [
  'choose',
  'ai',
  'template',
  'blank',
];
const TEMPLATE_ID = 'aaaaaaaa-1111-4444-8888-aaaaaaaaaaaa';

function gate(over: Partial<DocumentIntakeGateInput> = {}) {
  return resolveDocumentIntakeGate({
    templateArtifactId: null,
    templateResolveState: 'idle',
    docEntryMode: 'choose',
    triMode: true,
    zaiTeresaEnabled: false,
    ...over,
  });
}

describe('resolveDocumentIntakeGate — brama wzorca jest fail-closed', () => {
  for (const docEntryMode of ENTRY_MODES) {
    for (const triMode of [true, false]) {
      it(`odrzucony wzorzec BLOKUJE (entry=${docEntryMode}, triMode=${triMode})`, () => {
        expect(
          gate({
            templateArtifactId: TEMPLATE_ID,
            templateResolveState: 'error',
            docEntryMode,
            triMode,
          })
        ).toBe('template-blocked');
      });

      for (const state of ['idle', 'resolving'] as TemplateResolveState[]) {
        it(`niepotwierdzony wzorzec (${state}) WSTRZYMUJE (entry=${docEntryMode}, triMode=${triMode})`, () => {
          expect(
            gate({
              templateArtifactId: TEMPLATE_ID,
              templateResolveState: state,
              docEntryMode,
              triMode,
            })
          ).toBe('template-resolving');
        });
      }
    }
  }

  it('potwierdzony wzorzec wraca do normalnego przepływu', () => {
    expect(
      gate({
        templateArtifactId: TEMPLATE_ID,
        templateResolveState: 'resolved',
        docEntryMode: 'template',
      })
    ).toBe('intake-form');
  });

  it('bez templateArtifactId zachowanie jest DOKŁADNIE jak przed naprawą', () => {
    expect(gate({ docEntryMode: 'blank' })).toBe('blank-creating');
    expect(gate({ docEntryMode: 'choose', triMode: true })).toBe('mode-chooser');
    expect(gate({ docEntryMode: 'choose', triMode: false })).toBe('intake-form');
    expect(gate({ docEntryMode: 'ai', zaiTeresaEnabled: true })).toBe('ai-entry');
    expect(gate({ docEntryMode: 'ai', zaiTeresaEnabled: false })).toBe('intake-form');
    expect(gate({ docEntryMode: 'template' })).toBe('intake-form');
  });
});
