import { FileClock, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  V8PromptOsApi,
  type V8PromptOsBundle,
  type V8PromptOsCanary,
  type V8PromptOsEvalGate,
  type V8PromptOsRuntimeSummary,
} from '../../services/api/v8/prompt-os';
import { ConfirmDialog } from '../MyWork/shared/ConfirmDialog';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
import { useTranslation } from 'react-i18next';
const errorCode = (error: unknown) => {
  const value = error as {
    code?: string;
    status?: number;
    message?: string;
    data?: {
      code?: string;
    };
  };
  const text = `${value?.code || ''} ${value?.data?.code || ''} ${value?.message || ''}`;
  return text.includes('V8_DISABLED') || text.includes('V8_MISSING_ORG_CONTEXT')
    ? 'disabled'
    : value?.status === 409 ||
        text.includes('409') ||
        text.includes('PROMPT_OS_ACTIVATION_CONFLICT') ||
        text.includes('PROMPT_OS_ROLLBACK_CONFLICT')
      ? 'conflict'
      : 'error';
};
export const AdminConfigurationVersionsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<V8PromptOsRuntimeSummary | null>(null);
  const [bundles, setBundles] = useState<V8PromptOsBundle[]>([]);
  const [selected, setSelected] = useState<V8PromptOsBundle | null>(null);
  const [gates, setGates] = useState<V8PromptOsEvalGate[]>([]);
  const [canary, setCanary] = useState<V8PromptOsCanary | null>(null);
  const [detailsState, setDetailsState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [detailsMessage, setDetailsMessage] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'disabled' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [rollbackTarget, setRollbackTarget] = useState<V8PromptOsBundle | null>(null);
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const load = useCallback(async (preserveMessage = false) => {
    setState('loading');
    if (!preserveMessage) setMessage('');
    try {
      const [nextSummary, nextBundles] = await Promise.all([
        V8PromptOsApi.getRuntimeSummary(),
        V8PromptOsApi.getBundles(),
      ]);
      setSummary(nextSummary);
      setBundles(nextBundles);
      setSelected(
        (current) => nextBundles.find((item) => item.bundleId === current?.bundleId) || null
      );
      setState('ready');
    } catch (error) {
      setState(errorCode(error) === 'disabled' ? 'disabled' : 'error');
      setMessage(
        error instanceof Error
          ? error.message
          : t('admin.ai.configuration-versions.day2Auto.text1', {
              defaultValue: 'Nie udało się pobrać konfiguracji Prompt OS.',
            })
      );
    }
  }, []);
  useEffect(() => void load(), [load]);
  const showDetails = async (bundle: V8PromptOsBundle) => {
    setSelected(bundle);
    setDetailsState('loading');
    setDetailsMessage('');
    const [gateResult, canaryResult] = await Promise.allSettled([
      V8PromptOsApi.getEvalGates(bundle.bundleId),
      V8PromptOsApi.getCanary(bundle.bundleId),
    ]);
    if (gateResult.status === 'rejected') {
      setGates([]);
      setCanary(null);
      setDetailsState('error');
      setDetailsMessage(
        gateResult.reason instanceof Error
          ? gateResult.reason.message
          : t('admin.ai.configuration-versions.day2Auto.text2', {
              defaultValue: 'Nie udało się pobrać bramek ewaluacji.',
            })
      );
      return;
    }
    setGates(gateResult.value);
    if (canaryResult.status === 'fulfilled') setCanary(canaryResult.value);
    else if (
      `${
        (
          canaryResult.reason as {
            data?: {
              code?: string;
            };
            message?: string;
          }
        )?.data?.code || ''
      } ${(canaryResult.reason as Error)?.message || ''}`.includes('CANARY_NOT_FOUND')
    )
      setCanary(null);
    else {
      setCanary(null);
      setDetailsState('error');
      setDetailsMessage(
        canaryResult.reason instanceof Error
          ? canaryResult.reason.message
          : t('admin.ai.configuration-versions.day2Auto.text3', {
              defaultValue: 'Nie udało się pobrać konfiguracji canary.',
            })
      );
      return;
    }
    setDetailsState('ready');
  };
  const mutate = async (kind: 'activate' | 'rollback', bundle: V8PromptOsBundle) => {
    try {
      if (kind === 'activate') await V8PromptOsApi.activateBundle(bundle.bundleId);
      else await V8PromptOsApi.rollbackBundle(bundle.bundleId, reason.trim());
      setRollbackTarget(null);
      setConfirmOpen(false);
      setReason('');
      await load();
    } catch (error) {
      setMessage(
        errorCode(error) === 'conflict'
          ? t('admin.ai.configuration-versions.day2Auto.text4', {
              defaultValue:
                'Konfiguracja zmieniła się równolegle (409). Odświeżono dane — sprawdź stan przed ponowieniem.',
            })
          : error instanceof Error
            ? error.message
            : t('admin.ai.configuration-versions.day2Auto.text5', {
                defaultValue: 'Operacja nie powiodła się.',
              })
      );
      await load(true);
    }
  };
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'version',
        label: 'Wersja',
      },
      {
        id: 'preset',
        label: 'Preset',
      },
      {
        id: t('admin.ai.configuration-versions.day2Auto.text6', {
          defaultValue: 'status',
        }),
        label: t('admin.ai.configuration-versions.day2Auto.text7', {
          defaultValue: 'Status',
        }),
      },
      {
        id: 'prompt',
        label: 'Prompt',
      },
      {
        id: 'model',
        label: 'Model',
      },
      {
        id: 'policy',
        label: 'Policy',
      },
      {
        id: 'runtime',
        label: 'Runtime',
      },
    ],
    []
  );
  const rows = useMemo<TableRow[]>(
    () =>
      bundles.map((bundle) => ({
        id: bundle.bundleId,
        version: bundle.version,
        preset: bundle.presetId,
        status: bundle.status,
        prompt: bundle.promptVersion,
        model: bundle.modelVersion,
        policy: bundle.policyVersion,
        runtime: bundle.runtimeConfigVersion,
      })),
    [bundles]
  );
  if (state === 'disabled')
    return (
      <div role="status" className="rounded-xl border border-c-border p-5">
        <h2 className="font-semibold">
          {t('admin.ai.configuration-versions.day2Auto.text8', {
            defaultValue: 'Prompt OS nie jest włączony dla tej organizacji',
          })}
        </h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t('admin.ai.configuration-versions.day2Auto.text9', {
            defaultValue:
              'Włączenie wymaga operatora platformy lub administratora konfiguracji V8.',
          })}
        </p>
      </div>
    );
  if (state === 'error')
    return (
      <div
        role="alert"
        className="rounded-xl border border-c-danger bg-c-surface p-4 text-sm text-c-danger"
      >
        <p>{message}</p>
        <button
          onClick={() => void load()}
          className="mt-3 rounded border border-c-border px-3 py-2"
        >
          {t('admin.ai.configuration-versions.day2Auto.text10', {
            defaultValue: 'Spróbuj ponownie',
          })}
        </button>
      </div>
    );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Wersje konfiguracji AI</h2>
          <p className="text-sm text-c-text-secondary">
            Tenantowy runtime Prompt OS, bramki ewaluacji i canary.
          </p>
        </div>
        <button
          aria-label={t('admin.ai.configuration-versions.day2Auto.text11', {
            defaultValue: 'Odśwież',
          })}
          onClick={() => void load()}
        >
          <RefreshCw className={state === 'loading' ? 'animate-spin' : ''} />
        </button>
      </div>
      {message && (
        <div
          role="alert"
          className="rounded-xl border border-c-danger bg-c-surface p-4 text-sm text-c-danger"
        >
          {message}
        </div>
      )}
      {summary && (
        <dl className="grid gap-3 rounded-xl border border-c-border p-4 sm:grid-cols-4">
          <div>
            <dt>Kontrakt</dt>
            <dd>{summary.contract}</dd>
          </div>
          <div>
            <dt>Presety</dt>
            <dd>{summary.presetCount}</dd>
          </div>
          <div>
            <dt>Bundle</dt>
            <dd>{summary.bundleCount}</dd>
          </div>
          <div>
            <dt>
              {t('admin.ai.configuration-versions.day2Auto.text12', {
                defaultValue: 'Aktywne',
              })}
            </dt>
            <dd>{summary.activeBundleCount}</dd>
          </div>
        </dl>
      )}
      <StandardTable
        columns={columns}
        data={rows}
        loading={state === 'loading'}
        rowMenu={(row) => {
          const bundle = bundles.find((item) => item.bundleId === row.id)!;
          return {
            primary: [
              {
                id: 'details',
                label: t('admin.ai.configuration-versions.day2Auto.text13', {
                  defaultValue: 'Pokaż szczegóły',
                }),
                onClick: () => void showDetails(bundle),
              },
              ...(bundle.status !== 'active'
                ? [
                    {
                      id: 'activate',
                      label: 'Aktywuj',
                      onClick: () => void mutate('activate', bundle),
                    },
                  ]
                : []),
            ],
            destructive:
              bundle.status === 'active'
                ? {
                    label: t('admin.ai.configuration-versions.day2Auto.text14', {
                      defaultValue: 'Wycofaj wersję',
                    }),
                    onClick: () => setRollbackTarget(bundle),
                  }
                : undefined,
          };
        }}
        empty={{
          icon: FileClock,
          title: t('admin.ai.configuration-versions.day2Auto.text15', {
            defaultValue: 'Brak wersji konfiguracji',
          }),
          description: t('admin.ai.configuration-versions.day2Auto.text16', {
            defaultValue:
              'Prompt OS jest włączony, ale organizacja nie ma jeszcze bundle konfiguracji.',
          }),
        }}
        persistKey="admin.configurationVersions"
      />
      {selected && (
        <section className="rounded-xl border border-c-border p-4">
          <h3 className="font-semibold">
            {t('admin.ai.configuration-versions.day2Auto.text17', {
              defaultValue: 'Szczegóły',
            })}
            {selected.version}
          </h3>
          {detailsState === 'loading' && (
            <p role="status">
              {t('admin.ai.configuration-versions.day2Auto.text18', {
                defaultValue: 'Ładowanie szczegółów…',
              })}
            </p>
          )}
          {detailsState === 'error' ? (
            <div
              role="alert"
              className="rounded-xl border border-c-danger bg-c-surface p-4 text-sm text-c-danger"
            >
              <p>{detailsMessage}</p>
              <button
                onClick={() => void showDetails(selected)}
                className="mt-2 rounded border border-c-border px-3 py-2"
              >
                {t('admin.ai.configuration-versions.day2Auto.text10', {
                  defaultValue: 'Spróbuj ponownie',
                })}
              </button>
            </div>
          ) : (
            detailsState === 'ready' && (
              <>
                <p className="mt-2 text-sm">
                  Bramki:{' '}
                  {gates.length
                    ? gates.map((gate) => `${gate.gateType}: ${gate.result}`).join(', ')
                    : t('admin.ai.configuration-versions.day2Auto.text19', {
                        defaultValue: 'brak wyników',
                      })}
                </p>
                <p className="text-sm">
                  Canary:{' '}
                  {canary
                    ? `rollback ${
                        canary.rollbackEnabled
                          ? t('admin.ai.configuration-versions.day2Auto.text20', {
                              defaultValue: 'włączony',
                            })
                          : t('admin.ai.configuration-versions.day2Auto.text21', {
                              defaultValue: 'wyłączony',
                            })
                      }, org scope ${
                        canary.orgScoped
                          ? 'tak'
                          : t('admin.ai.configuration-versions.day2Auto.text22', {
                              defaultValue: 'nie',
                            })
                      }`
                    : t('admin.ai.configuration-versions.day2Auto.text23', {
                        defaultValue: 'brak konfiguracji',
                      })}
                </p>
              </>
            )
          )}
        </section>
      )}
      {rollbackTarget && !confirmOpen && (
        <label className="block rounded-xl border border-c-danger p-4">
          {t('admin.ai.configuration-versions.day2Auto.text24', {
            defaultValue: 'Powód wycofania (wymagany)',
          })}
          <textarea
            aria-label={t('admin.ai.configuration-versions.day2Auto.text25', {
              defaultValue: 'Powód wycofania',
            })}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 block w-full rounded border border-c-border bg-c-surface p-2"
          />
          <button
            disabled={!reason.trim()}
            onClick={() => setConfirmOpen(true)}
            className="mt-2 rounded bg-c-danger px-3 py-2 text-white disabled:opacity-50"
          >
            {t('admin.ai.configuration-versions.day2Auto.text26', {
              defaultValue: 'Przejdź do potwierdzenia',
            })}
          </button>
        </label>
      )}
      <ConfirmDialog
        isOpen={confirmOpen}
        onCancel={() => {
          setConfirmOpen(false);
          setRollbackTarget(null);
          setReason('');
        }}
        onConfirm={() => rollbackTarget && void mutate('rollback', rollbackTarget)}
        title={t('admin.ai.configuration-versions.day2Auto.text27', {
          defaultValue: 'Wycofać aktywną konfigurację?',
        })}
        description={t('admin.ai.configuration-versions.day2Auto.text28', {
          v0: reason,
          defaultValue:
            'Powód: {{v0}}. Operacja zmieni runtime organizacji i zostanie zapisana w historii Prompt OS.',
        })}
        confirmLabel={t('admin.ai.configuration-versions.day2Auto.text14', {
          defaultValue: 'Wycofaj wersję',
        })}
        variant="danger"
      />
    </div>
  );
};
