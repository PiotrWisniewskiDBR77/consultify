/**
 * [ODMROZENIE 05_INITIATIVES DEC-421] P15-K5, decyzja D3' — „Obciazenie rol" w planie.
 *
 * POMIAR 07.09: sekcja „Obciazenie rol" karty planu pokazywala ZDANIE Z SEEDU
 * (`windows[].constraintSnapshot[].detail`, `sourceRef: "P11-DEC-421-owner-decision"`),
 * zero arytmetyki. Tu PMO wpisuje POPYT: inicjatywa x rola x FTE. Z tego, i tylko
 * z tego, analiza obciazenia liczy popyt per rola per okres.
 *
 * Komponent jest SAMOWYSTARCZALNY (sam czyta wersje agregatu i sam zapisuje),
 * zeby osadzenie w `PlanCard` bylo jedna linia — K3 pracuje rownolegle na tym
 * samym pliku i nie moze dostac konfliktu na polowie karty.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  listCapacityRoles,
  readPlanScenario,
  RuntimeApiError,
  writePlanScenario,
} from '@/services/initiatives-execution/runtimeApi';

interface RoleOption {
  roleId: string;
  roleLabel: string;
  fteWeekly: number;
  headcount: number;
}
interface RoleDemandLine {
  roleId: string;
  roleLabel: string;
  fte: number;
}
interface PlanWindow {
  initiativeId: string;
  roleDemand?: RoleDemandLine[];
  [key: string]: unknown;
}
interface PlanPayload {
  scenarioId: string;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  windows: PlanWindow[];
  [key: string]: unknown;
}

export function PlanRoleDemandEditor({
  scenarioId,
  initiativeNames,
}: {
  scenarioId: string;
  initiativeNames: Map<string, string>;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [plan, setPlan] = useState<PlanPayload | null>(null);
  const [version, setVersion] = useState(0);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<'IDLE' | 'SAVING' | 'SAVED' | 'FAILED'>('IDLE');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [rule, setRule] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [planBody, roleBody] = await Promise.all([
        readPlanScenario(scenarioId) as Promise<{ version: number; scenario: PlanPayload }>,
        listCapacityRoles() as Promise<{ roles: RoleOption[] }>,
      ]);
      setPlan(planBody.scenario);
      setVersion(planBody.version);
      setRoles(roleBody.roles ?? []);
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, [scenarioId]);
  useEffect(() => {
    void load();
  }, [load]);

  // Kolumny arkusza = role obsadzone w organizacji + role juz uzyte w planie
  // (nawet gdy ostatnia osoba o tym stanowisku odeszla — plan ma o niej pamietac).
  const columns = useMemo(() => {
    const map = new Map<string, string>();
    for (const role of roles) map.set(role.roleId, role.roleLabel);
    for (const window of plan?.windows ?? [])
      for (const line of window.roleDemand ?? []) map.set(line.roleId, line.roleLabel);
    return [...map.entries()]
      .map(([roleId, roleLabel]) => ({ roleId, roleLabel }))
      .sort((left, right) => left.roleLabel.localeCompare(right.roleLabel, 'pl'));
  }, [roles, plan]);

  const editable = plan?.status === 'DRAFT';

  const save = async (initiativeId: string, roleId: string, roleLabel: string, raw: string) => {
    if (!plan || saveState === 'SAVING') return;
    const parsed = Number(raw.replace(',', '.'));
    if (raw.trim() !== '' && (!Number.isFinite(parsed) || parsed < 0)) return;
    const fte = raw.trim() === '' ? 0 : parsed;
    const windows = plan.windows.map((window) => {
      if (window.initiativeId !== initiativeId) return window;
      const others = (window.roleDemand ?? []).filter((line) => line.roleId !== roleId);
      return {
        ...window,
        roleDemand: fte > 0 ? [...others, { roleId, roleLabel, fte }] : others,
      };
    });
    setRule(null);
    setSaveState('SAVING');
    try {
      const updated = (await writePlanScenario(plan.scenarioId, {
        expectedVersion: version,
        clientRequestId: crypto.randomUUID(),
        operation: 'UPDATE',
        portfolio: 'auto',
        scenario: { ...plan, windows },
      })) as { aggregateVersion: number; response: PlanPayload };
      setVersion(updated.aggregateVersion);
      setPlan(updated.response);
      setSaveState('SAVED');
      setSavedAt(new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }));
    } catch (error) {
      setRule(error instanceof RuntimeApiError ? (error.rule ?? error.code ?? null) : null);
      setSaveState('FAILED');
    }
  };

  if (state === 'LOADING')
    return (
      <p role="status" className="text-sm text-c-text-muted">
        {t('initiatives.planScenario.roleDemand.loading', 'Wczytuję obciążenie ról…')}
      </p>
    );
  if (state === 'ERROR')
    return (
      <p role="alert" className="text-sm text-c-danger">
        {t(
          'initiatives.planScenario.roleDemand.unavailable',
          'Nie udało się wczytać obciążenia ról.'
        )}
      </p>
    );
  if (!plan?.windows.length)
    return (
      <p className="text-sm text-c-text-muted">
        {t(
          'initiatives.planScenario.roleDemand.noWindows',
          'Plan nie ma jeszcze żadnej inicjatywy w zakresie — najpierw wybierz je w generatorze.'
        )}
      </p>
    );
  if (!columns.length)
    return (
      <p className="text-sm text-c-text-muted">
        {t(
          'initiatives.planScenario.roleDemand.noRoles',
          'Żadna osoba w organizacji nie ma wpisanego stanowiska. Uzupełnij stanowiska w Zespole, aby zaplanować obciążenie ról.'
        )}
      </p>
    );

  const head = 'px-3 py-2 text-left text-xs font-medium text-c-text-muted';
  return (
    <div className="overflow-x-auto">
      <p className="mb-3 text-sm text-c-text-muted">
        {t(
          'initiatives.planScenario.roleDemand.hint',
          'Wpisz, ile etatów (FTE) każdej roli wymaga inicjatywa w swoim oknie. Te liczby są popytem w analizie obciążenia.'
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
          {plan.windows.map((window) => (
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
                      disabled={!editable || saveState === 'SAVING'}
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
            'Plan jest opublikowany — obciążenie ról jest tylko do odczytu.'
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
          {t('initiatives.planScenario.roleDemand.failed', 'Nie zapisano obciążenia ról.')}
          {rule ? ` (${rule})` : ''}
        </p>
      )}
    </div>
  );
}
