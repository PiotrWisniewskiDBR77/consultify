import { ExternalLink, RefreshCw } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { StandardModuleBar } from '@/components/standard/StandardModuleBar';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';

import { ChatSignalsFeedPreview } from './ChatSignalsFeedPreview';
import { resolveDestination } from './signalDestination';
import { localizedSignal, severityRank } from './signalPresentation';
import type { SignalDTO, SignalsFeedResponse } from './signalTypes';
import { type SignalsApi, useSignalsFeed } from './useSignalsFeed';

type FeedRow = TableRow & { dto: SignalDTO; title: string };

export const ChatSignalsFeed: React.FC<{
  projectId?: string | null;
  initialResponse?: SignalsFeedResponse;
  api?: SignalsApi;
  initialSelectedId?: string | null;
}> = ({ projectId, initialResponse, api, initialSelectedId = null }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [chip, setChip] = useState('all');
  const domain = ['EXECUTION', 'DECISION', 'RESULTS', 'FINANCE'].includes(chip) ? chip : undefined;
  const severityMin = chip === 'warning' || chip === 'critical' ? chip : undefined;
  const feed = useSignalsFeed({ projectId, domain, severityMin, initialResponse, api });
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  // FIX-11 (dyżur 26 chat-signals-front, odbiór P2.11) — `initialUiState`
  // było gałęzią WYŁĄCZNIE dla harnessu wewnątrz kodu produkcyjnego. Stan
  // dławienia (state 6) jest teraz zawsze realny: harness symuluje 429 przez
  // istniejące DI (`api.post` odrzucający wywołanie „Odśwież"), tak samo jak
  // zrobiłby to prawdziwy serwer — patrz `dev-render/screens/chat-signals-feed.tsx`.
  const [retryAfter, setRetryAfter] = useState(0);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = window.setInterval(() => setRetryAfter((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [retryAfter]);

  const sorted = useMemo(
    () =>
      [...feed.signals]
        .filter((signal) => chip !== 'mine' || signal.isMine)
        .sort((a, b) => {
          const severity =
            severityRank[localizedSignal(b, t).severity] -
            severityRank[localizedSignal(a, t).severity];
          return (
            severity ||
            new Date(b.freshness.lastObservedAt).getTime() -
              new Date(a.freshness.lastObservedAt).getTime()
          );
        }),
    [chip, feed.signals, t]
  );
  const rows: FeedRow[] = sorted.map((dto) => ({
    id: dto.key,
    dto,
    title: localizedSignal(dto, t).title,
  }));
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const columns: TableColumn[] = [
    {
      id: 'signal',
      label: t('chatSignals.columns.signal'),
      width: '36%',
      render: (row: FeedRow) => {
        const view = localizedSignal(row.dto, t);
        return (
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-semibold text-c-text">
              {row.dto.isMine && (
                <span
                  aria-label={t('chatSignals.mine')}
                  className="h-2 w-2 shrink-0 rounded-full bg-c-focus"
                />
              )}
              {view.title}
            </div>
            <div className="truncate text-xs text-c-text-muted">{view.body}</div>
          </div>
        );
      },
    },
    {
      id: 'domain',
      label: t('chatSignals.columns.domain'),
      width: '12%',
      render: (row: FeedRow) => t(`chatSignals.domain.${row.dto.domain}`),
    },
    {
      id: 'severity',
      label: t('chatSignals.columns.severity'),
      width: '12%',
      render: (row: FeedRow) => {
        const severity = localizedSignal(row.dto, t).severity;
        return (
          <span
            className={
              severity === 'critical' || severity === 'blocker'
                ? 'font-semibold text-c-danger'
                : 'text-c-text-secondary'
            }
          >
            {t(`chatSignals.severity.${severity}`)}
          </span>
        );
      },
    },
    {
      id: 'source',
      label: t('chatSignals.columns.source'),
      width: '14%',
      render: (row: FeedRow) => (
        <span title={row.dto.source.ruleId}>{t(`chatSignals.origin.${row.dto.origin}`)}</span>
      ),
    },
    {
      id: 'age',
      label: t('chatSignals.columns.age'),
      width: '12%',
      render: (row: FeedRow) => (
        <span title={new Date(row.dto.firstObservedAt).toLocaleString()}>
          {localizedSignal(row.dto, t).age}
        </span>
      ),
    },
    {
      id: 'status',
      label: t('chatSignals.columns.status'),
      width: '10%',
      render: () => t('chatSignals.status.OPEN'),
    },
  ];

  const remove = async (action: 'snooze' | 'dismiss' | 'mute', preset?: string) => {
    if (!selected) return;
    if (action === 'mute' && !window.confirm(t('chatSignals.action.muteConfirm'))) return;
    setBusy(true);
    setNotice('');
    try {
      let snoozedUntil: string | undefined;
      if (action === 'snooze') {
        const response = (await feed.api.post(
          `/my-work/signals/${encodeURIComponent(selected.dto.key)}/snooze`,
          { preset }
        )) as { snoozedUntil?: string };
        snoozedUntil = response?.snoozedUntil;
      }
      if (action === 'dismiss')
        await feed.api.post(`/my-work/signals/${encodeURIComponent(selected.dto.key)}/dismiss`, {});
      if (action === 'mute')
        await feed.api.post('/my-work/signals/mute-type', { type: selected.dto.type });
      feed.setSignals((current) =>
        current.filter((signal) =>
          action === 'mute' ? signal.type !== selected.dto.type : signal.key !== selected.dto.key
        )
      );
      setSelectedId(null);
      // FIX-6 (dyżur 26 chat-signals-front, odbiór P1.6) — komunikat sukcesu
      // drzemki mówi DO KIEDY, korzystając z `snoozedUntil` zwracanego przez
      // `POST /my-work/signals/{key}/snooze` (serwer, nietknięty przez ten fix).
      setNotice(
        action === 'snooze' && snoozedUntil
          ? t('chatSignals.notice.snoozeUntil', {
              until: new Date(snoozedUntil).toLocaleString(),
            })
          : t(`chatSignals.notice.${action}`)
      );
    } catch (cause) {
      const status = (cause as { status?: number })?.status;
      setNotice(
        status === 403
          ? t('chatSignals.error.demoBlocked')
          : status === 404
            ? t('chatSignals.error.gone')
            : t('chatSignals.error.action')
      );
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (retryAfter > 0) return;
    setBusy(true);
    try {
      const response = (await feed.api.post('/signals/refresh', {})) as {
        producerEnabled: boolean;
      };
      feed.setProducerEnabled(response.producerEnabled);
      await feed.reload();
      setNotice(
        response.producerEnabled
          ? t('chatSignals.notice.refreshed')
          : t('chatSignals.empty.producerOff')
      );
    } catch (cause) {
      const error = cause as {
        status?: number;
        retryAfter?: number;
        data?: { retryAfterSeconds?: number };
      };
      if (error.status === 429)
        setRetryAfter(error.retryAfter ?? error.data?.retryAfterSeconds ?? 60);
      else setNotice(t('chatSignals.error.load'));
    } finally {
      setBusy(false);
    }
  };

  // FIX-12 (dyżur 26 chat-signals-front, odbiór P2.12) — gdy chip SERWEROWY
  // (domena/waga) jest aktywny, `feed.signals` to już strona przefiltrowana
  // przez `?domain=`/`?severityMin=` — liczniki innych chipów serwerowych,
  // policzone na TEJ liście, kłamią „0" dla wszystkiego poza aktywnym
  // filtrem zamiast mówić „nie wiem". Ukrywamy je zamiast fałszować.
  const SERVER_CHIP_IDS = ['EXECUTION', 'DECISION', 'RESULTS', 'FINANCE', 'warning', 'critical'];
  const serverChipActive = SERVER_CHIP_IDS.includes(chip);
  const serverSafeCount = (id: string, computed: number) =>
    serverChipActive && id !== chip ? undefined : computed;

  const chips = [
    { id: 'all', label: t('chatSignals.filters.all'), count: feed.signals.length },
    {
      id: 'mine',
      // FIX-8 (dyżur 26 chat-signals-front, odbiór P1.8) — `StandardModuleBar`
      // (kanon, poza zakresem tych fixów) nie przekazuje `title`/tooltip do
      // `Menu3Chip`, więc jedyny sposób jawnie powiedzieć „to filtr klientowy
      // na już załadowanych wierszach, nie granica bezpieczeństwa" bez
      // dotykania tego komponentu jest dopisek w samej etykiecie.
      label: `${t('chatSignals.filters.mine')} ${t('chatSignals.filters.mineHint')}`,
      count: feed.signals.filter((x) => x.isMine).length,
    },
    ...(['EXECUTION', 'DECISION', 'RESULTS', 'FINANCE'] as const).map((id) => ({
      id,
      label: t(`chatSignals.domain.${id}`),
      count: serverSafeCount(id, feed.signals.filter((x) => x.domain === id).length),
    })),
    {
      id: 'warning',
      label: t('chatSignals.filters.warning'),
      count: serverSafeCount(
        'warning',
        feed.signals.filter((x) => severityRank[localizedSignal(x, t).severity] >= 1).length
      ),
    },
    {
      id: 'critical',
      label: t('chatSignals.filters.critical'),
      count: serverSafeCount(
        'critical',
        feed.signals.filter((x) => severityRank[localizedSignal(x, t).severity] >= 2).length
      ),
    },
  ];
  const emptyMessage =
    feed.producerEnabled === false
      ? t('chatSignals.empty.producerOff')
      : feed.producerEnabled === undefined
        ? t('chatSignals.empty.unknown')
        : t('chatSignals.empty.good');

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-c-surface text-c-text"
      data-testid="chat-signals-feed"
    >
      <StandardModuleBar
        chips={chips}
        activeChip={chip}
        onChipChange={setChip}
        menu3Right={
          <button
            type="button"
            data-testid="chat-signals-refresh"
            disabled={busy || retryAfter > 0}
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1 rounded-md border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50"
          >
            <RefreshCw size={14} />
            {retryAfter > 0
              ? t('chatSignals.throttle', { count: retryAfter })
              : t('chatSignals.action.refresh')}
          </button>
        }
      />
      {notice && (
        <div
          role="status"
          className="border-b border-c-border px-4 py-2 text-xs text-c-text-secondary"
        >
          {notice}
        </div>
      )}
      {feed.error === 'forbidden' ? (
        <div role="alert" className="m-4 rounded-lg border border-c-border p-4">
          {t('aiChat.signals.forbidden')}
        </div>
      ) : feed.error === 'failed' ? (
        <div role="alert" className="m-4 rounded-lg border border-c-border p-4">
          {t('chatSignals.error.load')}{' '}
          <button className="underline" onClick={() => void feed.reload()}>
            {t('chatSignals.action.retry')}
          </button>
        </div>
      ) : (
        <TableWithPreviewLayout<FeedRow>
          selectedId={selectedId}
          selectedItem={selected}
          onSelect={setSelectedId}
          itemIds={rows.map((row) => row.id)}
          getItemById={(id) => rows.find((row) => row.id === id) ?? null}
          // FIX-1 (odbiór P0.1, korekta 27.08) — `ChatSignalsFeedPreview` musi
          // renderować w trybie `embedded` (powłoka nagłówka/stopki należy do
          // `TableWithPreviewLayout`, nie do `StandardPreview` — patrz jego
          // JSDoc "Parent layout owns header/footer chrome"), więc
          // `StandardPreview`'s WŁASNY nagłówek — łącznie z przyciskiem
          // „Otwórz"/`openDisabledReason` z FIX-1 — jest tam wyciszony i nigdy
          // nie trafia na ekran. Realna, WIDOCZNA kontrolka „Otwórz" dla tej
          // powierzchni żyje więc TUTAJ, przez istniejący punkt rozszerzenia
          // `renderPreviewActions` (już używany przez layout do Pin/Open) —
          // zero zmian w `TableWithPreviewLayout.tsx` samym.
          renderPreviewActions={(row) => {
            const destination = resolveDestination(row.dto);
            if (destination.kind === 'ROUTE') {
              return (
                <button
                  type="button"
                  onClick={() => navigate(destination.href)}
                  title={t('chatSignals.action.open')}
                  className="inline-flex items-center gap-2 h-8 px-3 rounded-full border border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-raised transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
                >
                  <ExternalLink size={13} />
                  {t('chatSignals.action.open')}
                </button>
              );
            }
            return (
              <button
                type="button"
                disabled
                aria-disabled="true"
                title={t(destination.reason)}
                className="inline-flex items-center gap-2 h-8 px-3 rounded-full border border-c-border bg-c-surface text-c-text-muted opacity-60 cursor-not-allowed"
              >
                <ExternalLink size={13} />
                {t('chatSignals.action.open')}
              </button>
            );
          }}
          renderPreview={(row) => (
            <ChatSignalsFeedPreview
              signal={row.dto}
              onClose={() => setSelectedId(null)}
              onAction={(action, preset) => void remove(action, preset)}
              busy={busy}
            />
          )}
        >
          <StandardTable
            columns={columns}
            data={rows}
            loading={feed.loading}
            selectedRowId={selectedId}
            onRowClick={(row) => setSelectedId(row.id)}
            emptyMessage={
              <div className="py-8 text-center text-sm text-c-text-secondary">{emptyMessage}</div>
            }
            density="compact"
            minTableWidth="columns"
            persistKey="chat-signals-feed"
          />
        </TableWithPreviewLayout>
      )}
      {feed.nextCursor && (
        <button
          className="m-3 rounded-md border border-c-border px-3 py-2 text-xs focus-visible:ring-2 focus-visible:ring-c-focus"
          onClick={() => void feed.loadMore()}
        >
          {t('chatSignals.action.loadMore')}
        </button>
      )}
    </div>
  );
};
