/**
 * Naprawa MVP 06.09 (evidence/audyt-mvp-20260906/A2/RAPORT_A2.md poz. 3.2 +
 * zlecenie "Wywiad: 3 sesje o nazwie 'Wywiad'"): dwa niezależne miejsca w
 * InterviewHub.tsx dawały identyczny, nieodróżnialny domyślny napis dla
 * wielu wierszy/sesji:
 *
 *  1. `handleNewSession` wstawiał TWARDO PO ANGIELSKU `Interview ${date}`
 *     do pola nazwy nowej sesji, IGNORUJĄC `isPolish` (mimo że była w
 *     tablicy zależności `useCallback` — martwa zależność, nigdy nie
 *     czytana w ciele funkcji). Zmierzone: literał nie przechodził przez
 *     `t()` w ogóle.
 *  2. `getAssignmentTitle` (kolumna NAZWA w zakładce Skrzynka/"my
 *     assignments") spadał do gołego `t('interview.hub.interview')`
 *     ("Wywiad") gdy `a.template` było puste — zmierzone na żywo
 *     (lokalne stanowisko, GET /interview/assignments/my): WSZYSTKIE 3
 *     zadania mają `template: undefined` mimo różnych `templateId`, więc
 *     wszystkie 3 wiersze renderowały się identycznie. Naprawa dopisuje
 *     `dueAt` (nie `createdAt` — wszystkie 3 mają identyczny `createdAt`
 *     z jednego batcha seeda, więc to by NADAL kolidowało).
 *
 * Ten test pinuje ŹRÓDŁO (wzór 1:1 z
 * `src/routes/__tests__/assessmentOutputArtifactsRoute.test.tsx` — blok
 * "rejestracja wołacza na źródle") zamiast renderować cały komponent:
 * plik testowy sąsiedni (`InterviewHub.smoke.test.tsx`) mockuje
 * `react-i18next` na sztywno po angielsku (bez interpolacji `{{date}}`),
 * więc nie da się nim zweryfikować RZECZYWISTEGO polskiego tekstu — a to
 * właśnie ta różnica (isPolish ignorowany) była sednem błędu.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/components/Interview/InterviewHub.tsx'),
  'utf8'
);
const pl = JSON.parse(
  readFileSync(resolve(process.cwd(), 'public/locales/pl/translation.json'), 'utf8')
);
const en = JSON.parse(
  readFileSync(resolve(process.cwd(), 'public/locales/en/translation.json'), 'utf8')
);

describe('Interview — domyślne nazwy sesji/zadań nie kolidują ze sobą (pin na źródle)', () => {
  it('handleNewSession NIE wstawia twardego angielskiego literału — idzie przez t()', () => {
    expect(source).not.toMatch(/setNewSessionNameDraft\(`Interview \$\{formatListDate/);
    expect(source).toContain("t('interview.hub.newSessionDefaultName'");
  });

  it('klucz interview.hub.newSessionDefaultName istnieje w pl i en, z interpolacją {{date}}, i pl różni się od en', () => {
    expect(pl.interview.hub.newSessionDefaultName).toContain('{{date}}');
    expect(en.interview.hub.newSessionDefaultName).toContain('{{date}}');
    expect(pl.interview.hub.newSessionDefaultName.toLowerCase()).not.toBe(
      en.interview.hub.newSessionDefaultName.toLowerCase()
    );
    expect(pl.interview.hub.newSessionDefaultName).toMatch(/Wywiad/);
  });

  it('getAssignmentTitle odróżnia wiersze przez dueAt (nie createdAt — koliduje w seedzie)', () => {
    const start = source.indexOf('const getAssignmentTitle = useCallback(');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, start + 600);
    expect(body).toContain('a.dueAt || a.createdAt');
    // Regresja dokładnie tego kształtu błędu: sam `a.createdAt` (bez `dueAt`)
    // dawał 3 identyczne teksty na żywych danych seeda (jeden batch, jeden
    // createdAt) — więc to NIE może wrócić jako jedyny odróżnik.
    expect(body).not.toMatch(/\$\{formatListDate\(a\.createdAt\)\}/);
  });
});
