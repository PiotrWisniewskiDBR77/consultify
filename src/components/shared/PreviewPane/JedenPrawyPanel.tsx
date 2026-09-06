import { Pin, PinOff } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import {
  PREVIEW_HEADER_ICON_BUTTON,
  PREVIEW_HEADER_ICON_BUTTON_ACTIVE,
  PREVIEW_HEADER_ICON_SIZE,
  PREVIEW_HEADER_OPEN_BUTTON,
} from '@/components/shared/PreviewPane/previewStyles';
import { PREVIEW_PANE_WIDTH } from '@/components/shared/PreviewPane/previewGeometry';
import { registerEmbeddedModuleChatHost } from '@/components/shared/embeddedModuleChatHost';
import {
  StandardPreview,
  type StandardPreviewProps,
} from '@/components/standard/StandardPreview';
import { PreviewPaneShell } from '@/components/ui/ResizableTable/PreviewPaneShell';
import type { WorkspaceContext } from '@/types/workspace';

import { useJedenPanel } from './useJedenPanel';

const UnifiedChatPanelLazy = React.lazy(() =>
  import('@/components/AIChat/UnifiedChatPanel').then((modul) => ({
    default: modul.UnifiedChatPanel,
  }))
);

export interface JedenPrawyPanelProps {
  rekord: React.ReactElement<StandardPreviewProps> | null;
  kontekst?: WorkspaceContext;
  className?: string;
}

export function JedenPrawyPanel({ rekord, kontekst, className }: JedenPrawyPanelProps) {
  const { t } = useTranslation();
  const panel = useJedenPanel();
  const poprzedniRekord = useRef(rekord);

  useEffect(() => registerEmbeddedModuleChatHost(), []);

  useEffect(() => {
    if (rekord && rekord !== poprzedniRekord.current && !panel.zamkniety) {
      panel.ustawZakladke('rekord');
    }
    poprzedniRekord.current = rekord;
  }, [panel, rekord]);

  const widoczny = !panel.zamkniety && (!!rekord || panel.zakladka === 'teresa');
  if (!widoczny) return null;

  const props = rekord?.props;
  const zakladki = rekord
    ? ([
        { id: 'rekord' as const, label: t('list.rightPanel.tabRecord', 'Record') },
        { id: 'teresa' as const, label: t('list.rightPanel.tabTeresa', 'Teresa') },
      ] as const)
    : ([{ id: 'teresa' as const, label: t('list.rightPanel.tabTeresa', 'Teresa') }] as const);

  const zamknij = () => {
    panel.zamknij();
    props?.onClose?.();
  };

  const akcjeRekordu = panel.zakladka === 'rekord' && props ? (
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
        title={panel.zakladka === 'teresa' ? t('list.rightPanel.tabTeresa', 'Teresa') : props?.title ?? t('list.rightPanel.tabRecord', 'Record')}
        onClose={zamknij}
        closeLabel={t('list.rightPanel.close', 'Close panel')}
        bodyClassName="p-4"
        actions={
          <>
            <div
              role="tablist"
              aria-label={t('list.rightPanel.tabs', 'Panel tabs')}
              className="inline-flex items-center gap-0.5 rounded-full bg-c-surface-raised p-0.5"
            >
              {zakladki.map((zakladka) => (
                <button
                  key={zakladka.id}
                  type="button"
                  role="tab"
                  aria-selected={panel.zakladka === zakladka.id}
                  onClick={() => panel.ustawZakladke(zakladka.id)}
                  className={`rounded-full px-3 py-1 text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] ${
                    panel.zakladka === zakladka.id
                      ? 'bg-c-surface text-c-text shadow-sm'
                      : 'text-c-text-secondary hover:text-c-text'
                  }`}
                >
                  {zakladka.label}
                </button>
              ))}
            </div>
            {akcjeRekordu}
          </>
        }
      >
        {panel.zakladka === 'teresa' ? (
          <React.Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-c-text-secondary">
                {t('common.loading', 'Loading…')}
              </div>
            }
          >
            <UnifiedChatPanelLazy
              mode="split"
              showModeToggle={false}
              workspaceContext={kontekst ?? null}
              className="h-full"
            />
          </React.Suspense>
        ) : rekord ? (
          React.cloneElement(rekord, { embedded: true, onClose: undefined })
        ) : null}
      </PreviewPaneShell>
    </aside>
  );
}

export default JedenPrawyPanel;
