// ★ SPROSTOWANIE NADZORCY 2026-09-03: uzasadnienie umiejscowienia tego pliku
// w oryginalnym raporcie było BŁĘDNE. Autor napisał, że `vitest.config.ts` nie
// ma `server/src/**/__tests__/**` w `include` — ma, w liniach 297-298. Test
// uruchomiłby się także obok kodu serwera. Plik zostaje tutaj (działa, 43/43),
// ale nikt nie powinien powielać tamtego uzasadnienia jako reguły.

/**
 * BEZPIECZNIK MOUNTÓW BRAMKOWANYCH MODUŁÓW — „uzbrojone na przyszłość".
 *
 * POWÓD (zmierzony, nie wydumany). `BETA_MENU_STATUS` jest SSOT statusu modułu,
 * ale sam napis `'closed'` działał WYŁĄCZNIE w menu klienta: mounty API stały za
 * `betaGate` / `createBetaGate`, których całe ciało to `next()`
 * (`server/src/middleware/betaGate.middleware.ts`). W dniach 2026-09-02/03
 * zmierzono i domknięto pięć powierzchni, na których zwykły użytkownik zapisywał
 * albo czytał dane modułu zamkniętego: `/api/economics`,
 * `/api/financial-modeling`, `/api/conclusions`, `/api/v8/case-workspace`,
 * intake Case'a z czatu i Teresy, oraz odczyt `/api/finance-statements`.
 *
 * CZEGO PILNUJE TEN PLIK. Cztery mounty modułów DZIŚ OTWARTYCH noszą tę samą
 * atrapę: `/api/benefits`, `/api/presentations`, `/api/presentation-studio`,
 * `/api/document-studio`. Dziś są nieszkodliwe — bo moduły są `'open'`. Ale w
 * dniu, w którym nadzorca przełączy którykolwiek na `'closed'`, mount po cichu
 * zostanie OTWARTY, dokładnie tak jak stało się z Finansami. Ten test zamienia
 * tę cichą regresję w czerwony wynik: dla każdego modułu w SSOT wymaga
 * zadeklarowanego mountu, a gdy moduł nie jest `'open'` — realnej bramki
 * `createModuleGate('<ID>')` w bloku tego mountu, poprzedzonej weryfikacją
 * tokenu.
 *
 * DLACZEGO TEST STATYCZNY, A NIE RUNTIME'OWY. Bramka jest własnością MIEJSCA
 * REJESTRACJI trasy, nie zachowania pojedynczego żądania. Test runtime'owy
 * musiałby wstać z bazą i przejść pełny przepływ dla każdego modułu (to robi
 * sonda `server/src/scripts/economics-gate-probe.ts` — para dowodów NEG/POS na
 * żywym przepływie). Ten plik jest tańszą, zawsze zieloną bramką CI, która
 * pilnuje kompletności rejestru; sonda pozostaje dowodem, że bramka DZIAŁA.
 *
 * ★ DLACZEGO W `tests/unit/`, A NIE W `server/src/**\/__tests__/`. `vitest.config.ts`
 * ma w `include` wzorzec `src/**\/__tests__/**` (frontend) i `tests/unit/**` — ale
 * NIE `server/src/**\/__tests__/**`. Bezpiecznik położony obok kodu serwera nigdy
 * nie zostałby zebrany i byłby bezpiecznikiem, który nie może przejść ani paść.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BETA_MENU_STATUS,
  BETA_SUBAREA_STATUS,
} from '../../../../server/src/sharedRuntime/utils/betaMenuStatus.ts';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const readServerFile = (relative: string): string =>
  fs.readFileSync(path.join(REPO_ROOT, 'server/src', relative), 'utf8');

/**
 * Jedna powierzchnia HTTP jednego modułu.
 *
 * `anchor` to literał ŚCIEŻKI w wywołaniu `use(...)`. Test sam znajduje granice
 * tego wywołania (bilansowanie nawiasów), więc sprawdza bramkę W TYM mouncie,
 * a nie „gdziekolwiek w pliku" — inaczej bramka przy `/api/economics`
 * zaliczałaby mount `/api/finance-statements`.
 */
interface ModuleSurface {
  label: string;
  file: string;
  anchor: string;
  /**
   * Literał dowodzący, że rola jest już ustalona, ZANIM zadziała bramka.
   * `same-block` — musi wystąpić w tym samym wywołaniu `use(...)`, przed bramką.
   * `earlier-in-file` — musi wystąpić w tym pliku powyżej mountu (wspólne
   * `router.use(verifyToken)` na całym routerze).
   * `parent` — weryfikacja stoi w pliku rodzica (np. `v8Router.use(verifyToken)`).
   *
   * ★ To NIE jest ozdoba. Zmierzone 2026-09-02 dowodem mutacyjnym: bramka bez
   * weryfikacji tokenu przed sobą daje ZIELONY negatyw (403) i 403 także dla
   * właściciela — moduł wygaszony dla wszystkich, a pojedynczy test tego nie
   * widzi.
   */
  verifier: { kind: 'same-block' | 'earlier-in-file' | 'parent'; literal: string; file?: string };
  /**
   * Nazwa bramki, jeśli inna niż `createModuleGate('<ID>')` — dziś tylko
   * Spotkania (aliasy historyczne). Patrz osobny test niżej: alias MUSI
   * rozwijać się do `createModuleGate` tego właśnie modułu.
   */
  gateAlias?: string;
  /**
   * Gdy bramka jest wpięta przez stałą (bo ten sam obiekt obsługuje dwa
   * prefiksy), to literał jej definicji. Bez tego alias mógłby wskazywać na
   * cokolwiek — także na atrapę.
   */
  aliasDefinition?: string;
}

/**
 * REJESTR. Każdy klucz `BETA_MENU_STATUS` musi tu być — albo jako lista
 * powierzchni, albo z jawnym `noApiSurface` i powodem. Nowy moduł bez wpisu
 * wywraca test „rejestr pokrywa cały SSOT" niżej, więc nie da się dodać modułu
 * i po cichu zapomnieć o jego API.
 */
const MODULE_SURFACES: Record<string, ModuleSurface[] | { noApiSurface: string }> = {
  MODULE_ECONOMICS: [
    {
      label: 'Finance — analizy',
      file: 'Gateway.ts',
      anchor: "'/api/economics',",
      verifier: { kind: 'same-block', literal: 'gatewayVerifyToken' },
    },
    {
      label: 'Finance — modelowanie',
      file: 'Gateway.ts',
      anchor: "'/api/financial-modeling',",
      verifier: { kind: 'same-block', literal: 'gatewayVerifyToken' },
    },
    {
      label: 'Finance — sprawozdania (odczyt + zapis)',
      file: 'Gateway.ts',
      anchor: "'/api/finance-statements',",
      verifier: { kind: 'same-block', literal: 'gatewayVerifyToken' },
    },
  ],
  MODULE_CONCLUSIONS: [
    {
      label: 'Wnioski',
      file: 'Gateway.ts',
      anchor: "'/api/conclusions',",
      verifier: { kind: 'same-block', literal: 'gatewayVerifyToken' },
    },
  ],
  MODULE_CASE_WORKSPACE: [
    {
      label: 'Zlecenia — mount modułu',
      file: 'routes/v8/index.ts',
      anchor: "'/case-workspace',",
      verifier: { kind: 'earlier-in-file', literal: 'v8Router.use(verifyToken)' },
    },
    {
      label: 'Zlecenia — intake z czatu (rozmowa)',
      file: 'routes/v8/chat.routes.ts',
      anchor: "'/conversations/:conversationId/case-intake',",
      gateAlias: 'caseIntakeModuleGate',
      aliasDefinition: "const caseIntakeModuleGate = createModuleGate('MODULE_CASE_WORKSPACE');",
      verifier: {
        kind: 'parent',
        literal: 'v8Router.use(verifyToken)',
        file: 'routes/v8/index.ts',
      },
    },
    {
      label: 'Zlecenia — intake z czatu (Case -> rozmowa)',
      file: 'routes/v8/chat.routes.ts',
      anchor: "router.use('/case-intake',",
      gateAlias: 'caseIntakeModuleGate',
      aliasDefinition: "const caseIntakeModuleGate = createModuleGate('MODULE_CASE_WORKSPACE');",
      verifier: {
        kind: 'parent',
        literal: 'v8Router.use(verifyToken)',
        file: 'routes/v8/index.ts',
      },
    },
    {
      label: 'Zlecenia — intake z Teresy',
      file: 'routes/v8/teresa.routes.ts',
      anchor: "router.use('/case-intake',",
      verifier: {
        kind: 'parent',
        literal: 'v8Router.use(verifyToken)',
        file: 'routes/v8/index.ts',
      },
    },
  ],
  MODULE_MEETING: [
    {
      label: 'Spotkania',
      file: 'routes/meeting.routes.ts',
      anchor: 'router.use(closedBetaModuleGate)',
      verifier: { kind: 'earlier-in-file', literal: 'router.use(verifyToken)' },
      gateAlias: 'closedBetaModuleGate',
    },
  ],
  // ── CZTERY MOUNTY UZBROJONE NA PRZYSZŁOŚĆ ────────────────────────────────
  // Dziś `'open'`, więc wymóg bramki jeszcze nie obowiązuje. Wpis istnieje po
  // to, żeby dzień przełączenia na `'closed'` zapalił się na czerwono TUTAJ,
  // a nie u klienta.
  MODULE_BENEFITS: [
    {
      label: 'Wyniki (Benefits)',
      file: 'Gateway.ts',
      anchor: "app.use('/api/benefits',",
      verifier: { kind: 'same-block', literal: 'gatewayVerifyToken' },
    },
  ],
  MODULE_PRESENTATIONS: [
    {
      label: 'Dokumenty / biblioteka prezentacji',
      file: 'Gateway.ts',
      anchor: "app.use('/api/presentations',",
      verifier: { kind: 'same-block', literal: 'gatewayVerifyToken' },
    },
  ],
  MODULE_PREZENTACJE_GEN: [
    {
      label: 'Presentation Studio',
      file: 'Gateway.ts',
      anchor: "app.use('/api/presentation-studio',",
      verifier: { kind: 'same-block', literal: 'gatewayVerifyToken' },
    },
  ],
  MODULE_DOCUMENT_STUDIO: [
    {
      label: 'Document Studio',
      file: 'Gateway.ts',
      anchor: "'/api/document-studio',\n        gatewayVerifyToken,",
      verifier: { kind: 'same-block', literal: 'gatewayVerifyToken' },
    },
  ],
  MODULE_AUDITS: [
    {
      label: 'Audyty',
      file: 'Gateway.ts',
      anchor: "app.use('/api/audits',",
      verifier: { kind: 'same-block', literal: 'gatewayVerifyToken' },
    },
  ],
  MODULE_TABELE: [
    {
      label: 'Table Studio (platforma tabel)',
      file: 'Gateway.ts',
      anchor: "app.use('/api/table-platform', tablePlatformRoutes)",
      verifier: { kind: 'same-block', literal: 'tablePlatformRoutes' },
    },
  ],
  INTERNAL_TOOLS: {
    noApiSurface:
      'Pozycja stopki poza bramkowanym menu głównym, ograniczona do DBR77 przez canUseInternalTools(); w SSOT trzymana jako "open" = sama plakietka beta.',
  },
};

/** Wycinek pliku od `anchor` do domknięcia otaczającego wywołania `use(...)`. */
function mountBlock(source: string, anchor: string): string {
  const anchorIndex = source.indexOf(anchor);
  expect(anchorIndex, `nie znaleziono kotwicy mountu: ${anchor}`).toBeGreaterThanOrEqual(0);
  const callStart = source.lastIndexOf('use(', anchorIndex + anchor.length);
  let depth = 0;
  for (let i = callStart + 3; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1;
    if (source[i] === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(callStart, i + 1);
    }
  }
  throw new Error(`niezbilansowane nawiasy w mouncie: ${anchor}`);
}

describe('bezpiecznik bramek modułów — rejestr mountów', () => {
  it('rejestr pokrywa KAŻDY moduł z SSOT (nowy moduł nie przejdzie bez wpisu)', () => {
    const missing = Object.keys(BETA_MENU_STATUS).filter((id) => !(id in MODULE_SURFACES));
    expect(
      missing,
      `moduły bez zadeklarowanej powierzchni API: ${missing.join(', ')} — dopisz je do MODULE_SURFACES razem z mountem, inaczej bramka po przełączeniu na "closed" zostanie tylko w menu klienta`
    ).toEqual([]);
  });

  it('rejestr nie opisuje modułów, których w SSOT już nie ma', () => {
    const stale = Object.keys(MODULE_SURFACES).filter((id) => !(id in BETA_MENU_STATUS));
    expect(stale, `wpisy bez odpowiednika w SSOT: ${stale.join(', ')}`).toEqual([]);
  });

  for (const [moduleId, entry] of Object.entries(MODULE_SURFACES)) {
    if (!Array.isArray(entry)) continue;
    for (const surface of entry) {
      const closed = BETA_MENU_STATUS[moduleId] !== 'open';
      const title = `${moduleId} · ${surface.label} (${BETA_MENU_STATUS[moduleId]})`;

      it(`${title} — mount istnieje tam, gdzie deklaruje rejestr`, () => {
        expect(readServerFile(surface.file)).toContain(surface.anchor);
      });

      it(`${title} — ${closed ? 'moduł zamknięty: MUSI mieć realną bramkę' : 'moduł otwarty: wymóg bramki uzbroi się sam w dniu przełączenia'}`, () => {
        if (!closed) {
          // Świadomie NIC tu nie wymuszamy i NIC nie udajemy: dziś ten mount nie
          // potrzebuje bramki. Wartością wpisu jest to, że przełączenie statusu
          // w SSOT na 'closed' automatycznie przełącza ten test w tryb
          // wymagający — bez edycji tego pliku i bez pamiętania o mouncie.
          expect(BETA_MENU_STATUS[moduleId]).toBe('open');
          return;
        }
        const source = readServerFile(surface.file);
        const block = mountBlock(source, surface.anchor);
        const gateLiteral = surface.gateAlias ?? `createModuleGate('${moduleId}')`;
        expect(
          block,
          `mount "${surface.label}" obsługuje moduł ZAMKNIĘTY, ale nie ma w nim ${gateLiteral}. betaGate/createBetaGate to atrapy (całe ciało to next()) i NIE są bramką.`
        ).toContain(gateLiteral);
        if (surface.aliasDefinition) {
          expect(
            source,
            `alias ${gateLiteral} musi być zdefiniowany jako bramka TEGO modułu`
          ).toContain(surface.aliasDefinition);
        }
      });

      if (!closed) continue;

      it(`${title} — rola ustalona PRZED bramką (inaczej wygaszenie dla wszystkich)`, () => {
        const source = readServerFile(surface.file);
        if (surface.verifier.kind === 'parent') {
          expect(readServerFile(surface.verifier.file as string)).toContain(
            surface.verifier.literal
          );
          return;
        }
        if (surface.verifier.kind === 'earlier-in-file') {
          const verifierAt = source.indexOf(surface.verifier.literal);
          const mountAt = source.indexOf(surface.anchor);
          expect(verifierAt).toBeGreaterThanOrEqual(0);
          expect(
            verifierAt,
            'weryfikacja tokenu musi być zarejestrowana PRZED mountem — Express dopasowuje warstwy w kolejności rejestracji'
          ).toBeLessThan(mountAt);
          return;
        }
        const block = mountBlock(source, surface.anchor);
        const verifierAt = block.indexOf(surface.verifier.literal);
        const gateAt = block.indexOf(surface.gateAlias ?? `createModuleGate('${moduleId}')`);
        expect(verifierAt, `brak ${surface.verifier.literal} w mouncie`).toBeGreaterThanOrEqual(0);
        expect(
          verifierAt,
          'bramka przed weryfikacją tokenu widzi pustą rolę i wygasza moduł także dla właściciela — zmierzone dowodem mutacyjnym 2026-09-02'
        ).toBeLessThan(gateAt);
      });
    }
  }
});

describe('bezpiecznik bramek modułów — pułapki samej bramki', () => {
  it('betaGate i createBetaGate są nadal atrapami (gdyby przestały, ten rejestr trzeba przemyśleć)', () => {
    const source = readServerFile('middleware/betaGate.middleware.ts');
    const betaGateBody = source.slice(
      source.indexOf('export function betaGate('),
      source.indexOf('export function createModuleGate(')
    );
    expect(betaGateBody).toContain('next();');
    expect(betaGateBody).not.toContain('BETA_LOCKED');
  });

  it('closedBetaModuleGate NIE jest bramką generyczną — rozwija się do MODULE_MEETING', () => {
    const source = readServerFile('middleware/betaGate.middleware.ts');
    expect(
      source,
      'nazwa sugeruje bramkę „dowolnego zamkniętego modułu", a ciało jest przybite do Spotkań; użycie jej gdzie indziej bramkuje NIE TEN moduł'
    ).toContain("createModuleGate('MODULE_MEETING')(req, res, next)");

    const users = ['routes/meeting.routes.ts'];
    for (const file of users) {
      expect(readServerFile(file)).toContain('closedBetaModuleGate');
    }
  });

  it('★ podobszary (BETA_SUBAREA_STATUS) nie mogą trafić do createModuleGate bez własnego resolveStatus', () => {
    // MINA: `createModuleGate` czyta domyślnie WYŁĄCZNIE `BETA_MENU_STATUS`.
    // Dla `MYWORK_IDEAS` (klucz podobszaru) zwróciłby `undefined !== 'open'` i
    // blokował — ale przez NIEISTNIENIE klucza, nie przez SSOT. Po przełączeniu
    // `BETA_SUBAREA_STATUS.MYWORK_IDEAS` na 'open' API zostałoby ZAMKNIĘTE.
    // Logika odwrotna. Kto to wpina, musi podać własny resolveStatus.
    const roots = ['Gateway.ts', 'routes', 'middleware'];
    const files: string[] = [];
    const walk = (relative: string): void => {
      const absolute = path.join(REPO_ROOT, 'server/src', relative);
      if (!fs.existsSync(absolute)) return;
      if (fs.statSync(absolute).isDirectory()) {
        for (const child of fs.readdirSync(absolute)) walk(path.join(relative, child));
        return;
      }
      if (absolute.endsWith('.ts')) files.push(relative);
    };
    roots.forEach(walk);

    const offenders: string[] = [];
    for (const subareaId of Object.keys(BETA_SUBAREA_STATUS)) {
      const naive = `createModuleGate('${subareaId}')`;
      for (const file of files) {
        if (readServerFile(file).includes(naive)) offenders.push(`${file}: ${naive}`);
      }
    }
    expect(
      offenders,
      'podobszar wpięty bez resolveStatus — bramka działałaby przez nieistnienie klucza, a przełączenie podobszaru na "open" zamknęłoby API'
    ).toEqual([]);
  });
});
