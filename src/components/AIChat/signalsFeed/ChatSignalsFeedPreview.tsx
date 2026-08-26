import { BellOff, Clock, EyeOff } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { StandardPreview } from '@/components/standard/StandardPreview';

import { resolveDestination } from './signalDestination';
import { localizedSignal } from './signalPresentation';
import type { SignalDTO } from './signalTypes';

export const ChatSignalsFeedPreview: React.FC<{
  signal: SignalDTO;
  onClose: () => void;
  onAction: (action: 'snooze' | 'dismiss' | 'mute', preset?: string) => void;
  busy?: boolean;
}> = ({ signal, onClose, onAction, busy }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const view = localizedSignal(signal, t);
  const destination = resolveDestination(signal);
  const evidence = signal.source.evidence;
  const details = [
    view.body,
    t('chatSignals.preview.evidence'),
    evidence.length
      ? evidence.map((item) => `${item.refType}: ${String(item.observedValue ?? '—')}`).join('\n')
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
          label: `${signal.entityType}: ${signal.entityId}`,
          onClick: destination.kind === 'ROUTE' ? () => navigate(destination.href) : undefined,
        },
      ]}
      actions={{
        time: [
          {
            id: 'snooze',
            variant: 'neutral',
            label: t('chatSignals.action.snooze'),
            icon: Clock,
            disabled: busy,
            onClick: () => onAction('snooze', 'tomorrow'),
          },
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
