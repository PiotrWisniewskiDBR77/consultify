import { BellOff, Clock, EyeOff } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { StandardPreview } from '@/components/standard/StandardPreview';

import { resolveDestination } from './signalDestination';
import { localizedSignal, refTypeLabel, relativeTime } from './signalPresentation';
import type { SignalDTO } from './signalTypes';

/**
 * FIX-6 (dyżur 26 chat-signals-front, odbiór P1.6) — cztery bezpieczne
 * presety drzemki (serwer: `server/src/routes/my-work/signals.routes.ts:158-166`
 * zna dokładnie te cztery wartości `preset`, domyślnie `tomorrow`). Front-only:
 * ten plik nie dotyka `server/src`.
 */
const SNOOZE_PRESETS = ['1h', '4h', 'tomorrow', 'week'] as const;

export const ChatSignalsFeedPreview: React.FC<{
  signal: SignalDTO;
  onClose: () => void;
  onAction: (action: 'snooze' | 'dismiss' | 'mute', preset?: string) => void;
  busy?: boolean;
}> = ({ signal, onClose, onAction, busy }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const now = new Date();
  const view = localizedSignal(signal, t);
  const destination = resolveDestination(signal);
  const evidence = signal.source.evidence;
  const details = [
    view.body,
    t('chatSignals.preview.evidence'),
    evidence.length
      ? evidence
          .map(
            (item) =>
              `${refTypeLabel(item.refType, t)}: ${String(item.observedValue ?? '—')} · ${relativeTime(item.observedAt, now, t)}`
          )
          .join('\n')
      : t('chatSignals.preview.noEvidence'),
    `${signal.source.ruleId} · v${signal.source.ruleVersion}`,
    signal.origin === 'INTERPRETED'
      ? signal.provenance
        ? `${t('chatSignals.preview.provenance')}: ${signal.provenance.provider ?? '—'} / ${signal.provenance.model ?? '—'}`
        : t('chatSignals.preview.noProvenance')
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return (
    <StandardPreview
      embedded
      title={view.title}
      onClose={onClose}
      onOpenFull={destination.kind === 'ROUTE' ? () => navigate(destination.href) : undefined}
      openLabel={destination.kind === 'ROUTE' ? t('chatSignals.action.open') : undefined}
      openDisabledReason={destination.kind !== 'ROUTE' ? t(destination.reason) : undefined}
      meta={{
        pills: [
          {
            label: t(`chatSignals.severity.${view.severity}`),
            tone: view.severity === 'info' ? 'neutral' : 'warning',
          },
          { label: t(`chatSignals.domain.${signal.domain}`) },
          { label: t(`chatSignals.origin.${signal.origin}`) },
          ...(signal.projectName ? [{ label: signal.projectName }] : []),
          ...(signal.isMine ? [{ label: t('chatSignals.mine') }] : []),
        ],
        trailing: (
          <span title={new Date(signal.freshness.lastObservedAt).toLocaleString()}>{view.age}</span>
        ),
      }}
      details={{
        label: t('chatSignals.preview.details'),
        text: details,
        extraActions: [
          {
            id: 'copy-id',
            label: t('chatSignals.action.copyId'),
            onClick: () => void navigator.clipboard?.writeText(signal.key),
          },
        ],
      }}
      relations={[
        {
          // FIX-9 (dyżur 26 chat-signals-front, odbiór P1.9) — `label`
          // przechodzi WYŁĄCZNIE przetłumaczony typ obiektu (np. „Zadanie"),
          // nigdy surowy `${entityType}: ${entityId}`. Poprzedni zapis
          // trafiał w `PreviewRelations`' `containsTechnicalIdentifier` (widzi
          // UUID po dwukropku) → `resolveBusinessDisplayLabel` bez `type` →
          // generyczne „Powiązany rekord" (`businessDisplayLabel.ts:86-87`).
          // Rozwiązane PO STRONIE FEEDU: identyfikator idzie do `value`
          // (widoczny, przyciemniony) i `title` (tooltip pełny), etykieta
          // zostaje czysta, więc auto-detekcja w ogóle się nie uruchamia.
          id: signal.entityId,
          type: signal.entityType,
          label: refTypeLabel(signal.entityType, t),
          title: `${refTypeLabel(signal.entityType, t)}: ${signal.entityId}`,
          onClick: destination.kind === 'ROUTE' ? () => navigate(destination.href) : undefined,
        },
      ]}
      actions={{
        time: [
          ...SNOOZE_PRESETS.map((preset) => ({
            id: `snooze-${preset}`,
            variant: 'neutral' as const,
            label: t(`chatSignals.action.snoozePreset.${preset}`),
            icon: Clock,
            disabled: busy,
            onClick: () => onAction('snooze', preset),
          })),
          {
            id: 'mute',
            variant: 'warning',
            label: t('chatSignals.action.mute'),
            icon: BellOff,
            disabled: busy,
            onClick: () => onAction('mute'),
          },
          {
            id: 'dismiss',
            variant: 'destructive',
            label: t('chatSignals.action.dismiss'),
            icon: EyeOff,
            disabled: busy,
            onClick: () => onAction('dismiss'),
          },
        ],
      }}
    />
  );
};
