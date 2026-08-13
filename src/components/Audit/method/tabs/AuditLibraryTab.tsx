/**
 * AuditLibraryTab — U7 Library surface: pakiety audytowe (`AuditPack`).
 *
 * Prezentacyjny komponent — listę i filtr klasyfikacji dostaje z
 * `AuditsMethodHub` (Menu 3 tam żyją chipy klasyfikacji z licznikami; ten
 * komponent tylko renderuje `StandardTable`/`StandardPreview`). Szczegóły
 * pakietu (cel, zakres, taksonomia ustaleń) dociąga sam przy zaznaczeniu
 * wiersza — `GET /audits/packs/:id`.
 *
 * Kanon prawny (brief §D): pakiet NIEZWERYFIKOWANY nie może wyglądać jak
 * norma — kolumna i chip klasyfikacji w preview używają WYŁĄCZNIE
 * `packClassificationTone` (patrz `auditStatusTones.ts`), nigdy `success`
 * poza `VERIFIED_NORMATIVE`.
 */
import { Library as LibraryIcon, PlayCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { type StandardRowMenu, StandardPreview, StandardTable, type TableColumn } from '@/components/standard';
import type { ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { ErrorState } from '@/components/shared/states';
import { StatusChip } from '@/components/ui/primitives/chips';

import {
  packClassificationLabel,
  packClassificationTone,
  packPublicationLabel,
  packPublicationTone,
} from '../auditStatusTones';
import {
  getPack,
  PACK_CLASSIFICATIONS,
  PACK_PUBLICATION_STATUSES,
  type AuditPackDetail,
  type AuditPackSummary,
} from '../auditsMethodApi';

export interface AuditLibraryTabProps {
  packs: AuditPackSummary[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  isPolish: boolean;
  onStartAudit: (pack: AuditPackSummary) => void;
  startingPackId: string | null;
}

export const AuditLibraryTab: React.FC<AuditLibraryTabProps> = ({
  packs,
  loading,
  error,
  onRetry,
  isPolish,
  onStartAudit,
  startingPackId,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditPackDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    getPack(selectedId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectedPack = packs.find((p) => p.id === selectedId) || null;

  const columns: TableColumn[] = [
    {
      id: 'title',
      label: isPolish ? 'Tytuł' : 'Title',
      render: (row: AuditPackSummary) => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-c-text">{row.title}</span>
          <span className="font-mono text-[11px] text-c-text-muted">{row.packKey}</span>
        </div>
      ),
    },
    {
      id: 'source',
      label: isPolish ? 'Źródło' : 'Source',
      width: '180px',
      render: (row: AuditPackSummary) => (
        <span className="text-xs text-c-text-secondary truncate block max-w-[160px]">
          {row.sourceTitle || '—'}
        </span>
      ),
    },
    {
      id: 'version',
      label: isPolish ? 'Wersja' : 'Version',
      width: '90px',
      render: (row: AuditPackSummary) => (
        <span className="font-mono text-xs text-c-text-secondary">v{row.version}</span>
      ),
    },
    {
      id: 'classification',
      label: isPolish ? 'Klasyfikacja' : 'Classification',
      width: '190px',
      filterable: true,
      filterOptions: PACK_CLASSIFICATIONS.map((value) => ({
        value,
        label: packClassificationLabel(value, isPolish),
      })),
      render: (row: AuditPackSummary) => (
        <StatusChip
          label={packClassificationLabel(row.classification, isPolish)}
          tone={packClassificationTone(row.classification)}
        />
      ),
    },
    {
      id: 'publicationStatus',
      label: isPolish ? 'Status publikacji' : 'Publication status',
      width: '150px',
      filterable: true,
      filterOptions: PACK_PUBLICATION_STATUSES.map((value) => ({
        value,
        label: packPublicationLabel(value, isPolish),
      })),
      render: (row: AuditPackSummary) => (
        <StatusChip
          label={packPublicationLabel(row.publicationStatus, isPolish)}
          tone={packPublicationTone(row.publicationStatus)}
        />
      ),
    },
    {
      id: 'criteriaCount',
      label: isPolish ? 'Kryteria' : 'Criteria',
      width: '90px',
      render: (row: AuditPackSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">{row.criteriaCount}</span>
      ),
    },
    {
      id: 'updatedAt',
      label: isPolish ? 'Zaktualizowano' : 'Updated',
      width: '140px',
      sortable: true,
    },
  ];

  const rowMenu = (row: AuditPackSummary): StandardRowMenu => {
    const canStart = row.publicationStatus === 'published';
    return {
      primary: [
        {
          id: 'start',
          label: isPolish ? 'Rozpocznij audyt' : 'Start audit',
          icon: PlayCircle,
          onClick: canStart ? () => onStartAudit(row) : undefined,
          disabled: !canStart || startingPackId === row.id,
          note: canStart
            ? undefined
            : isPolish
              ? 'Pakiet nie jest opublikowany — nie można rozpocząć audytu.'
              : 'Pack is not published — an audit cannot be started from it.',
        },
      ],
      universalHandlers: {
        preview: () => setSelectedId(row.id),
      },
    };
  };

  if (error) {
    return (
      <div className="p-4">
        <ErrorState
          title={isPolish ? 'Nie udało się wczytać biblioteki pakietów' : 'Could not load the pack library'}
          description={error}
          onRetry={onRetry}
        />
      </div>
    );
  }

  const detailProperties: ArtifactPropertyRow[] | undefined = detail
    ? [
        {
          id: 'purpose',
          label: isPolish ? 'Cel' : 'Purpose',
          value: detail.purpose || (isPolish ? '— nie podano —' : '— not provided —'),
        },
        {
          id: 'scope',
          label: isPolish ? 'Zakres' : 'Scope',
          value: detail.scope || (isPolish ? '— nie podano —' : '— not provided —'),
        },
        {
          id: 'source',
          label: isPolish ? 'Źródło' : 'Source',
          value: `${detail.sourceTitle || '—'}${detail.sourceVersion ? ` (v${detail.sourceVersion})` : ''}`,
        },
        {
          id: 'rights',
          label: isPolish ? 'Prawa' : 'Rights',
          value: detail.rightsStatus || (isPolish ? 'Nie zweryfikowano' : 'Not verified'),
        },
        {
          id: 'roles',
          label: isPolish ? 'Wymagane role' : 'Required roles',
          value: detail.requiredRoles.length ? detail.requiredRoles.join(', ') : '—',
        },
        {
          id: 'taxonomy',
          label: isPolish ? 'Taksonomia ustaleń' : 'Finding taxonomy',
          value: detail.findingTaxonomy.length
            ? detail.findingTaxonomy.map((t) => t.label).join(', ')
            : isPolish
              ? 'Brak zdefiniowanej taksonomii'
              : 'No taxonomy defined',
        },
        {
          id: 'criteriaCount',
          label: isPolish ? 'Liczba kryteriów' : 'Criteria count',
          value: String(detail.criteria.length || detail.criteriaCount),
          mono: true,
        },
      ]
    : undefined;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 overflow-auto p-4">
        <StandardTable
          columns={columns}
          data={packs}
          loading={loading}
          rowMenu={rowMenu}
          onRowClick={(row) => setSelectedId(String(row.id))}
          selectedRowId={selectedId}
          persistKey="audits.method.library"
          empty={{
            icon: LibraryIcon,
            title: isPolish ? 'Brak pakietów audytowych' : 'No audit packs yet',
            description: isPolish
              ? 'Biblioteka jest pusta. Skorzystaj z pakietu demonstracyjnego albo poczekaj na publikację pierwszej metodyki.'
              : 'The library is empty. Seed a demo pack or wait for the first methodology to be published.',
          }}
        />
      </div>
      {selectedPack ? (
        <div className="w-[380px] shrink-0 border-l border-c-border-subtle">
          <StandardPreview
            title={selectedPack.title}
            onClose={() => setSelectedId(null)}
            loading={detailLoading}
            meta={{
              pills: [
                {
                  label: isPolish ? 'Klasyfikacja' : 'Classification',
                  value: packClassificationLabel(selectedPack.classification, isPolish),
                  tone: packClassificationTone(selectedPack.classification),
                },
                {
                  label: isPolish ? 'Publikacja' : 'Publication',
                  value: packPublicationLabel(selectedPack.publicationStatus, isPolish),
                  tone: packPublicationTone(selectedPack.publicationStatus),
                },
              ],
              recommendation:
                selectedPack.publicationStatus !== 'published'
                  ? isPolish
                    ? 'CTA „Rozpocznij audyt" jest nieaktywne: ten pakiet nie ma statusu „Opublikowany".'
                    : 'The "Start audit" CTA is disabled: this pack is not in "Published" status.'
                  : undefined,
            }}
            details={{ properties: detailProperties, label: isPolish ? 'Szczegóły' : 'Details' }}
            actions={{
              resolutions: [
                {
                  id: 'start',
                  variant: 'primary',
                  label: isPolish ? 'Rozpocznij audyt' : 'Start audit',
                  icon: PlayCircle,
                  onClick: () => onStartAudit(selectedPack),
                  disabled: selectedPack.publicationStatus !== 'published' || startingPackId === selectedPack.id,
                },
              ],
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

export default AuditLibraryTab;
