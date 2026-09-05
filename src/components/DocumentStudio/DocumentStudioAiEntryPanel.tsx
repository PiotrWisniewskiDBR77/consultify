/**
 * Consultify Document Studio — „Z AI" entry panel (FAZA B1, 2026-07-27).
 *
 * Zastępuje `DocumentStudioIntakeForm` na ścieżce `docEntryMode === 'ai'`
 * kiedy flaga `ff_zai_teresa` jest ON (`src/utils/zaiTeresaFlag.ts`, default
 * OFF — czeka na akcept właściciela na zrzucie).
 *
 * Realizuje N11/N12/N13 (Harvard/wdrozenie-100/_NAGRANIE_PIOTRA_WIZJA_MATERIALY_2026-07-27.md):
 *   „Z AI → otwiera się dokument, a Z BOKU okno AI (czat)." — BEZ formularza
 *   (Description/Type/Density/Goal/Audience), BEZ dodatkowych kroków. Środek =
 *   pusty „dokument" (miejsce, w którym treść pojawi się na żywo — patrz
 *   `DocumentStudioGeneratingPanel`, który przejmuje ten sam ekran zaraz po
 *   pierwszej wiadomości).
 *
 * ★★★ WYJĄTEK WŁAŚCICIELA 2026-09-05 OD REGUŁY „JEDNA TERESA, W SWOIM OKNIE" ★★★
 * (01.09 zdjęło tu osadzony czat na rzecz pola briefu + przycisku do
 * globalnego okna Teresy — patrz historia gita `f2aa36b882`. Na żywym
 * odbiorze 05.09, ekran `document-studio-ai-teresa`, właściciel PRZYWRÓCIŁ
 * osadzony czat, dosłownie: „Nie, nie, tutaj praca się dzieje z Teresą; tu
 * nie ma po co dodawać kolejnego okna." To świadomy, imienny wyjątek TYLKO
 * dla Document Studio — reguła „jedna Teresa, w swoim oknie" zostaje
 * kanonem wszędzie indziej. Prawa kolumna wraca do `UnifiedChatPanel` w
 * trybie „split" (ten sam komponent i ten sam wzorzec co dawny czat Decka
 * — `DeckBuilder.tsx` `aiEntrySlot`, sprzed 01.09). `onModuleIntent`
 * przechwytuje PIERWSZĄ wystarczająco długą wiadomość i oddaje ją rodzicowi
 * (`DocumentStudioView.buildAiChatIntake`) jako brief generacji — dokładnie
 * ten sam kontrakt co przed 01.09 i co dawne pole briefu (próg
 * `MIN_DESCRIPTION_LENGTH`, `onFirstMessage` odpalane RAZ). Osobny przycisk
 * „Porozmawiaj z Teresą o tym dokumencie" (otwierający GŁÓWNE okno) znika —
 * po przywróceniu czatu w panelu byłby drugim wejściem do tej samej
 * rozmowy, czego właściciel wprost nie chciał.
 *
 * Wzorzec wybrany świadomie zamiast silnika Excela (`useKimiArtifactPipeline`
 * / `KimiWorkspaceShell`): ten silnik to zdegradowany/legacy Kimi
 * report-builder, którego Document Studio już ZASTĄPIŁO lepszym mechanizmem
 * (`runStreamingGeneration` + `DocumentStudioGeneratingPanel` — sekcja-po-
 * sekcji na żywo, TOP10 #8 benchmarku). Z Excela bierzemy tylko IDEĘ UI
 * (jedno pole zamiast formularza — Gamma/N7); z Decka bierzemy MECHANIZM
 * (`UnifiedChatPanel` + `onModuleIntent` przechwytujący pierwszą wiadomość).
 *
 * Parametry, które znikają z EKRANU (Type/Density/Goal/Audience), NIE znikają
 * z SYSTEMU — `DocumentStudioView.buildAiChatIntake` ustawia je na te same
 * domyślne co stary formularz (patrz ten plik, komentarz przy wywołaniu).
 */

import { FileText, Sparkles } from 'lucide-react';
import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { UnifiedChatPanel } from '@/components/AIChat/UnifiedChatPanel';
import { useAppStore } from '@/store/useAppStore';

/** Minimalna długość opisu, żeby uruchomić generację — te same widły co stary
 *  `DocumentStudioIntakeForm` (`description.trim().length >= 10`), tylko
 *  egzekwowane po stronie czatu zamiast blokowanego przycisku submit. Krótsza
 *  wiadomość NIE jest odrzucana — po prostu nie uruchamia generacji i Teresa
 *  odpowiada normalnie (np. prosi o doprecyzowanie), więc BANG-owy przepływ
 *  (N12) nigdy nie blokuje użytkownika twardym walidatorem. */
const MIN_DESCRIPTION_LENGTH = 10;

export interface DocumentStudioAiEntryPanelProps {
  /** Wywoływane RAZ, z treścią pierwszej wystarczająco długiej wiadomości
   *  użytkownika. Rodzic (DocumentStudioView) buduje z niej DocumentIntake
   *  z domyślnymi parametrami i uruchamia `runStreamingGeneration` — dokładnie
   *  tę samą ścieżkę co Mode 3 (bez ekranu podglądu outline'u, BANG). */
  onFirstMessage: (description: string) => void | Promise<void>;
  /** Generacja w toku — wyłącza input czatu, żeby nie wysłać drugiej wiadomości
   *  w trakcie budowania pierwszego dokumentu. */
  busy?: boolean;
  /** Błąd generacji (np. transportowy) — patrz `DocumentStudioView.error`.
   *  Wraca tu, gdy `runStreamingGeneration` zawiedzie i faza cofnie się do
   *  'intake' z tym panelem znowu na ekranie. */
  error?: string | null;
  /** D1 tri-tryby: gdy podane — link „← Wybór trybu" nad panelem (powrót do
   *  ekranu wyboru 3 trybów), tak samo jak w `DocumentStudioIntakeForm`. */
  onBackToModes?: () => void;
}

export const DocumentStudioAiEntryPanel: React.FC<DocumentStudioAiEntryPanelProps> = ({
  onFirstMessage,
  busy = false,
  error = null,
  onBackToModes,
}) => {
  const { t } = useTranslation();
  // Ten sam chip kontekstu co dawny formularz intake (P0 URODZINOWE
  // 2026-07-27) — przeniesiony znad pola opisu do nagłówka panelu Teresy,
  // żeby użytkownik nadal WIDZIAŁ, co zostanie automatycznie dołączone do
  // generacji (N7/Gamma: kontekst widoczny, nie ukryty). Auto-grounding sam
  // w sobie dzieje się po stronie serwera niezależnie od tego chipa —
  // `server/src/services/documentStudio/documentOrgContextSourcePack.ts`.
  const currentOrganization = useAppStore((s) => s.currentOrganization);

  // Przechwytuje PIERWSZĄ wystarczająco długą wiadomość i oddaje ją rodzicowi
  // jako brief generacji; każda kolejna wiadomość (gdyby ten panel z jakiegoś
  // powodu został na ekranie) trafia do normalnej rozmowy z Teresą zamiast
  // ponownie odpalać generację.
  const firedRef = useRef(false);
  const handleModuleIntent = useCallback(
    (content: string): boolean | { handled: boolean; reply?: string } => {
      if (firedRef.current) return false;
      const trimmed = content.trim();
      if (trimmed.length < MIN_DESCRIPTION_LENGTH) return false;
      firedRef.current = true;
      void onFirstMessage(trimmed);
      return {
        handled: true,
        reply: t(
          'documentStudio.aiEntry.startingReply',
          'Zaczynam planować i pisać dokument — pojawi się obok w kilka chwil.'
        ),
      };
    },
    [onFirstMessage, t]
  );

  return (
    <div
      data-testid="document-studio-ai-entry-panel"
      className="flex h-full min-h-0 flex-1 flex-col md:flex-row"
    >
      {/* Środek — „dokument" (N13: to musi być narzędzie, nie formularz).
          Pozostaje pusty, dopóki pierwsza wiadomość nie uruchomi generacji —
          wtedy `DocumentStudioView` przełącza fazę na 'generating', gdzie
          `DocumentStudioGeneratingPanel` przejmuje ten sam obszar i wypełnia
          go sekcja-po-sekcji na żywo (N16: plan → widoczna egzekucja). */}
      <div className="flex flex-1 min-w-0 flex-col items-center justify-center gap-3 border-b border-c-border-subtle p-8 text-center md:border-b-0 md:border-r">
        <div className="flex h-14 w-14 items-center justify-center rounded-hig-lg bg-c-surface-raised">
          <FileText size={26} className="text-c-text-secondary" aria-hidden />
        </div>
        <p className="text-sm font-medium text-c-text">
          {t('documentStudio.aiEntry.placeholderTitle', 'Twój dokument pojawi się tutaj')}
        </p>
        <p className="max-w-sm text-xs text-c-text-secondary">
          {t(
            'documentStudio.aiEntry.placeholderHint',
            'Opisz w oknie obok, jaki dokument potrzebujesz — Teresa zaplanuje strukturę i napisze pierwszą wersję na Twoich oczach.'
          )}
        </p>
        {onBackToModes ? (
          <button
            type="button"
            onClick={onBackToModes}
            className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-c-text-secondary transition-colors hover:text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {t('documentStudio.intake.backToModes', 'Wybór trybu')}
          </button>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="mt-2 max-w-sm rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-700 dark:text-danger-400"
          >
            {error}
          </div>
        ) : null}
      </div>

      {/* Z boku — Teresa (N11: "Z boku okno AI (czat)"), osadzona wprost w
          panelu — wyjątek właściciela z 05.09 opisany w nagłówku pliku. Ten
          sam komponent i tryb ("split") co trwały czat Decka sprzed 01.09
          (DeckBuilder.tsx aiEntrySlot). */}
      <div className="flex h-full w-full flex-col shrink-0 md:w-[380px] md:min-w-[320px] md:max-w-[420px]">
        {currentOrganization?.name ? (
          <div
            data-testid="docstudio-ai-entry-context-chip"
            className="flex items-center gap-1.5 border-b border-c-border-subtle px-3 py-2 text-xs text-c-text-secondary"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {t('documentStudio.intake.contextChip', {
                defaultValue: 'Context: {{organizationName}}',
                organizationName: currentOrganization.name,
              })}
            </span>
          </div>
        ) : null}
        <div className="min-h-0 flex-1">
          <UnifiedChatPanel
            mode="split"
            title={t('documentStudio.aiEntry.teresaTitle', 'Teresa')}
            onModuleIntent={handleModuleIntent}
            showModeToggle={false}
            showHistoryTrigger={false}
            showFocusMode={false}
            disabled={busy}
            maxHeight="100%"
          />
        </div>
      </div>
    </div>
  );
};

export default DocumentStudioAiEntryPanel;
