/**
 * [ODMROZENIE 05_INITIATIVES DEC-421] P15-K5, decyzja D3' — „Obciazenie rol" w planie.
 *
 * POMIAR 07.09: sekcja „Obciazenie rol" karty planu pokazywala ZDANIE Z SEEDU
 * (`windows[].constraintSnapshot[].detail`, `sourceRef: "P11-DEC-421-owner-decision"`),
 * zero arytmetyki. Tu PMO wpisuje POPYT: inicjatywa x rola x FTE. Z tego, i tylko
 * z tego, analiza obciazenia liczy popyt per rola per okres.
 *
 * SCALENIE K3+K5 (07.09): komponent byl SAMOWYSTARCZALNY — sam czytal plan i sam
 * go zapisywal z wlasnym licznikiem wersji. Po scaleniu z warsztatem K3 na tej
 * samej karcie sa DWAJ pisarze jednego agregatu: kazdy zapis FTE unieważnialby
 * `expectedVersion` powierzchni (i odwrotnie), czyli 409 po pierwszej zmianie.
 * Dlatego edytor jest STEROWANY: okna dostaje z karty, a zapis oddaje przez
 * `onChange` do `persistScenario(scenario, 'UPDATE')` — jedno CAS, jedna wersja.
 * Wlasny odczyt zostaje TYLKO na slownik rol (`GET /capacity-roles`), ktorego
 * karta nie ma skad wziac.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { listCapacityRoles } from '@/services/initiatives-execution/runtimeApi';

interface RoleOption {
  roleId: string;
  roleLabel: string;
  fteWeekly: number;
  headcount: number;
}
export interface RoleDemandLine {
  roleId: string;
  roleLabel: string;
  fte: number;
}
interface EditorWindow {
  initiativeId: string;
  roleDemand?: RoleDemandLine[];
}

export function PlanRoleDemandEditor({
  windows,
  initiativeNames,
  editable,
  busy,
  errorLabel,
  onChange,
}: {
  windows: EditorWindow[];
  initiativeNames: Map<string, string>;
  /** Plan opublikowany = tylko odczyt (ta sama regula, co reszta karty). */
  editable: boolean;
  busy?: boolean;
  /** Regula z odrzuconego zapisu (np. konflikt wersji) — karta ja liczy. */
  errorLabel?: string | null;
  onChange?: (initiativeId: string, roleDemand: RoleDemandLine[]) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<'IDLE' | 'SAVING' | 'SAVED' | 'FAILED'>('IDLE');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listCapacityRoles()
      .then((body) => {
        if (!alive) return;
        setRoles(((body as { roles?: RoleOption[] }).roles ?? []) as RoleOption[]);
        setState('READY');
      })
      .catch(() => {
        if (alive) setState('ERROR');
      });
    return () => {
      alive = false;
    };
  }, []);

  // Kolumny arkusza = role obsadzone w organizacji + role juz uzyte w planie
  // (nawet gdy ostatnia osoba o tym stanowisku odeszla — plan ma o niej pamietac).
  const columns = useMemo(() => {
    const map = new Map<string, string>();
    for (const role of roles) map.set(role.roleId, role.roleLabel);
    for (const window of windows)
      for (const line of window.roleDemand ?? []) map.set(line.roleId, line.roleLabel);
    return [...map.entries()]
      .map(([roleId, roleLabel]) => ({ roleId, roleLabel }))
      .sort((left, right) => left.roleLabel.localeCompare(right.roleLabel, 'pl'));
  }, [roles, windows]);

  const save = async (initiativeId: string, roleId: string, roleLabel: string, raw: string) => {
    if (!onChange || saveState === 'SAVING') return;
    const window = windows.find((item) => item.initiativeId === initiativeId);
    if (!window) return;
    const parsed = Number(raw.replace(',', '.'));
    if (raw.trim() !== '' && (!Number.isFinite(parsed) || parsed < 0)) return;
    const fte = raw.trim() === '' ? 0 : parsed;
    const others = (window.roleDemand ?? []).filter((line) => line.roleId !== roleId);
    const current = (window.roleDemand ?? []).find((line) => line.roleId === roleId);
    if ((current?.fte ?? 0) === fte) return;
    setSaveState('SAVING');
    const saved = await onChange(
      initiativeId,
      fte > 0 ? [...others, { roleId, roleLabel, fte }] : others
    );
    setSaveState(saved ? 'SAVED' : 'FAILED');
    if (saved)
      setSavedAt(new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }));
  };

  if (state === 'LOADING')
    return (
      <p role="status" className="text-sm text-c-text-muted">
        {t('initiatives.planScenario.roleDemand.loading', 'Loading role load…')}
      </p>
    );
  if (state === 'ERROR')
    return (
      <p role="alert" className="text-sm text-c-danger">
        {t(
          'initiatives.planScenario.roleDemand.unavailable',
          'Could not load role load.'
        )}
      </p>
    );
  if (!windows.length)
    return (
      <p className="text-sm text-c-text-muted">
        {t(
          'initiatives.planScenario.roleDemand.noWindows',
          'The plan has no initiative in scope yet — pick them in the generator first.'
        )}
      </p>
    );
  if (!columns.length)
    return (
      <p className="text-sm text-c-text-muted">
        {t(
          'initiatives.planScenario.roleDemand.noRoles',
          'Nobody in the organization has a job title. Fill in job titles in Team to plan role load.'
        )}
      </p>
    );

  const head = 'px-3 py-2 text-left text-xs font-medium text-c-text-muted';
  return (
    <div className="overflow-x-auto">
      <p className="mb-3 text-sm text-c-text-muted">
        {t(
          'initiatives.planScenario.roleDemand.hint',
          'Enter how many FTE of each role the initiative needs within its window. These numbers are the demand in the load analysis.'
        )}
      </p>
      <table /* §27-exempt: ARKUSZ inicjatywa x rola w karcie planu (macierz FTE do
               wpisania), nie lista encji — kolumny sa DANYMI (rolami), nie
               konfiguracja widoku, wiec StandardTable nie ma tu zastosowania */ className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr className="border-b border-c-border-subtle">
            <th className={head}>
              {t('initiatives.planScenario.roleDemand.initiative', 'Inicjatywa')}
            </th>
            {columns.map((column) => (
              <th key={column.roleId} className={head}>
                {column.roleLabel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {windows.map((window) => (
            <tr key={window.initiativeId} className="border-b border-c-border-subtle">
              <td className="px-3 py-2 text-sm">
                {initiativeNames.get(window.initiativeId) ?? window.initiativeId}
              </td>
              {columns.map((column) => {
                const key = `${window.initiativeId}|${column.roleId}`;
                const current = (window.roleDemand ?? []).find(
                  (line) => line.roleId === column.roleId
                );
                const value = draft[key] ?? (current ? String(current.fte) : '');
                return (
                  <td key={column.roleId} className="px-3 py-2">
                    <input
                      aria-label={`FTE ${initiativeNames.get(window.initiativeId) ?? window.initiativeId} ${column.roleLabel}`}
                      className="w-20 rounded border border-c-border bg-c-surface px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      inputMode="decimal"
                      disabled={!editable || busy === true || saveState === 'SAVING'}
                      value={value}
                      onChange={(event) =>
                        setDraft((state) => ({ ...state, [key]: event.target.value }))
                      }
                      onBlur={(event) =>
                        void save(
                          window.initiativeId,
                          column.roleId,
                          column.roleLabel,
                          event.target.value
                        )
                      }
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!editable && (
        <p className="mt-3 text-sm text-c-text-muted">
          {t(
            'initiatives.planScenario.roleDemand.readOnly',
            'The plan is published — role load is read-only.'
          )}
        </p>
      )}
      {saveState === 'SAVED' && savedAt && (
        <p role="status" className="mt-3 text-sm text-c-text-muted">
          {t('initiatives.planScenario.roleDemand.saved', { defaultValue: 'Zapisano {{time}}', time: savedAt })}
        </p>
      )}
      {saveState === 'FAILED' && (
        <p role="alert" className="mt-3 text-sm text-c-danger">
          {t('initiatives.planScenario.roleDemand.failed', 'Role load was not saved.')}
          {errorLabel ? ` (${errorLabel})` : ''}
        </p>
      )}
    </div>
  );
}
