/**
 * CHAT-OWN-016 — widok komunikatu o bledzie dostawcy AI w rozmowie.
 *
 * Jeden blok zamiast surowego napisu w dymku. Tresc bierze WYLACZNIE
 * z `getAiErrorCopy` (aiProviderErrorCopy.ts) — komponent nie zna zadnego
 * napisu wlasnego i nie pokazuje nic, co przyszlo z dostawcy.
 *
 * Kolor: `c-warning` dla przypadkow przejsciowych (limit, chwilowa
 * niedostepnosc, przekroczony czas, przerwany strumien, pusta odpowiedz),
 * `c-danger` dla trwalych (konfiguracja, blad nierozpoznany). NIGDY `primary-*`
 * — w tym drzewie `primary` to crimson marki, nie semantyka (CLAUDE.md UI §3).
 */
import React from 'react';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getAiErrorCopy } from './aiProviderErrorCopy';

interface AiProviderErrorNoticeProps {
  /** `errorCode` z ramki SSE, kod zapasowy albo caly obiekt bledu. */
  source: unknown;
  /** Diagnostyka WYLACZNIE dla administratora — pusto dla zwyklego uzytkownika. */
  adminDiagnostic?: string | null;
  /** Ponowienie ostatniej wiadomosci; brak = przycisk sie nie pokazuje. */
  onRetry?: () => void;
  compact?: boolean;
}

export function AiProviderErrorNotice({
  source,
  adminDiagnostic,
  onRetry,
  compact = false,
}: AiProviderErrorNoticeProps): React.ReactElement {
  const { t } = useTranslation();
  const copy = getAiErrorCopy(t as (k: string, d?: string) => string, source);
  const isDanger = copy.tone === 'danger';

  const frame = isDanger
    ? 'border-c-danger/30 bg-c-danger/10'
    : 'border-c-warning/30 bg-c-warning/10';
  const accent = isDanger ? 'text-c-danger' : 'text-c-warning';
  const diagnostic = String(adminDiagnostic || '').trim();

  return (
    <div
      role="status"
      data-testid="ai-provider-error-notice"
      data-ai-error-code={copy.code}
      className={`not-prose rounded-lg border ${frame} ${compact ? 'p-2.5' : 'p-3'}`}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${accent}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${accent}`}>{copy.message}</p>
          <p className="mt-1 text-xs text-c-text-muted">{copy.action}</p>

          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface px-2.5 py-1 text-xs font-medium text-c-text transition-colors hover:bg-c-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              {t('aiChat.providerError.retry', 'Try again')}
            </button>
          ) : null}

          {diagnostic ? (
            <div className="mt-2 border-t border-c-border pt-2">
              <p className="text-[11px] font-medium text-c-text-muted">
                {t('aiChat.providerError.adminDetails', 'Details (administrator only)')}
              </p>
              <p className="mt-0.5 break-words font-mono text-[11px] text-c-text-muted">
                {diagnostic}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default AiProviderErrorNotice;
