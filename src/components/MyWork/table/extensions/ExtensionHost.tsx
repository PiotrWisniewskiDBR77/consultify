import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ExtensionHostProps {
  extensionId: string;
  sourceUrl: string;
  scopes: string[];
  baseId: string;
  tableId?: string;
  config?: Record<string, unknown>;
  onClose?: () => void;
}

type SDKMessage =
  | { type: 'tp:ready' }
  | { type: 'tp:getRecords'; requestId: string; tableId: string; options?: unknown }
  | { type: 'tp:createRecord'; requestId: string; tableId: string; data: unknown }
  | { type: 'tp:updateRecord'; requestId: string; recordId: string; data: unknown }
  | { type: 'tp:deleteRecord'; requestId: string; recordId: string }
  | { type: 'tp:getSchema'; requestId: string; tableId: string }
  | { type: 'tp:getConfig'; requestId: string }
  | { type: 'tp:setConfig'; requestId: string; config: unknown }
  | {
      type: 'tp:showNotification';
      message: string;
      notificationType: 'info' | 'success' | 'error';
    };

export const ExtensionHost: React.FC<ExtensionHostProps> = ({
  extensionId,
  sourceUrl,
  scopes,
  baseId,
  tableId,
  config,
  onClose,
}) => {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [notification, setNotification] = useState<{ message: string; kind: string } | null>(null);

  const hasScope = useCallback((scope: string) => scopes.includes(scope), [scopes]);

  const sendResponse = useCallback((requestId: string, data: unknown, error?: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'tp:response', requestId, data, error },
      '*'
    );
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const msg = event.data as SDKMessage;
      if (!msg?.type?.startsWith('tp:')) return;

      switch (msg.type) {
        case 'tp:ready':
          setIsReady(true);
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'tp:init', baseId, tableId, config, scopes },
            '*'
          );
          break;

        case 'tp:getRecords': {
          if (!hasScope('records:read')) {
            sendResponse(msg.requestId, null, 'Permission denied: records:read scope required');
            return;
          }
          try {
            const resp = await fetch(
              `/api/table-platform/tables/${msg.tableId}/records?pageSize=100`
            );
            const data = await resp.json();
            sendResponse(msg.requestId, data);
          } catch (err: unknown) {
            sendResponse(msg.requestId, null, (err as Error).message);
          }
          break;
        }

        case 'tp:createRecord': {
          if (!hasScope('records:write')) {
            sendResponse(msg.requestId, null, 'Permission denied: records:write scope required');
            return;
          }
          try {
            const resp = await fetch(`/api/table-platform/tables/${msg.tableId}/records`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: msg.data }),
            });
            const data = await resp.json();
            sendResponse(msg.requestId, data);
          } catch (err: unknown) {
            sendResponse(msg.requestId, null, (err as Error).message);
          }
          break;
        }

        case 'tp:updateRecord': {
          if (!hasScope('records:write')) {
            sendResponse(msg.requestId, null, 'Permission denied: records:write scope required');
            return;
          }
          try {
            const resp = await fetch(`/api/table-platform/records/${msg.recordId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: msg.data }),
            });
            const data = await resp.json();
            sendResponse(msg.requestId, data);
          } catch (err: unknown) {
            sendResponse(msg.requestId, null, (err as Error).message);
          }
          break;
        }

        case 'tp:deleteRecord': {
          if (!hasScope('records:write')) {
            sendResponse(msg.requestId, null, 'Permission denied: records:write scope required');
            return;
          }
          try {
            const resp = await fetch(`/api/table-platform/records/${msg.recordId}`, {
              method: 'DELETE',
            });
            if (resp.ok) sendResponse(msg.requestId, { ok: true });
            else sendResponse(msg.requestId, null, `Delete failed: ${resp.status}`);
          } catch (err: unknown) {
            sendResponse(msg.requestId, null, (err as Error).message);
          }
          break;
        }

        case 'tp:getSchema': {
          if (!hasScope('metadata:read')) {
            sendResponse(msg.requestId, null, 'Permission denied: metadata:read scope required');
            return;
          }
          try {
            const resp = await fetch(`/api/table-platform/tables/${msg.tableId}/fields`);
            const data = await resp.json();
            sendResponse(msg.requestId, data);
          } catch (err: unknown) {
            sendResponse(msg.requestId, null, (err as Error).message);
          }
          break;
        }

        case 'tp:getConfig':
          sendResponse(msg.requestId, config || {});
          break;

        case 'tp:setConfig': {
          try {
            await fetch(`/api/table-platform/bases/${baseId}/extensions/${extensionId}/config`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ config: msg.config }),
            });
            sendResponse(msg.requestId, { ok: true });
          } catch (err: unknown) {
            sendResponse(msg.requestId, null, (err as Error).message);
          }
          break;
        }

        case 'tp:showNotification':
          setNotification({ message: msg.message, kind: msg.notificationType });
          setTimeout(() => setNotification(null), 3000);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [baseId, tableId, config, scopes, hasScope, sendResponse, extensionId]);

  return (
    <div className="relative flex flex-col h-full border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-c-surface-raised border-b">
        <span className="text-sm font-medium text-c-text-secondary">
          {t('myWorkTable.extensionHost.extension', 'Extension')}
        </span>
        <div className="flex items-center gap-2">
          {!isReady && (
            <span className="text-xs text-c-text-secondary">
              {t('myWorkTable.extensionHost.loading', 'Loading...')}
            </span>
          )}
          <span className="text-xs text-c-text-secondary">
            {t('myWorkTable.extensionHost.scopeCount', { count: scopes.length })}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="text-c-text-secondary hover:text-c-text-secondary text-sm leading-none"
              aria-label={t('myWorkTable.extensionHost.closeExtension', 'Close extension')}
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {notification && (
        <div
          className={`px-3 py-2 text-sm ${
            notification.kind === 'error'
              ? 'bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] text-c-danger'
              : notification.kind === 'success'
                ? 'bg-c-success text-c-success'
                : 'bg-c-info text-c-info'
          }`}
        >
          {notification.message}
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={sourceUrl}
        sandbox="allow-scripts allow-forms allow-same-origin"
        className="flex-1 w-full border-0"
        title={t('myWorkTable.extensionHost.extension', 'Extension')}
      />
    </div>
  );
};
