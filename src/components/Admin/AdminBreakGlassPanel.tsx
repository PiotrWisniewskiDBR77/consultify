import { ShieldAlert } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createBreakGlass,
  getBreakGlass,
  revokeBreakGlass,
  type BreakGlassData,
  type BreakGlassSession,
} from '../../services/adminBreakGlassApi';
import { ConfirmDialog } from '../MyWork/shared/ConfirmDialog';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
import { useTranslation } from 'react-i18next';
const EMPTY: BreakGlassData = {
  sessions: [],
  policy: {
    breakGlassEnabled: false,
    breakGlassApprovers: [],
  },
  approvers: [],
};
export const AdminBreakGlassPanel: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState(EMPTY),
    [reason, setReason] = useState(''),
    [approver, setApprover] = useState(''),
    [typed, setTyped] = useState(''),
    [activate, setActivate] = useState(false),
    [revoke, setRevoke] = useState<BreakGlassSession | null>(null),
    [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await getBreakGlass());
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t('admin.security.break-glass.day2Auto.text1', {
              defaultValue: 'Błąd break-glass',
            })
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const cols = useMemo<TableColumn[]>(
      () => [
        {
          id: 'admin',
          label: 'Administrator',
        },
        {
          id: 'reason',
          label: t('admin.security.break-glass.day2Auto.text2', {
            defaultValue: 'Powód',
          }),
        },
        {
          id: 'approver',
          label: t('admin.security.break-glass.day2Auto.text3', {
            defaultValue: 'Zatwierdził',
          }),
        },
        {
          id: 'expires',
          label: t('admin.security.break-glass.day2Auto.text4', {
            defaultValue: 'Wygasa',
          }),
        },
      ],
      []
    ),
    rows = useMemo<TableRow[]>(
      () =>
        data.sessions.map((s) => ({
          id: s.id,
          admin: s.adminId,
          reason: s.breakGlassReason || '—',
          approver: s.approvedBy || '—',
          expires: new Date(s.expiresAt).toLocaleString(),
        })),
      [data]
    );
  const doActivate = async () => {
    try {
      setData(await createBreakGlass(reason, approver));
      setActivate(false);
      setReason('');
      setTyped('');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t('admin.security.break-glass.day2Auto.text5', {
              defaultValue: 'Błąd aktywacji',
            })
      );
    }
  };
  const doRevoke = async () => {
    if (!revoke) return;
    try {
      setData(await revokeBreakGlass(revoke.id));
      setRevoke(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t('admin.security.break-glass.day2Auto.text6', {
              defaultValue: 'Błąd wygaszenia',
            })
      );
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-c-text">Break-glass</h2>
        <p className="text-sm text-c-text-secondary">
          {t('admin.security.break-glass.day2Auto.text7', {
            defaultValue: 'Awaryjny dostęp na maksymalnie 1 godzinę; widoczny w audycie.',
          })}
        </p>
      </div>
      {error && <div role="alert">{error}</div>}
      <div className="rounded-xl border border-c-border p-4">
        {data.sessions.length
          ? t('admin.security.break-glass.day2Auto.text8', {
              v0: data.sessions.length,
              defaultValue: 'Aktywne sesje: {{v0}}',
            })
          : t('admin.security.break-glass.day2Auto.text9', {
              defaultValue: 'Brak aktywnych sesji break-glass',
            })}
      </div>
      <section className="space-y-3 rounded-xl border border-c-border p-4">
        <label className="block text-sm">
          {t('admin.security.break-glass.day2Auto.text10', {
            defaultValue: 'Powód (min. 10 znaków)',
          })}
          <textarea
            aria-label={t('admin.security.break-glass.day2Auto.text11', {
              defaultValue: 'Powód break-glass',
            })}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 block w-full rounded border border-c-border bg-c-surface p-2"
          />
        </label>
        <label className="block text-sm">
          {t('admin.security.break-glass.day2Auto.text12', {
            defaultValue: 'Zatwierdzający',
          })}
          <select
            aria-label={t('admin.security.break-glass.day2Auto.text12', {
              defaultValue: 'Zatwierdzający',
            })}
            value={approver}
            onChange={(e) => setApprover(e.target.value)}
            className="ml-2 rounded border border-c-border bg-c-surface p-2"
          >
            <option value="">Wybierz</option>
            {data.approvers.map((a) => (
              <option key={a.id} value={a.id}>
                {[a.first_name, a.last_name].filter(Boolean).join(' ') || a.email}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Wpisz BREAK-GLASS
          <input
            aria-label="Potwierdzenie celu"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="ml-2 rounded border border-c-border bg-c-surface p-2"
          />
        </label>
        <button
          disabled={
            !data.policy.breakGlassEnabled ||
            reason.trim().length < 10 ||
            !approver ||
            typed !== 'BREAK-GLASS'
          }
          onClick={() => setActivate(true)}
          className="rounded bg-c-danger px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Aktywuj na 1h
        </button>
        {!data.policy.breakGlassEnabled && (
          <p className="text-sm text-c-text-secondary">
            {t('admin.security.break-glass.day2Auto.text13', {
              defaultValue: 'Funkcja jest wyłączona w polityce IAM organizacji.',
            })}
          </p>
        )}
      </section>
      <StandardTable
        columns={cols}
        data={rows}
        rowMenu={(row) => ({
          destructive: {
            label: t('admin.security.break-glass.day2Auto.text14', {
              defaultValue: 'Wygaś sesję',
            }),
            icon: ShieldAlert,
            onClick: () => setRevoke(data.sessions.find((s) => s.id === row.id) || null),
          },
        })}
        empty={{
          icon: ShieldAlert,
          title: t('admin.security.break-glass.day2Auto.text15', {
            defaultValue: 'Brak historii aktywnych sesji',
          }),
          description: t('admin.security.break-glass.day2Auto.text16', {
            defaultValue: 'Nie ma obecnie aktywnego dostępu awaryjnego.',
          }),
        }}
        persistKey="admin.breakGlass"
      />
      <ConfirmDialog
        isOpen={activate}
        onCancel={() => setActivate(false)}
        onConfirm={() => void doActivate()}
        title={t('admin.security.break-glass.day2Auto.text17', {
          defaultValue: 'Aktywować dostęp break-glass?',
        })}
        description={t('admin.security.break-glass.day2Auto.text18', {
          v0: approver,
          defaultValue:
            'Zakres: awaryjne uprawnienia administratora na maksymalnie 1h. Zatwierdzający: {{v0}}. Powód i zdarzenie będą widoczne w audycie. Odzyskanie: sesję można natychmiast wygasić.',
        })}
        confirmLabel="Aktywuj break-glass"
        variant="danger"
      />
      <ConfirmDialog
        isOpen={!!revoke}
        onCancel={() => setRevoke(null)}
        onConfirm={() => void doRevoke()}
        title={t('admin.security.break-glass.day2Auto.text19', {
          defaultValue: 'Wygasić dostęp break-glass?',
        })}
        description={t('admin.security.break-glass.day2Auto.text20', {
          defaultValue:
            'Dostęp zostanie natychmiast odebrany. Ponowna aktywacja wymaga nowego powodu i zatwierdzenia.',
        })}
        confirmLabel={t('admin.security.break-glass.day2Auto.text14', {
          defaultValue: 'Wygaś sesję',
        })}
        variant="danger"
      />
    </div>
  );
};
