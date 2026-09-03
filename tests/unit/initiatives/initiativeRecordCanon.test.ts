/**
 * BEZPIECZNIK — decyzja właściciela 2026-09-03 („inicjatywa jest najważniejszym dokumentem
 * w całym systemie"): KAŻDA inicjatywa otwierana z modułu Inicjatywy renderuje zatwierdzony
 * rekord `InitiativeDocumentView` (archetyp C·Rekord, SPEC-A; ekrany `initiative-record`
 * i `karta-initiative` z toru grafiki, odebrane 02.09.2026).
 *
 * Historia, której ten test ma NIE dopuścić do powtórki:
 * - 13.08.2026 (07bc597420) fala integracji przełączyła otwarcie każdej inicjatywy na
 *   nieodebrany `CanonicalInitiativeCardWorkspace` (angielskie etykiety, surowe enumy);
 * - 23.08.2026 (5c6d72066f) wyjątek dla id pokazowych `init-showcase-*` sprawił, że harness
 *   odbioru pokazywał zatwierdzony widok, a produkt na stagingu — inny.
 * Właściciel: „proszę przywrócić tamtą inicjatywę i skasować tę obecną, aby nigdy nie wróciła".
 *
 * Test jest celowo tekstowy (czyta źródło), bo pilnuje NIEOBECNOŚCI, której test renderujący
 * nie potrafi udowodnić.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const HUB = path.join(ROOT, 'src/components/Initiatives/InitiativesHub.tsx');

describe('kanon rekordu inicjatywy (decyzja właściciela 2026-09-03)', () => {
  it('CanonicalInitiativeCardWorkspace nie istnieje w repo', () => {
    expect(
      fs.existsSync(path.join(ROOT, 'src/components/Initiatives/CanonicalInitiativeCardWorkspace.tsx'))
    ).toBe(false);
    const grep = fs
      .readdirSync(path.join(ROOT, 'src/components/Initiatives'))
      .filter((f) => /canonicalinitiativecardworkspace/i.test(f));
    expect(grep).toEqual([]);
  });

  it('InitiativesHub nie rozgałęzia otwarcia inicjatywy po subType canonical-runtime ani showcase', () => {
    const src = fs.readFileSync(HUB, 'utf8');
    expect(src).not.toMatch(/subType\s*===\s*'canonical-runtime'/);
    expect(src).not.toMatch(/import\s*\{[^}]*CanonicalInitiativeCardWorkspace[^}]*\}/);
    expect(src).toMatch(/const desiredSubType = 'initiative';/);
    expect(src).toMatch(/<InitiativeDocumentView\b/);
  });
});
