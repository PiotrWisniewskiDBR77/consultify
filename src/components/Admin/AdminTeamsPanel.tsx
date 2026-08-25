import { Plus, RefreshCw, Trash2, UserMinus, UserPlus, Users } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { TeamApi, type Team } from '../../services/api/teams.api';
import { ConfirmDialog } from '../MyWork/shared/ConfirmDialog';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';

const inputClass =
  'w-full rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]';
const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm font-medium text-c-text hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]';

export const AdminTeamsPanel: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [memberUserId, setMemberUserId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ team: Team; userId: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTeams(await TeamApi.getTeams());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Nie udało się pobrać zespołów.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const selected = teams.find((team) => team.id === selectedId) || null;

  const createTeam = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const created = await TeamApi.createTeam({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      const readback = await TeamApi.getTeams();
      if (!readback.some((team) => team.id === created.id)) {
        throw new Error('Zespół nie został potwierdzony przez odczyt z serwera.');
      }
      setTeams(readback);
      setName('');
      setDescription('');
      setSelectedId(created.id);
      toast.success('Zespół utworzony');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Nie udało się utworzyć zespołu.');
    } finally {
      setBusy(false);
    }
  };

  const addMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !memberUserId.trim() || busy) return;
    setBusy(true);
    try {
      await TeamApi.addTeamMember(selected.id, memberUserId.trim());
      const readback = await TeamApi.getTeam(selected.id);
      if (!readback.members.some((member) => member.userId === memberUserId.trim())) {
        throw new Error('Członek nie został potwierdzony przez odczyt z serwera.');
      }
      setTeams((current) => current.map((team) => (team.id === readback.id ? readback : team)));
      setMemberUserId('');
      toast.success('Członek dodany');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Nie udało się dodać członka.');
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async () => {
    if (!removeTarget || busy) return;
    setBusy(true);
    try {
      await TeamApi.removeTeamMember(removeTarget.team.id, removeTarget.userId);
      const readback = await TeamApi.getTeam(removeTarget.team.id);
      if (readback.members.some((member) => member.userId === removeTarget.userId)) {
        throw new Error('Usunięcie członka nie zostało potwierdzone przez serwer.');
      }
      setTeams((current) => current.map((team) => (team.id === readback.id ? readback : team)));
      setRemoveTarget(null);
      toast.success('Członek usunięty');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Nie udało się usunąć członka.');
    } finally {
      setBusy(false);
    }
  };

  const deleteTeam = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await TeamApi.deleteTeam(deleteTarget.id);
      const readback = await TeamApi.getTeams();
      if (readback.some((team) => team.id === deleteTarget.id)) {
        throw new Error('Usunięcie zespołu nie zostało potwierdzone przez serwer.');
      }
      setTeams(readback);
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
      toast.success('Zespół usunięty');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Nie udało się usunąć zespołu.');
    } finally {
      setBusy(false);
    }
  };

  const rows = useMemo<TableRow[]>(
    () =>
      teams.map((team) => ({
        ...team,
        id: team.id,
        leadName: team.lead
          ? [team.lead.firstName, team.lead.lastName].filter(Boolean).join(' ') || '—'
          : '—',
        memberTotal: team.memberCount ?? team.members.length,
        statusLabel: team.isActive === false ? 'Nieaktywny' : 'Aktywny',
      })),
    [teams]
  );

  const columns = useMemo<TableColumn[]>(
    () => [
      { id: 'name', label: 'Nazwa', sortable: true },
      { id: 'leadName', label: 'Lider', sortable: true },
      { id: 'memberTotal', label: 'Członkowie', sortable: true, width: '130px' },
      { id: 'teamType', label: 'Typ', width: '140px' },
      { id: 'statusLabel', label: 'Status', width: '130px' },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-c-border bg-c-surface p-5">
        <h2 className="text-lg font-semibold text-c-text">Zespoły</h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          Twórz zespoły i zarządzaj ich rzeczywistym składem w organizacji.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto]" onSubmit={createTeam}>
          <label className="text-sm text-c-text-secondary">
            Nazwa zespołu
            <input
              className={`${inputClass} mt-1`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className="text-sm text-c-text-secondary">
            Opis
            <input
              className={`${inputClass} mt-1`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <button
            className={`${buttonClass} self-end`}
            type="submit"
            disabled={busy || !name.trim()}
          >
            <Plus className="h-4 w-4" /> Utwórz
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-c-border bg-c-surface p-2">
        <StandardTable
          columns={columns}
          data={rows}
          loading={loading}
          error={error}
          onRetry={() => void load()}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(String(row.id))}
          rowMenu={(row) => ({
            primary: [
              { id: 'open', label: 'Pokaż skład', onClick: () => setSelectedId(String(row.id)) },
            ],
            destructive: {
              label: 'Usuń zespół',
              icon: Trash2,
              onClick: () => setDeleteTarget(teams.find((team) => team.id === row.id) || null),
            },
          })}
          empty={{
            icon: Users,
            title: 'Brak zespołów',
            description: 'Utwórz pierwszy zespół powyżej.',
          }}
          persistKey="admin.teams"
        />
      </section>

      {selected && (
        <section className="rounded-2xl border border-c-border bg-c-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-c-text">Skład: {selected.name}</h3>
              <p className="mt-1 text-sm text-c-text-secondary">
                Identyfikator użytkownika musi należeć do tej organizacji.
              </p>
            </div>
            <button
              className={buttonClass}
              type="button"
              onClick={() => void load()}
              disabled={busy}
            >
              <RefreshCw className="h-4 w-4" /> Odśwież
            </button>
          </div>
          <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={addMember}>
            <label className="flex-1 text-sm text-c-text-secondary">
              ID użytkownika
              <input
                className={`${inputClass} mt-1`}
                value={memberUserId}
                onChange={(event) => setMemberUserId(event.target.value)}
                required
              />
            </label>
            <button
              className={`${buttonClass} self-end`}
              type="submit"
              disabled={busy || !memberUserId.trim()}
            >
              <UserPlus className="h-4 w-4" /> Dodaj członka
            </button>
          </form>
          {selected.members.length === 0 ? (
            <p className="mt-4 rounded-xl border border-c-border-subtle bg-c-surface-raised p-4 text-sm text-c-text-secondary">
              Ten zespół nie ma jeszcze członków.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-c-border-subtle" aria-label="Członkowie zespołu">
              {selected.members.map((member) => (
                <li key={member.userId} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-c-text">
                      {[member.user?.firstName, member.user?.lastName].filter(Boolean).join(' ') ||
                        member.userId}
                    </p>
                    <p className="text-xs text-c-text-secondary">
                      {member.user?.email || member.role}
                    </p>
                  </div>
                  <button
                    className={buttonClass}
                    type="button"
                    onClick={() => setRemoveTarget({ team: selected, userId: member.userId })}
                  >
                    <UserMinus className="h-4 w-4 text-c-danger" /> Usuń
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void deleteTeam()}
        title="Usunąć zespół?"
        description={
          deleteTarget
            ? `Zespół „${deleteTarget.name}” i jego przypisania członków zostaną usunięte.`
            : undefined
        }
        confirmLabel="Usuń zespół"
        variant="danger"
      />
      <ConfirmDialog
        isOpen={Boolean(removeTarget)}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => void removeMember()}
        title="Usunąć członka z zespołu?"
        description="Użytkownik pozostanie członkiem organizacji, ale straci przypisanie do tego zespołu."
        confirmLabel="Usuń członka"
        variant="danger"
      />
    </div>
  );
};

export default AdminTeamsPanel;
