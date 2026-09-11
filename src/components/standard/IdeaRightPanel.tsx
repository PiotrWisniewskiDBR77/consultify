/**
 * IdeaRightPanel — JEDEN kanoniczny prawy panel narzędzi idei (canvas / My Work).
 *
 * SSOT doktryny: Harvard/wdrozenie-100/_KONCEPT_IDEAS_TERESA_2026-07-10.md §4
 * (#8/#9/Z16) + ★D17 (07-12, cytat Piotra): „Generalnie wszystko korzysta z
 * panelu Teresy — nigdy nie ma innego i przekładamy go na PRAWĄ stronę ekranu."
 *
 * Z8 (2026-07-22): przebudowa na 5 sekcji KANONU SPEC-A
 * (Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md §10.2/§11.2) — powłoka
 * wspólna wszystkich artefaktów, nie własny 3-kartowy układ Idei:
 *
 *     Akcje · Właściwości · Powiązania · Komentarze · Historia
 *
 * Mapowanie starych 3 kart → 5 kanonicznych (wzór dev-render/screens/idea-table.tsx):
 *   - Akcje         NOWA — `PreviewActionBar` z realnymi akcjami workspace
 *                   (eksport/konwertuj), podpięta przez `onExport`/`onConvert`.
 *   - Właściwości   1:1 dawna karta „Właściwości" (`propertiesContent`,
 *                   zwykle <IdeaWorkspaceTools embedded>) — bez zmian.
 *   - Powiązania    dawna karta „Kontekst" (`relationsContent`, zwykle
 *                   <IdeaContextPanel embedded>) SCALONA z dawną opcjonalną
 *                   5. kartą „Źródła i założenia" (HP-17 `EvidencePanelSection`)
 *                   — oba renderują się w JEDNEJ sekcji Powiązania, evidence
 *                   dołączony pod treścią kontekstu gdy `evidenceArtifactId`
 *                   jest podane (flaga `ff_evidencePanel`; brak = nic się nie
 *                   dokłada, zero zmian DOM jak przed Z8).
 *   - Komentarze    NOWA — brak workspace-level kanału komentarzy dla idei
 *                   (per-node wątki w NodeCommentThread/WhiteboardNodeComment-
 *                   Thread/ProcessFlowNodeCommentThread to inny zakres: wątek
 *                   NA WĘŹLE, nie na artefakcie). Sekcja renderuje się jako
 *                   pusta (`isEmpty`, emptyLabel „Brak komentarzy").
 *   - Historia      dawna karta „Teresa" (`teresaContent`, <IdeaTeresaSection>)
 *                   — bez zmian funkcji, nowa etykieta wg kanonu.
 *                   ★ Ta linia opisuje WYŁĄCZNIE ścieżkę flagi OFF (patrz niżej).
 *
 * Zasady (reużycie 1:1, NIE bespoke):
 *  - Ten komponent buduje WYŁĄCZNIE strukturę sekcji + akcje-skrót (Akcje);
 *    treść Właściwości/Powiązania/Historia-AI dalej DEKLARUJE moduł wołający
 *    (propertiesContent/relationsContent/teresaContent) — wygląd narzuca
 *    `<ArtifactRightPanel>` (nagłówki L1 UPPERCASE c-text-muted, chevron,
 *    ramki c-*, collapse).
 *  - Wyłącznie tokeny `c-*` (dziedziczone z ArtifactRightPanel/PreviewActionBar).
 *    Zero crimson, zero navy/slate. Fokus = c-focus (w ArtifactRightPanel).
 *  - Identyczny co do piksela dla 4 narzędzi (mindmap/process_flow/whiteboard/
 *    table) — różni się WYŁĄCZNIE deklaracja treści.
 *
 * ★ Rozwożenie prawego pasa (2026-08-30, docs/program/grafika/ANALIZA_PRAWY_PANEL.md
 * §3/§4, właściciel: „cały ten prawy panel jest ewidentnie do przepracowania").
 * Zmierzony defekt: Teresa (`teresaContent` = `<IdeaTeresaSection>`, komendy +
 * strumień sugestii) mieszkała w sekcji akordeonu NAZWANEJ „Historia", mimo że
 * nie ma nic wspólnego z historią zmian — dokładnie ten rozjazd nazw, który
 * D17 nakazuje naprawić przez wyniesienie Teresy na osobną IKONĘ SZYNY (jak
 * w Wordzie). Za flagą `ff_artifact_right_rail` (`isArtifactRightRailEnabled`,
 * domyślnie OFF):
 *  - Sekcja „Historia" znika z akordeonu Artefaktu (bez zastosowania — była
 *    tylko kontenerem na Teresę, kanon mówi „lepiej brak niż pusty akordeon
 *    udający funkcję"). Akcje/Właściwości/Powiązania/Komentarze zostają 1:1.
 *  - Komendy Teresy (Uzupełnij puste · Synteza · Kontrola jakości · Kontynuuj)
 *    i CTA „Rozmawiaj z Teresą" przechodzą do trybu Teresa szyny —
 *    zbudowane przez wołającego (`IdeaMapWorkspace`) z JEDNEGO źródła treści
 *    (`IDEA_TERESA_COMMANDS` w `IdeaTeresaSection.tsx`), nie drugiej kopii.
 *  - Proaktywny strumień sugestii AI (`aiSuggestionsContent`, ten sam
 *    `<IdeaAISuggestionsPanel embedded>` co dawniej) dostaje WŁASNĄ ikonę
 *    szyny (tryb zależny od typu „Sugestie") zamiast być zagrzebany pod
 *    komendami w jednej karcie — to realne, bogate narzędzie (generatory AI,
 *    wyszukiwanie, akceptuj/odrzuć), nie pasuje do wąskiego kontraktu
 *    wiadomości czatu trybu Teresa.
 * Przy fladze OFF WSZYSTKIE nowe propsy (`title`/`onDiscussWithTeresa`/
 * `teresaCommands`/`aiSuggestionsContent`/`defaultRailModeId`) są martwe —
 * ścieżka renderu (`<ArtifactRightPanel sections={sections} />`, sections
 * WŁĄCZNIE z „Historia") ich nie dotyka.
 */
import {
  FileSpreadsheet,
  History as HistoryIcon,
  Lightbulb,
  Link2,
  MessageSquare,
  Repeat,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import React, { useMemo } from 'react';

import { PreviewActionBar } from '@/components/shared/PreviewPane';
import {
  ARTIFACT_PANEL_SECTION_ORDER,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import {
  type ArtifactRailTeresaCommand,
  type ArtifactRailTeresaMode,
  type ArtifactRailTypeMode,
  ArtifactRightRail,
} from '@/components/standard/ArtifactRightRail';
import { EvidencePanelSection } from '@/components/standard/EvidencePanelSection';
import { IdeaNotebookRightPanelPrototypeGate } from '@/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype';
import { isArtifactRightRailEnabled } from '@/utils/artifactRightRailFlag';

/** Która sekcja ma być otwarta na starcie (mapowana z aktywnego klawisza paska). */
export type IdeaRightPanelSectionKey = 'properties' | 'relations' | 'teresa' | null;

export interface IdeaRightPanelProps {
  /** Sekcja domyślnie otwarta (z paska przełącznika). null = pierwsza (Akcje). */
  activeSection?: IdeaRightPanelSectionKey;
  /** Treść karty „Właściwości" (zwykle <IdeaWorkspaceTools embedded>). */
  propertiesContent: React.ReactNode;
  /**
   * Treść karty „Powiązania" (dawny „Kontekst", zwykle <IdeaContextPanel
   * embedded>: backlinki, powiązane inicjatywy, luki assessmentu, insighty,
   * KPI, podobne idee).
   */
  relationsContent: React.ReactNode;
  /** Treść karty „Historia" (komendy + strumień sugestii — <IdeaTeresaSection>). */
  teresaContent: React.ReactNode;
  /**
   * HP-17: id artefaktu canvas (tool_session/mindmap id) — gdy podane (flaga
   * `ff_evidencePanel` ON u wołającego), `EvidencePanelSection` („Źródła i
   * założenia") dokłada się POD `relationsContent` w tej samej sekcji
   * Powiązania (Z8: scalenie, już nie osobna 6. karta). `undefined` → nic się
   * nie dokłada, zero zmian DOM.
   */
  evidenceArtifactId?: string;
  /**
   * Akcja „Eksportuj" w karcie Akcje — realny handler workspace (zwykle
   * `() => setExportMenuOpen(true)`, ten sam co kebab Menu 1 / Menu 3).
   * Pominięte → przycisk się nie renderuje (nigdy stub/no-op).
   */
  onExport?: () => void;
  /**
   * Akcja „Konwertuj" w karcie Akcje — realny handler workspace (zwykle
   * `() => handlePanelChange('tools')`, otwiera kartę Właściwości, gdzie
   * żyje faktyczny wybór celu konwersji — ta sama ścieżka co Menu 3
   * `onConvertFromMap` w wariancie EditorShell). Pominięte → przycisk się
   * nie renderuje.
   */
  onConvert?: () => void;
  /**
   * Szerokość panelu. DOMYŚLNIE token `--ntype-right-panel-width` (320 px) —
   * ta sama szerokość co karty N i każdy inny prawy pas akordeonowy.
   *
   * ★ NAPRAWA 2026-09-01 (dyżur 164): stało tu `360`, przez co dok Teresy
   * Idei był o 40 px szerszy od kart N. Zmierzone przy 320 px: ZERO nowych
   * ucięć treści względem 360 px. Nie wpisuj liczby — szerokość ma jedno
   * źródło (`src/index.css`).
   */
  width?: number | string;
  /** PL/EN etykiety nagłówków sekcji. */
  isPolish?: boolean;

  /**
   * ★ Poniższe propsy mają skutek WYŁĄCZNIE za flagą `ff_artifact_right_rail`
   * (`isArtifactRightRailEnabled`, domyślnie OFF) — przy OFF ich brak lub
   * obecność nie zmienia renderu ani o jeden piksel.
   */

  /** Nazwa idei/mapy — nagłówek szyny + kontekst trybu Teresa. Bez tego — brak nagłówka (jak dziś). */
  title?: string;
  /**
   * @deprecated DEC-419 (06.09.2026): karmił przycisk-wejście „Zapytaj Teresę
   * o tę ideę" w sekcji Akcje (usunięty — wejście jest teraz w Menu 1,
   * DEC-404). Prop zostaje deklarowany, żeby nie wywrócić wołającego
   * (`IdeaMapWorkspace`), ale ten komponent go już nie czyta.
   */
  onDiscussWithTeresa?: () => void;
  /**
   * Gotowe komendy trybu Teresa (Uzupełnij puste · Synteza · Kontrola
   * jakości · Kontynuuj) — budowane przez wołającego z JEDNEGO źródła treści
   * (`IDEA_TERESA_COMMANDS`, `IdeaTeresaSection.tsx`), bo etykiety i prompty
   * to treść domeny Idei, nie tego generycznego panelu. Puste/pominięte →
   * tryb Teresa renderuje się bez chipów komend (nie stub).
   */
  teresaCommands?: ArtifactRailTeresaCommand[];
  /**
   * Proaktywny strumień sugestii AI (zwykle
   * `<IdeaAISuggestionsPanel embedded>`, ten sam komponent co dawniej pod
   * kartą „Historia") — dostaje WŁASNĄ ikonę szyny (tryb zależny od typu),
   * bo to realne, bogate narzędzie, nie treść czatu. Pominięte → brak tej
   * ikony na szynie (nie pusty tryb udający funkcję).
   */
  aiSuggestionsContent?: React.ReactNode;
  /**
   * Który tryb szyny otwiera się na start (`artefakt` | `teresa` | `sugestie`).
   * Nieustawiony → pierwszy zadeklarowany tryb (Artefakt). Realny konsument:
   * harness dev-render, do deterministycznych zrzutów każdego trybu.
   */
  defaultRailModeId?: string;
}

export const IdeaRightPanel: React.FC<IdeaRightPanelProps> = ({
  activeSection = null,
  propertiesContent,
  relationsContent,
  teresaContent,
  evidenceArtifactId,
  onExport,
  onConvert,
  width = 'var(--ntype-right-panel-width)',
  isPolish = false,
  title,
  onDiscussWithTeresa,
  teresaCommands,
  aiSuggestionsContent,
  defaultRailModeId,
}) => {
  const sections = useMemo<ArtifactRightPanelSection[]>(() => {
    const actionButtons = [
      onExport
        ? {
            label: isPolish ? 'Eksportuj' : 'Export',
            icon: FileSpreadsheet,
            colorScheme: 'neutral' as const,
            onClick: onExport,
            flex: true,
          }
        : null,
      onConvert
        ? {
            label: isPolish ? 'Konwertuj' : 'Convert',
            icon: Repeat,
            colorScheme: 'neutral' as const,
            onClick: onConvert,
            flex: true,
          }
        : null,
    ].filter((b): b is NonNullable<typeof b> => b !== null);

    const hasActions = actionButtons.length > 0;

    // ★ NAPRAWA 2026-08-30 (przegląd `PRZEGLAD_PRZED_ODBIOREM.md` §Z-2 + kanon
    // z odbiorów): panel idei łamał kanon w DWÓCH miejscach naraz.
    //  1. „Źródła i założenia" nie istniały jako sekcja — `EvidencePanelSection`
    //     był doklejony pod treścią „Powiązań" (scalenie Z8). Czwarta sekcja
    //     kanonu po prostu nie miała nagłówka, więc na zrzucie jej nie było.
    //     Teraz jest własną sekcją `evidence`, a gdy idea nie ma jeszcze
    //     artefaktu dowodowego — mówi to wprost stanem pustym (nie znika).
    //  2. CAŁA Teresa (komendy + strumień sugestii) siedziała w środku sekcji
    //     „Historia". To łamie kontrakt `ArtifactRailTeresaMode`
    //     (`ArtifactRightRail.tsx`): „② Tryb Teresa — pełna wysokość, własne
    //     pole pisania. NIGDY sekcja akordeonu." Dopóki wspólny pas jest za
    //     flagą OFF, kanonicznym miejscem wejścia do Teresy jest sekcja AKCJE —
    //     dokładnie tak, jak w odebranym przez właściciela `deck-artifact`
    //     („Zapytaj Teresę" jako czwarty przycisk Akcji). „Historia" zostaje
    //     historią i uczciwie mówi, że jest pusta.
    // KOLEJNOŚĆ renderu pochodzi z kanonicznej `ARTIFACT_PANEL_SECTION_ORDER`,
    // nazwy i domknięcie sześciu sekcji narzuca `ArtifactRightPanel`.
    const byId: Partial<Record<ArtifactRightPanelSection['id'], ArtifactRightPanelSection>> = {
      actions: {
        id: 'actions',
        label: isPolish ? 'Akcje' : 'Actions',
        icon: Sparkles,
        defaultOpen: activeSection === null || activeSection === 'teresa',
        isEmpty: !hasActions && !teresaContent,
        emptyLabel: isPolish ? 'Brak dostępnych akcji.' : 'No actions available.',
        children: (
          <div className="space-y-4">
            {hasActions ? <PreviewActionBar rows={[{ buttons: actionButtons }]} /> : null}
            {teresaContent}
          </div>
        ),
      },
      properties: {
        id: 'properties',
        label: isPolish ? 'Właściwości' : 'Properties',
        icon: SlidersHorizontal,
        children: propertiesContent,
        defaultOpen: activeSection === 'properties',
      },
      relations: {
        id: 'relations',
        label: isPolish ? 'Powiązania' : 'Relations',
        icon: Link2,
        defaultOpen: activeSection === 'relations',
        children: relationsContent,
      },
      evidence: {
        id: 'evidence',
        label: isPolish ? 'Źródła i założenia' : 'Sources and assumptions',
        icon: ShieldCheck,
        defaultOpen: false,
        isEmpty: !evidenceArtifactId,
        emptyLabel: isPolish
          ? 'Brak zapisanych źródeł i założeń.'
          : 'No sources or assumptions recorded.',
        children: evidenceArtifactId ? (
          <EvidencePanelSection
            artifactType="canvas"
            artifactId={evidenceArtifactId}
            isPolish={isPolish}
          />
        ) : null,
      },
      comments: {
        id: 'comments',
        label: isPolish ? 'Komentarze' : 'Comments',
        icon: MessageSquare,
        defaultOpen: false,
        isEmpty: true,
        emptyLabel: isPolish ? 'Brak komentarzy.' : 'No comments yet.',
        children: null,
      },
      history: {
        id: 'history',
        label: isPolish ? 'Historia' : 'History',
        icon: HistoryIcon,
        defaultOpen: false,
        isEmpty: true,
        emptyLabel: isPolish ? 'Brak zapisanej historii.' : 'No history recorded.',
        children: null,
      },
    };
    return ARTIFACT_PANEL_SECTION_ORDER.map((id) => byId[id]).filter(
      (section): section is ArtifactRightPanelSection => section !== undefined
    );
  }, [
    isPolish,
    activeSection,
    propertiesContent,
    relationsContent,
    teresaContent,
    evidenceArtifactId,
    onExport,
    onConvert,
  ]);

  // Wspólny prawy pas (`ArtifactRightRail`) — flaga DOMYŚLNIE OFF
  // (src/utils/artifactRightRailFlag.ts). Przy OFF ta zmienna jest `false`,
  // więc poniższa gałąź nigdy nie renderuje się i `sections` (WŁĄCZNIE z
  // „Historia" = teresaContent) idzie 1:1 do dawnej ścieżki bez zmian.
  const artifactRailEnabled = isArtifactRightRailEnabled();

  const railTypeModes = useMemo<ArtifactRailTypeMode[]>(() => {
    if (!aiSuggestionsContent) return [];
    return [
      {
        id: 'sugestie',
        label: isPolish ? 'Sugestie' : 'Suggestions',
        icon: Lightbulb,
        contextLabel: isPolish
          ? 'Proaktywne sugestie AI dla tej idei — rozwiń mapę, uzupełnij luki, sprawdź ryzyka.'
          : 'Proactive AI suggestions for this idea — expand the map, fill gaps, flag risks.',
        content: aiSuggestionsContent,
      },
    ];
  }, [aiSuggestionsContent, isPolish]);

  const railTeresaMode = useMemo<ArtifactRailTeresaMode>(
    () => ({
      contextLabel: title ? (isPolish ? `Idea „${title}"` : `Idea "${title}"`) : undefined,
      commands: teresaCommands ?? [],
      // Idea nie ma dziś WŁASNEGO zapisanego wątku rozmowy per-artefakt — jest
      // wspólny dok czatu. Mówimy to wprost (jak notatnik) zamiast rysować
      // pusty strumień udający historię.
      messages: [],
      emptyLabel: isPolish
        ? 'Ta idea nie ma jeszcze własnego wątku rozmowy — otwórz rozmowę, żeby zacząć.'
        : 'This idea has no conversation thread of its own yet — open the conversation to start.',
      // BRAK `onSend`: pole pisania renderuje się wyłączone z jawnym powodem.
      // Wątek per-idea to praca toru funkcji (kontrakt danych), nie toru
      // grafiki — patrz §"Połowa funkcjonalna" analizy prawego panelu.
      composeDisabledReason: isPolish
        ? 'Pisanie wprost w pasie będzie możliwe, gdy idea dostanie własny wątek rozmowy.'
        : 'Typing directly in the rail will be possible once the idea has its own conversation thread.',
      /*
        ★ DEC-419 (właściciel, 06.09.2026, karta Inicjatywy): przycisk-wejście
        do Teresy w sekcji „Akcje" USUNIĘTY — jedyne wejście jest teraz w
        Menu 1 (DEC-404). Do 06.09 z całego trybu Teresy skutek miała para
        `entryLabel` + `footerAction`; obie pola zniknęły stąd, bo
        `ArtifactRightRail` już ich nie czyta. Pola wyżej
        (`commands`/`messages`/`composeDisabledReason`) zostają w deklaracji,
        bez skutku wizualnego — czatu na szynie nie ma od 2026-09-01.
      */
    }),
    [title, isPolish, teresaCommands]
  );

  if (artifactRailEnabled) {
    // Sekcja „Historia" znika — bez zastosowania po wyniesieniu Teresy do
    // ikony szyny (była tylko kontenerem na `teresaContent`, kanon mówi
    // „lepiej brak niż pusty akordeon udający funkcję"). Kolejność
    // pozostałych czterech sekcji zostaje 1:1 (pochodzi z tego samego
    // `sections`, więc jedno źródło treści dla obu ścieżek).
    const railArtifactSections = sections.filter((section) => section.id !== 'history');
    return (
      <ArtifactRightRail
        title={title}
        ariaLabel={isPolish ? 'Panel narzędzi idei' : 'Idea tools panel'}
        artifact={{ sections: railArtifactSections }}
        teresa={railTeresaMode}
        typeModes={railTypeModes}
        defaultModeId={defaultRailModeId}
        // Szyna ikon (`ArtifactRightRail`) to TRZECI, świadomy kształt prawego
        // pasa — ten sam co Word (`document-artifact`) — i ma własną szerokość
        // panelu spójną z `useRailState.defaultRightWidth`. Nadpisujemy ją
        // tylko wtedy, gdy wołający podał JAWNĄ liczbę; token akordeonu
        // (string `var(...)`) nie ma tu sensu, bo szyna liczy piksele przy
        // zmianie rozmiaru.
        panelWidth={typeof width === 'number' ? width : undefined}
        testId="idea-artifact-right-rail"
      />
    );
  }

  // DEC-419 (06.09.2026): przycisk „Zapytaj Teresę o tę ideę" usunięty z
  // sekcji Akcje — wejście do Teresy jest w Menu 1 (DEC-404).
  const currentPanel = (
    <ArtifactRightPanel
      sections={sections}
      width={width}
      ariaLabel={isPolish ? 'Panel narzędzi idei' : 'Idea tools panel'}
    />
  );

  return (
    <IdeaNotebookRightPanelPrototypeGate
      context="idea"
      language={isPolish ? 'pl' : 'en'}
      title={title}
      ariaLabel={isPolish ? 'Panel narzędzi idei' : 'Idea tools panel'}
      sections={sections}
      legacy={currentPanel}
    />
  );
};

export default IdeaRightPanel;
