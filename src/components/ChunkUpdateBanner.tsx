import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CHUNK_UPDATE_EVENT,
  hasAlreadyAttemptedChunkReload,
} from '@/utils/chunkLoadRecovery';

/**
 * Z-11 (2026-09-14): jedyny, globalny baner "nowa wersja aplikacji — odśwież".
 * Mounted raz, blisko szczytu drzewa (poza `ErrorBoundary`, żeby przetrwał
 * awarię crashującej trasy) — nie per trasa, nie per moduł.
 *
 * Pokazuje się w dwóch przypadkach:
 * 1) globalny listener `vite:preloadError` w `index.tsx` ogłosił zdarzenie
 *    `CHUNK_UPDATE_EVENT` (bo jednorazowe auto-przeładowanie już się odbyło
 *    w tej sesji i chunk nadal brakuje);
 * 2) przy montażu — jeśli flaga jednorazowego przeładowania jest już
 *    ustawiona dla bieżącego URL (np. baner przetrwał sam reload, bo błąd
 *    nadal występuje po stronie serwera/CDN).
 */
export const ChunkUpdateBanner: React.FC = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState<boolean>(() => hasAlreadyAttemptedChunkReload());

  useEffect(() => {
    const handleUpdateAvailable = () => setVisible(true);
    window.addEventListener(CHUNK_UPDATE_EVENT, handleUpdateAvailable);
    return () => window.removeEventListener(CHUNK_UPDATE_EVENT, handleUpdateAvailable);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="chunk-update-banner"
      className="fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-3 border-b border-c-border bg-c-surface px-4 py-2.5 text-sm text-c-text shadow-md"
    >
      <span>{t('errors.chunkUpdate.message', 'A new version of the app is available — refresh the page.')}</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-md bg-c-text px-3 py-1 font-medium text-c-surface hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-c-focus"
      >
        {t('errors.chunkUpdate.action', 'Refresh')}
      </button>
    </div>
  );
};
