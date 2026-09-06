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

/**
 * Audyt przewodów odbioru (2026-09-03, `docs/program/waves/WAVE_03_ACCEPTANCE/
 * AUDYT_PRZEWODOW_ODBIORU_20260903.md`) i ślad `evidence/grafika/
 * przewody-odbioru-20260903.md` wykazały trzy komponenty, na których stały
 * zatwierdzone przez właściciela zrzuty, choć żaden użytkownik nigdy ich nie
 * widział — `git grep -w <Nazwa> -- src/` zwracał wyłącznie własną definicję,
 * komentarze i (dla InitiativesTable/ReportsTable) zero żywych wołaczy w
 * ogóle, a dla AuditsHub — wyłącznie jego własne testy (dawny równoległy hub
 * nad wycofanym `/api/audit`, nigdy nie mounted — `AuditsMethodHub.tsx:10`).
 * Decyzja właściciela (03.09, przy Inicjatywach): martwe/obce komponenty
 * kasować, „aby nigdy nie wróciły".
 */
describe('martwe komponenty odbioru 2026-09-03 nie wracają', () => {
  it('InitiativesTable.tsx (assessment) nie istnieje', () => {
    expect(
      fs.existsSync(path.join(ROOT, 'src/components/assessment/InitiativesTable.tsx'))
    ).toBe(false);
  });

  it('ReportsTable.tsx (assessment) nie istnieje', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/components/assessment/ReportsTable.tsx'))).toBe(
      false
    );
  });

  it('AuditsHub.tsx (Audit) nie istnieje', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/components/Audit/AuditsHub.tsx'))).toBe(false);
  });
});

/**
 * Runda 2 (03.09, rejestr D11 + rodzina „komponent bez importera"):
 * OrganizationV8CanonPanel.tsx zastąpiony przez OrgContextSummaryBanner.tsx
 * (M16 P0-2) — zero żywych wołaczy, 10 wystąpień crimson `primary-*`, brak
 * testów dedykowanych, brak montowania w dev-render.
 */
describe('martwe komponenty odbioru 2026-09-03 runda 2 nie wracają', () => {
  it('OrganizationV8CanonPanel.tsx (Organization) nie istnieje', () => {
    expect(
      fs.existsSync(path.join(ROOT, 'src/components/Organization/OrganizationV8CanonPanel.tsx'))
    ).toBe(false);
  });
});

/**
 * Decyzja właściciela A5 (03.09 wieczór, `docs/program/waves/WAVE_03_ACCEPTANCE/
 * G20_BLOKERY_P0P1_20260903.md` T2): katalog `NotificationSettingsV2/` (rodzina
 * „Obserwowane" — 8 plików, w tym `WatchingTab`) nie miał ani jednego importera
 * spoza siebie; Ustawienia renderują v1 (`src/views/SettingsView.tsx:433` →
 * `NotificationSettings`). Hook `useUserNotificationPreferences.tsx` wołał
 * `/api/settings/watchers`, której serwer nie ma, i był używany wyłącznie z
 * tego katalogu. Usunięte razem z hookiem i 4 osieroconymi kluczami i18n
 * (`settings.notifications.watchNotify*`).
 */
describe('NotificationSettingsV2 (decyzja A5, 03.09 wieczór) nie wraca', () => {
  it('katalog src/components/settings/NotificationSettingsV2/ nie istnieje', () => {
    expect(
      fs.existsSync(path.join(ROOT, 'src/components/settings/NotificationSettingsV2'))
    ).toBe(false);
  });

  it('hook src/hooks/useUserNotificationPreferences.tsx nie istnieje', () => {
    expect(
      fs.existsSync(path.join(ROOT, 'src/hooks/useUserNotificationPreferences.tsx'))
    ).toBe(false);
  });
});

/**
 * INI-404 (2026-09-06) — [ODMROZENIE 05_INITIATIVES DEC-397].
 *
 * Zmierzone na REALNYM rekordzie klasycznego rejestru DBR77 (lokalne stanowisko,
 * baza 54400, org cc9db573…, inicjatywa `fa87dc75-…` „Supply Chain Optimization";
 * tabela `initiatives` = 71 wierszy, projekcja runtime-v1 = 0 wierszy):
 * ścieżka lista → wiersz → podgląd → „Otwórz" dawała DOKŁADNIE JEDNO
 * `404 GET /api/initiatives/runtime-v1/initiatives/<id>` i jeden czerwony błąd
 * w konsoli. Źródłem była sonda w odczycie deep-linku `InitiativesHub`, która
 * ustawiała flagę przynależności do rejestru i wybierała jeden z dwóch handlerów otwarcia.
 *
 * Po usunięciu `CanonicalInitiativeCardWorkspace` (aed131a2ab, decyzja właściciela
 * 2026-09-03) obie gałęzie dawały ten sam dokument, więc odpowiedź sondy nie
 * zmieniała już nic na ekranie — a kosztowała 404 na KAŻDYM realnym rekordzie
 * klasycznego rejestru. Trasa serwera jest poprawna (404 = „nie ma w tym rejestrze",
 * ten sam kod dostaje obca organizacja — anty-enumeracja), więc naprawiony został
 * wołacz, nie trasa.
 *
 * Test jest tekstowy, bo pilnuje NIEOBECNOŚCI wołania sieciowego. Dowód mutacyjny:
 * przywrócenie w `InitiativesHub.tsx` sondy `Api.get('/initiatives/runtime-v1/
 * initiatives/${...}')` → ten test RED.
 */
describe('INI-404: karta inicjatywy nie sonduje rejestru runtime-v1 po id', () => {
  const src = () => fs.readFileSync(HUB, 'utf8');

  it('InitiativesHub nie woła runtime-v1 dla POJEDYNCZEJ inicjatywy', () => {
    // Wołanie listy `/initiatives/runtime-v1/initiatives` (bez segmentu id) zostaje —
    // to źródło wierszy rejestru. Zakazany jest wyłącznie odczyt per-id.
    expect(src()).not.toMatch(/runtime-v1\/initiatives\/\$\{/);
    expect(src()).not.toMatch(/runtime-v1\/initiatives\/['"]?\s*\+/);
  });

  it('lista dalej czyta OBA rejestry (nic nie zlikwidowano)', () => {
    expect(src()).toMatch(/listRegisteredInitiatives\(\)/);
    expect(src()).toMatch(/listLegacyInitiatives\(\)/);
    expect(src()).toMatch(/mergeLegacyInitiativesIntoRegister/);
  });

  it('odczyt deep-linku nie rozgałęzia otwarcia po przynależności do rejestru', () => {
    expect(src()).not.toMatch(/isCanonicalRuntime/);
    expect(src()).toMatch(/handleOpenInitiativeDocument\(initiative\)/);
  });
});
