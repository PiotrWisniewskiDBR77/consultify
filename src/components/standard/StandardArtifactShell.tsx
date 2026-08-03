/**
 * StandardArtifactShell — cienka, TYPOWANA warstwa nad `NModeShell` (SPEC-N §5.1).
 *
 * SSOT: Harvard/wdrozenie-100/_SPEC_N_KARTY_2026-07-21.md
 * Plan: Harvard/wdrozenie-100/_PLAN_WDROZENIA_KART_N_2026-07-21.md — FALA F, pakiet F1.
 * Kontrakt typowy (co i dlaczego jest wymagane): `./StandardArtifactShell.types.ts`.
 *
 * ZASADA (plan §1): DOZBRAJAMY istniejące, nie budujemy powłoki od zera. `NModeShell`
 * zostaje NIETKNIĘTY — ten komponent go opakowuje i domyka trzy rzeczy, których sam
 * `NModeShell` z natury nie pilnuje:
 *
 *   1. KOMPLET  — prawy panel jest polem wymaganym, o stałych kluczach (§2.2).
 *   2. KOLEJNOŚĆ — sekcje panelu renderują się w kanonicznej kolejności niezależnie od
 *                  kolejności deklaracji, a domyślnie zwinięte poza „Akcje" (§2.2 R3).
 *   3. JAWNOŚĆ  — brak primary, brak kontraktu AI i brak sekcji panelu trzeba NAZWAĆ
 *                  i uzasadnić; milczenie przestaje być możliwe (§2.3, §2.5).
 *
 * Czego ten komponent NIE robi: nie migruje żadnej karty, nie renderuje `NModeCardState`
 * za sekcję, nie zmienia wyglądu niczego, co dziś działa. Fala F to fundament.
 *
 * UCZCIWIE O ZASIĘGU BRAMEK:
 *   · typ  — łapie stan niedozwolony w momencie budowy (najmocniejsze, §5.1),
 *   · dev  — `walidujKontrakt` łapie to, czego typ nie widzi (id budowane dynamicznie,
 *            duplikat akcji między nagłówkiem a panelem). Ostrzeżenie, nie wyjątek:
 *            powłoka nigdy nie wywali ekranu z powodu naruszenia standardu,
 *   · runtime — realne renderowanie sprawdza dopiero smoke z pakietu F4 w przeglądarce
 *            (lekcja z fali N: „esbuild przeszedł" nie jest dowodem).
 */

import React, { useEffect, useMemo, useRef } from 'react';

import { NModeShell } from '@/components/shared/NModeLayout/NModeShell';
import type {
  NModeAction,
  NModeAIContextAction,
  NModeHeaderConfig,
  NModePropertyField,
  NModeSection,
} from '@/components/shared/NModeLayout/types';

import { ArtifactRightPanel, type ArtifactRightPanelSection } from './ArtifactRightPanel';
import type { KartaNKey, KartaNKlasa } from './registry';
import {
  type AiContractSlot,
  type BrakKontraktuAI,
  KOLEJNOSC_SEKCJI_PANELU,
  LIMIT_SEKCJI_KLASY_S,
  type PanelSekcjaTresc,
  type PominietaSekcjaPanelu,
  type PrimaryActionConfig,
  type PrimaryActionSlot,
  type RightPanelSections,
  type StandardArtifactShellProps,
  type StandardSekcjaDef,
  type SwiadomyBrakPrimary,
} from './StandardArtifactShell.types';

export * from './StandardArtifactShell.types';

// ─────────────────────────────────────────────────────────────────────────────
// Strażnicy wariantów (runtime — te same rozróżnienia, które robi typ)
// ─────────────────────────────────────────────────────────────────────────────

/** Czy slot primary to jawny, uzasadniony brak (SPEC-N §2.3)? */
export function czySwiadomyBrakPrimary(slot: PrimaryActionSlot): slot is SwiadomyBrakPrimary {
  return (slot as SwiadomyBrakPrimary)?.intentionallyNone === true;
}

/** Czy sekcja jest jawnie wykluczona z mechaniki AI (SPEC-N §2.5)? */
export function czyBrakKontraktuAI(slot: AiContractSlot): slot is BrakKontraktuAI {
  return (slot as BrakKontraktuAI)?.none === true;
}

/** Czy sekcja panelu jest jawnie pominięta (korekta K2 planu)? */
export function czyPominietaSekcjaPanelu(
  slot: PanelSekcjaTresc | PominietaSekcjaPanelu
): slot is PominietaSekcjaPanelu {
  return (slot as PominietaSekcjaPanelu)?.pominieta === true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Walidacja kontraktu — JEDNO miejsce, wyłącznie dev
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zarezerwowane id w postaci znormalizowanej — backstop runtime dla przypadków,
 * których typ nie widzi (id sklejane w locie, sekcje z `any`, kod JS).
 */
const ZAREZERWOWANE_ID_RUNTIME = new Set(['comments', 'history', 'activitylog', 'activity']);

/** Sprowadza id do postaci porównywalnej: `Activity-Log` = `activity_log` = `activityLog`. */
function normalizujId(id: string): string {
  return id.toLowerCase().replace(/[\s\-_]/g, '');
}

/** Uzasadnienie ma być zdaniem, nie zbyciem („nd", „-", „brak"). */
const MIN_DLUGOSC_UZASADNIENIA = 10;

function uzasadnienieZaKrotkie(reason: string | undefined): boolean {
  return (reason ?? '').trim().length < MIN_DLUGOSC_UZASADNIENIA;
}

export interface WejscieWalidacjiKontraktu {
  readonly karta: KartaNKey | string;
  readonly klasa: KartaNKlasa;
  readonly sections: readonly Pick<StandardSekcjaDef, 'id' | 'aiContract'>[];
  readonly rightPanel: RightPanelSections;
  readonly primaryAction: PrimaryActionSlot;
  readonly headerActions?: readonly NModeAction[];
  readonly toolAIActions?: readonly NModeAction[];
  readonly aiContextActions?: readonly NModeAIContextAction[];
  /** Czy karta podała własny toolbar — wyklucza się z deklaratywnym paskiem akcji. */
  readonly maToolbar?: boolean;
}

/**
 * Sprawdza naruszenia SPEC-N NIEWYRAŻALNE typem i zwraca listę problemów po polsku.
 *
 * Funkcja jest czysta (żadnego `console`, żadnego stanu) — dzięki temu ten sam kod
 * wywoła test zgodności §5.3, a nie tylko przeglądarka. Logowaniem zajmuje się komponent.
 */
export function walidujKontrakt(w: WejscieWalidacjiKontraktu): string[] {
  const problemy: string[] = [];
  const sekcje = w.sections ?? [];

  // ── §2.1 — zarezerwowane id w lewej kolumnie (backstop dla id spoza literałów) ──
  sekcje
    .filter((s) => ZAREZERWOWANE_ID_RUNTIME.has(normalizujId(s.id)))
    .forEach((s) => {
      problemy.push(
        `SPEC-N §2.1: sekcja lewej kolumny ma zarezerwowane id „${s.id}" — ` +
          `komentarze/historia/dziennik aktywności należą WYŁĄCZNIE do prawego panelu ` +
          `(dziś Decision renderuje komentarze w obu miejscach naraz).`
      );
    });

  // ── Duplikaty id sekcji (psują nawigację i klucze animacji) ──
  const licznikSekcji = new Map<string, number>();
  sekcje.forEach((s) => licznikSekcji.set(s.id, (licznikSekcji.get(s.id) ?? 0) + 1));
  licznikSekcji.forEach((ile, id) => {
    if (ile > 1) problemy.push(`Sekcja o id „${id}" zadeklarowana ${ile}× — id musi być unikalne.`);
  });

  // ── §2.1 — limit klasy S ──
  if (w.klasa === 'S' && sekcje.length > LIMIT_SEKCJI_KLASY_S) {
    problemy.push(
      `SPEC-N §2.1: karta „${w.karta}" deklaruje klasę S i ${sekcje.length} sekcji ` +
        `(limit ${LIMIT_SEKCJI_KLASY_S}). Powyżej limitu to jest klasa L — ` +
        `albo przenieś nadmiar do prawego panelu, albo zmień klasę na 'L'.`
    );
  }

  // ── §2.5 — kontrakt AI: wymagany, a wykluczenie musi być uzasadnione ──
  sekcje.forEach((s) => {
    if (!s.aiContract) {
      problemy.push(
        `SPEC-N §2.5: sekcja „${s.id}" nie deklaruje aiContract — ` +
          `milczenie nie jest dozwolone; użyj { none: true, reason: '…' }.`
      );
      return;
    }
    if (czyBrakKontraktuAI(s.aiContract) && uzasadnienieZaKrotkie(s.aiContract.reason)) {
      problemy.push(
        `SPEC-N §2.5: sekcja „${s.id}" wyklucza AI bez konkretnego uzasadnienia ` +
          `(pole reason). Napisz DLACZEGO, np. „statyczna baza wiedzy — treści nie pisze AI".`
      );
    }
  });

  // ── §2.3 — primary: brak musi być jawny I uzasadniony ──
  if (czySwiadomyBrakPrimary(w.primaryAction) && uzasadnienieZaKrotkie(w.primaryAction.reason)) {
    problemy.push(
      `SPEC-N §2.3: karta „${w.karta}" deklaruje brak primary bez konkretnego uzasadnienia ` +
        `(pole reason). Trzy karty z ośmiu miały ZERO primary przez przeoczenie — ` +
        `to pole ma odróżnić decyzję od przeoczenia.`
    );
  }

  // ── §2.2 — pominięte sekcje panelu muszą być uzasadnione ──
  KOLEJNOSC_SEKCJI_PANELU.forEach((id) => {
    const slot = w.rightPanel?.[id];
    if (!slot) return;
    if (czyPominietaSekcjaPanelu(slot) && uzasadnienieZaKrotkie(slot.reason)) {
      problemy.push(
        `SPEC-N §2.2: sekcja panelu „${id}" jest pominięta bez konkretnego uzasadnienia ` +
          `(pole reason).`
      );
    }
  });

  // ── §4A — warstwa dowodowa dla kart, których treść pisze AI ──
  if ((w.karta === 'insight' || w.karta === 'initiative') && !w.rightPanel?.evidence) {
    problemy.push(
      `SPEC-N §4A: karta „${w.karta}" nie deklaruje sekcji evidence. Warstwa dowodowa ` +
        `obowiązuje karty pisane przez AI (P2 rozstrzygnięte: Initiative TAK) — ` +
        `teza bez ścieżki „skąd wiemy" nie idzie przed klienta.`
    );
  }

  // ── §2.6 — anty-duplikacja akcji (ta sama akcja w dwóch miejscach) ──
  const wystapienia = new Map<string, string[]>();
  const zanotuj = (id: string | undefined, miejsce: string) => {
    if (!id) return;
    wystapienia.set(id, [...(wystapienia.get(id) ?? []), miejsce]);
  };
  if (!czySwiadomyBrakPrimary(w.primaryAction)) {
    zanotuj((w.primaryAction as PrimaryActionConfig).id, 'nagłówek (primary)');
  }
  (w.headerActions ?? []).forEach((a) => zanotuj(a.id, 'pasek akcji'));
  (w.toolAIActions ?? []).forEach((a) => zanotuj(a.id, 'akcje AI narzędzia'));
  (w.aiContextActions ?? []).forEach((a) =>
    zanotuj(a.action?.id, `akcje AI sekcji ${a.sectionId}`)
  );
  KOLEJNOSC_SEKCJI_PANELU.forEach((id) => {
    const slot = w.rightPanel?.[id];
    if (!slot || czyPominietaSekcjaPanelu(slot)) return;
    (slot.actionIds ?? []).forEach((aid) => zanotuj(aid, `prawy panel / ${id}`));
  });
  wystapienia.forEach((miejsca, id) => {
    if (miejsca.length > 1) {
      problemy.push(
        `SPEC-N §2.6: akcja „${id}" renderowana w ${miejsca.length} miejscach ` +
          `(${miejsca.join(' · ')}). Miejsce renderu jest atrybutem akcji, nie osobną ` +
          `deklaracją — zostaw jedno wejście (dziś: Save w nagłówku I w panelu).`
      );
    }
  });

  // ── §2.4 — własny toolbar wyłącza deklaratywny pasek akcji ──
  if (w.maToolbar && (w.headerActions ?? []).length > 0) {
    problemy.push(
      `SPEC-N §2.4: karta „${w.karta}" podaje jednocześnie slot toolbar i headerActions. ` +
        `Slot toolbar zastępuje pasek akcji, więc ${(w.headerActions ?? []).length} akcji ` +
        `NIE zostanie wyrenderowanych. Zostaw jedną drogę.`
    );
  }

  return problemy;
}

// ─────────────────────────────────────────────────────────────────────────────
// Komponent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `const S` w parametrze typu zachowuje LITERAŁY `id` z tablicy sekcji pisanej w miejscu
 * wywołania — bez tego `id` rozszerzyłoby się do `string` i bramka zarezerwowanych id
 * (`SprawdzZarezerwowaneId`) milcząco przestałaby cokolwiek łapać.
 */
export function StandardArtifactShell<const S extends readonly StandardSekcjaDef[]>({
  karta,
  klasa,
  header,
  primaryAction,
  sections,
  rightPanel,
  activeSection,
  onSectionChange,
  onSectionReorder,
  densityMode,
  onDensityModeChange,
  properties,
  propertiesMaxColumns,
  headerActions,
  headerActionsVisible,
  aiContextActions,
  toolAIActions,
  toolbar,
  panelWidth,
  panelStatusBar,
  panelAriaLabel,
  buildArtifactCode,
  loading,
  reducedMotion,
  motionDuration,
  nakladki,
}: StandardArtifactShellProps<S>): React.ReactElement {
  const listaSekcji: readonly StandardSekcjaDef[] = sections;

  // ── Dev: ostrzeżenia o naruszeniach niewyrażalnych typem ──
  // Produkcja = zero kosztu: cały blok znika przy budowie (`import.meta.env.DEV`).
  // Każdy komunikat logowany RAZ na montaż — inaczej karta z 26 sekcjami zalałaby konsolę
  // przy każdym renderze i ostrzeżenia przestałyby być czytane.
  const zalogowaneRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const problemy = walidujKontrakt({
      karta,
      klasa,
      sections: listaSekcji,
      rightPanel,
      primaryAction,
      headerActions,
      toolAIActions,
      aiContextActions,
      maToolbar: Boolean(toolbar),
    });
    problemy.forEach((p) => {
      if (zalogowaneRef.current.has(p)) return;
      zalogowaneRef.current.add(p);
      console.warn(`[StandardArtifactShell/${karta}] ${p}`);
    });
  }, [
    karta,
    klasa,
    listaSekcji,
    rightPanel,
    primaryAction,
    headerActions,
    toolAIActions,
    aiContextActions,
    toolbar,
  ]);

  // ── Nagłówek: primary wchodzi WYŁĄCZNIE ze slotu (§2.3) ──
  const naglowek: NModeHeaderConfig = useMemo(() => {
    // `ArtifactHeaderConfig` nie ma pola `primaryAction` — jedyną drogą jest slot powłoki.
    const bazowy: NModeHeaderConfig = { ...header };
    if (czySwiadomyBrakPrimary(primaryAction)) return bazowy;
    return {
      ...bazowy,
      primaryAction: {
        label: primaryAction.label,
        icon: primaryAction.icon,
        onClick: primaryAction.onClick,
        disabled: primaryAction.disabled,
        title: primaryAction.title,
      },
    };
  }, [header, primaryAction]);

  // ── Sekcje lewej kolumny: `aicontract` jest metadaną, `NModeShell` jej nie czyta ──
  const sekcjeNMode: NModeSection[] = useMemo(() => listaSekcji.map((s) => s), [listaSekcji]);

  // ── Prawy panel: kolejność i stan początkowy narzuca KOMPONENT (§2.2 + R3) ──
  const sekcjePanelu: ArtifactRightPanelSection[] = useMemo(
    () =>
      KOLEJNOSC_SEKCJI_PANELU.flatMap((id) => {
        const slot = rightPanel[id];
        // `evidence` nieobecne (pole opcjonalne) albo sekcja jawnie pominięta z uzasadnieniem.
        if (!slot || czyPominietaSekcjaPanelu(slot)) return [];
        return [
          {
            id,
            label: slot.label,
            icon: slot.icon,
            children: slot.children,
            badge: slot.badge,
            isEmpty: slot.isEmpty,
            emptyLabel: slot.emptyLabel,
            collapsible: true,
            // SPEC-N §2.2 R3 — wszystko zwinięte poza „Akcje". Nie do nadpisania przez moduł.
            defaultOpen: id === 'actions',
          },
        ];
      }),
    [rightPanel]
  );

  // `NModeShell` przyjmuje tablice mutowalne — kopiujemy, nie rzutujemy.
  const wlasciwosci: NModePropertyField[] | undefined = useMemo(
    () => (properties ? [...properties] : undefined),
    [properties]
  );
  const akcjePaska: NModeAction[] = useMemo(() => [...(headerActions ?? [])], [headerActions]);
  const akcjeAISekcji: NModeAIContextAction[] = useMemo(
    () => [...(aiContextActions ?? [])],
    [aiContextActions]
  );
  const akcjeAINarzedzia: NModeAction[] = useMemo(
    () => [...(toolAIActions ?? [])],
    [toolAIActions]
  );

  return (
    <NModeShell
      header={naglowek}
      properties={wlasciwosci}
      propertiesMaxColumns={propertiesMaxColumns}
      sections={sekcjeNMode}
      actions={akcjePaska}
      actionsVisible={headerActionsVisible ?? akcjePaska.length > 0}
      aiContextActions={akcjeAISekcji}
      toolAIActions={akcjeAINarzedzia}
      // §2.4 — slot `toolbar` to JEDYNA droga własnego paska; surowy `renderActionBar`
      // nie jest wystawiony w propsach powłoki, więc bespoke <div> nie ma którędy wejść.
      renderActionBar={toolbar ? () => toolbar : undefined}
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      onSectionReorder={onSectionReorder}
      presentationMode={densityMode}
      onPresentationModeChange={onDensityModeChange}
      showModeSwitcher={false}
      buildArtifactCode={buildArtifactCode}
      loading={loading}
      reducedMotion={reducedMotion}
      motionDuration={motionDuration}
      rightPanel={
        <ArtifactRightPanel
          sections={sekcjePanelu}
          width={panelWidth}
          ariaLabel={panelAriaLabel}
          statusBar={panelStatusBar}
        />
      }
    >
      {nakladki}
    </NModeShell>
  );
}

export default StandardArtifactShell;
