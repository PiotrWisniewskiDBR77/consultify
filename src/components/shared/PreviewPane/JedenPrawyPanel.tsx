import { Pin, PinOff } from 'lucide-react';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import {
  PREVIEW_HEADER_ICON_BUTTON,
  PREVIEW_HEADER_ICON_BUTTON_ACTIVE,
  PREVIEW_HEADER_ICON_SIZE,
  PREVIEW_HEADER_OPEN_BUTTON,
} from '@/components/shared/PreviewPane/previewStyles';
import { PREVIEW_PANE_WIDTH } from '@/components/shared/PreviewPane/previewGeometry';
import { registerEmbeddedModuleChatHost } from '@/components/shared/embeddedModuleChatHost';
import type { StandardPreviewProps } from '@/components/standard/StandardPreview';
import { PreviewPaneShell } from '@/components/ui/ResizableTable/PreviewPaneShell';
import type { WorkspaceContext } from '@/types/workspace';

import { useJedenPanel } from './useJedenPanel';

export interface JedenPrawyPanelProps {
  rekord: React.ReactElement<StandardPreviewProps> | null;
  /**
   * ★ DEC-404: zachowane wyłącznie dla zgodności wołaczy — panel podglądu nie
   * renderuje już Teresy, więc kontekst rozmowy nie ma tu odbiorcy. Kontekst
   * pracy dla doku liczy `MainLayout` z bieżącego widoku.
   */
  kontekst?: WorkspaceContext;
  className?: string;
}

/**
 * ★ DEC-404 (właściciel, 06.09.2026): panel podglądu = TYLKO REKORD.
 *
 * Do 06.09 ten panel miał rząd zakładek „Rekord | Teresa" i po kliknięciu
 * drugiej montował własny `UnifiedChatPanel` w kolumnie 380 px. Właściciel
 * odrzucił ten kształt („tu nie jest jej miejsce"). Teresa otwiera się teraz
 * wyłącznie jako STANDARDOWY dok w `MainLayout` — a ten dok ZASTĘPUJE tę
 * kolumnę (patrz `panel.dokOtwarty` niżej), więc na ekranie nadal jest
 * dokładnie jeden `<aside>` i dokładnie jeden `UnifiedChatPanel`.
 */
export function JedenPrawyPanel({ rekord, className }: JedenPrawyPanelProps) {
  const { t } = useTranslation();
  const panel = useJedenPanel();

  /*
   * Meldunek gospodarza P1 zostaje — ale ma już TYLKO jedno zadanie: pigułka
   * „Pokaż panel" w Menu 3 (`useStandardPanelControls`) musi wiedzieć, że na
   * ekranie jest co pokazywać. `MainLayout` NIE gasi po nim doku (DEC-404);
   * gdyby gasił, wróciłby dokładnie odrzucony kształt „Teresa w kolumnie
   * podglądu".
   */
  useEffect(() => registerEmbeddedModuleChatHost(), []);

  // Dok Teresy zajmuje tę samą kolumnę — podgląd się chowa, stan `zamkniety`
  // zostaje nietknięty, więc po zamknięciu doku wraca dokładnie to, co było.
  const widoczny = !panel.zamkniety && !panel.dokOtwarty && !!rekord;
  if (!widoczny) return null;

  const props = rekord?.props;

  const zamknij = () => {
    panel.zamknij();
    props?.onClose?.();
  };

  const akcjeRekordu = props ? (
    <>
      {props.onTogglePin ? (
        <button
          type="button"
          onClick={props.onTogglePin}
          className={props.pinned ? PREVIEW_HEADER_ICON_BUTTON_ACTIVE : PREVIEW_HEADER_ICON_BUTTON}
          aria-label={props.pinned ? t('common.unpin', 'Unpin') : t('common.pin', 'Pin')}
        >
          {props.pinned ? (
            <PinOff size={PREVIEW_HEADER_ICON_SIZE} />
          ) : (
            <Pin size={PREVIEW_HEADER_ICON_SIZE} />
          )}
        </button>
      ) : null}
      {props.headerExtra}
      {props.onOpenFull ? (
        <button type="button" onClick={props.onOpenFull} className={PREVIEW_HEADER_OPEN_BUTTON}>
          {props.openLabel ?? t('common.open', 'Open')}
        </button>
      ) : props.openDisabledReason ? (
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={props.openDisabledReason}
          className={PREVIEW_HEADER_OPEN_BUTTON}
        >
          {t('common.open', 'Open')}
        </button>
      ) : null}
    </>
  ) : null;

  return (
    <aside
      data-right-panel
      className={[
        'h-full shrink-0 overflow-hidden bg-c-surface-raised p-3',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ width: PREVIEW_PANE_WIDTH }}
    >
      <PreviewPaneShell
        title={props?.title ?? t('list.rightPanel.tabRecord', 'Record')}
        onClose={zamknij}
        closeLabel={t('list.rightPanel.close', 'Close panel')}
        bodyClassName="p-4"
        actions={akcjeRekordu}
      >
        {rekord ? React.cloneElement(rekord, { embedded: true, onClose: undefined }) : null}
      </PreviewPaneShell>
    </aside>
  );
}

export default JedenPrawyPanel;
