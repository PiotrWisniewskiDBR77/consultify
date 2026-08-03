/**
 * AssessmentLibraryTab — ASM-001A Library surface.
 *
 * Thin adapter, NOT a new store: reads published DRD assessment definitions
 * from the existing V8 definitions endpoint and starts a new assessment
 * bound to the newest published version. SIRI/ADMA/CMMI/Lean are shown as
 * disabled catalog rows (no engine yet) — per ASM-001 audit, "cards not
 * supported in MVP can be disabled with an explicit status" rather than
 * hidden (TRIADA_KANON.md C3: a disabled row explains WHY, it never lies by
 * omission).
 *
 * List UI is StandardTable ONLY (docs/ui-standards/TRIADA_KANON.md — list
 * screens use StandardModuleBar/StandardTable/StandardPreview exclusively,
 * no bespoke tables/menus). This tab has no preview aside: rows either start
 * an assessment (navigates away) or are inert (disabled, nothing to preview).
 *
 * MVP compromise (ASM-001 audit, explicitly sanctioned): the backend does
 * NOT expose a "published only" filter endpoint yet — only
 * `GET /definitions/:methodologyId`, which returns draft+published+
 * deprecated rows. This component fetches that list and filters to
 * `status === 'published'` client-side, picking the newest version. Do not
 * ask the backend for a new endpoint here — one already exists.
 */
import { Clock3, Library as LibraryIcon, PlayCircle } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { ErrorState } from '@/components/shared/states';
import { type StandardRowMenu, StandardTable, type TableColumn } from '@/components/standard';
import { StatusChip } from '@/components/ui/primitives/chips';
import { V8AssessmentApi } from '@/services/api/v8';
import type { V8AssessmentDefinitionRecord } from '@/services/api/v8/assessment';

type MethodologyId = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

interface MethodologyRow {
  id: MethodologyId;
  name: string;
  description: string;
  supported: boolean;
}

// Static catalog — only DRD has a real published-definition-backed engine
// today. The other four are declared (not hidden) so the Library reads as a
// complete map of what Consultify assesses, not just what's finished.
const METHODOLOGY_CATALOG: MethodologyRow[] = [
  {
    id: 'DRD',
    name: 'Digital Readiness Diagnosis',
    description: 'Assess digital maturity across 5 axes, area by area.',
    supported: true,
  },
  {
    id: 'SIRI',
    name: 'Smart Industry Readiness Index',
    description: 'Singapore SIRI Industry 4.0 maturity framework.',
    supported: false,
  },
  {
    id: 'ADMA',
    name: 'Advanced Digital Maturity Assessment',
    description: 'Extended digital maturity model across process dimensions.',
    supported: false,
  },
  {
    id: 'CMMI',
    name: 'Capability Maturity Model Integration',
    description: 'Process capability and maturity model.',
    supported: false,
  },
  {
    id: 'LEAN',
    name: 'Lean 4.0',
    description: 'Lean manufacturing maturity assessment.',
    supported: false,
  },
];

function pickLatestPublished(
  versions: V8AssessmentDefinitionRecord[]
): V8AssessmentDefinitionRecord | null {
  const published = versions.filter((v) => v.status === 'published');
  if (published.length === 0) return null;
  const EPOCH = '1970-01-01T00:00:00.000Z';
  return [...published].sort((a, b) => {
    const at = new Date(a.publishedAt || a.updatedAt || a.createdAt || EPOCH).getTime();
    const bt = new Date(b.publishedAt || b.updatedAt || b.createdAt || EPOCH).getTime();
    return bt - at;
  })[0];
}

export const AssessmentLibraryTab: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [drdDefinition, setDrdDefinition] = useState<V8AssessmentDefinitionRecord | null>(null);
  const [startingId, setStartingId] = useState<MethodologyId | null>(null);

  const loadDrdDefinition = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const resp = await V8AssessmentApi.getDefinitions('DRD');
      const latest = pickLatestPublished(resp?.versions || []);
      setDrdDefinition(latest);
      if (!latest) {
        setFetchError(
          'No published DRD definition found yet — Start will be disabled until one is published.'
        );
      }
    } catch (e: any) {
      setFetchError(e?.message || 'Could not load the assessment definition catalog.');
      setDrdDefinition(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDrdDefinition();
  }, [loadDrdDefinition]);

  const handleStart = useCallback(
    async (row: MethodologyRow) => {
      if (!row.supported || !drdDefinition) return;
      setStartingId(row.id);
      const toastId = toast.loading(`Starting ${row.name}…`);
      try {
        const created = await V8AssessmentApi.createAssessment({
          assessmentType: row.id,
          name: `${row.name} — ${new Date().toLocaleDateString()}`,
          definitionId: drdDefinition.id,
          definitionVersion: drdDefinition.version,
        });
        const newId = (created as any)?.id || (created as any)?.assessment?.id;
        if (!newId) throw new Error('Assessment created but no id was returned');
        toast.success(`${row.name} started`, { id: toastId });
        navigate(`/assessment/${row.id.toLowerCase()}/${newId}`);
      } catch (e: any) {
        const code = e?.data?.code;
        if (code === 'DEFINITION_NOT_PUBLISHED' || code === 'DEFINITION_NOT_FOUND') {
          toast.error(
            code === 'DEFINITION_NOT_PUBLISHED'
              ? 'This DRD definition is no longer published. Refreshing the Library…'
              : 'The selected DRD definition could not be found. Refreshing the Library…',
            { id: toastId }
          );
          void loadDrdDefinition();
        } else {
          toast.error(e?.message || `Failed to start ${row.name}`, { id: toastId });
        }
      } finally {
        setStartingId(null);
      }
    },
    [drdDefinition, navigate, loadDrdDefinition]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: 'Framework',
        render: (row: any) => (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-c-text">{row.name}</span>
            <span className="font-mono text-[11px] font-bold text-c-text-muted">{row.id}</span>
          </div>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        width: '220px',
        render: (row: MethodologyRow) => {
          if (row.id !== 'DRD') {
            return <StatusChip label="Coming soon" tone="neutral" />;
          }
          if (isLoading) {
            return <StatusChip label="Checking…" tone="neutral" />;
          }
          if (drdDefinition) {
            return <StatusChip label={`Published v${drdDefinition.version}`} tone="success" />;
          }
          return <StatusChip label="Unavailable" tone="danger" />;
        },
      },
      {
        id: 'action',
        label: 'Actions',
        width: '140px',
        render: (row: MethodologyRow) => {
          const disabled = !row.supported || !drdDefinition || startingId === row.id;
          return (
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                void handleStart(row);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-sm font-medium text-[var(--c-text)] transition-colors hover:bg-[var(--c-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] disabled:cursor-not-allowed disabled:opacity-50"
              title={
                row.supported
                  ? drdDefinition
                    ? `Start a new ${row.name} assessment`
                    : 'No published definition available yet'
                  : 'Not available in this MVP'
              }
            >
              {startingId === row.id ? (
                <Clock3 size={14} className="animate-spin" />
              ) : (
                <PlayCircle size={14} />
              )}
              Start
            </button>
          );
        },
      },
    ],
    [drdDefinition, isLoading, startingId, handleStart]
  );

  const data = useMemo(() => METHODOLOGY_CATALOG.map((row) => ({ ...row })), []);

  const rowMenu = useCallback(
    (row: any): StandardRowMenu => {
      const methodology = row as MethodologyRow;
      const canStart = methodology.supported && !!drdDefinition;
      return {
        primary: canStart
          ? [
              {
                id: 'start',
                label: 'Start',
                icon: PlayCircle,
                onClick: () => void handleStart(methodology),
              },
            ]
          : [],
      };
    },
    [drdDefinition, handleStart]
  );

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-4">
      {fetchError && (
        <ErrorState
          compact
          title="DRD definition catalog"
          description={fetchError}
          onRetry={() => void loadDrdDefinition()}
        />
      )}
      <StandardTable
        columns={columns}
        data={data}
        loading={isLoading && !fetchError}
        rowMenu={rowMenu}
        rowDescription={(row: any) => (row as MethodologyRow).description}
        persistKey="assessment.hub.library"
        empty={{
          icon: LibraryIcon,
          title: 'No assessment frameworks available',
          description: 'The methodology catalog could not be loaded.',
        }}
      />
    </div>
  );
};

export default AssessmentLibraryTab;
