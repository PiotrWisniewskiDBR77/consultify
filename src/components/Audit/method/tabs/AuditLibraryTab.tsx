/**
 * AuditLibraryTab — U7 Library surface: pakiety audytowe (`AuditPack`).
 *
 * Prezentacyjny komponent — listę i DWA niezależne filtry (typ źródła,
 * weryfikacja) dostaje z `AuditsMethodHub` (Menu 3 tam żyją oba rzędy chipów
 * z licznikami; ten komponent tylko renderuje `StandardTable`/
 * `StandardPreview`). Szczegóły pakietu (cel, zakres, taksonomia ustaleń)
 * dociąga sam przy zaznaczeniu wiersza — `GET /audits/packs/:id`.
 *
 * Kanon prawny (P0 2026-08-13 — patrz `server/src/services/audits/types.ts`):
 * DWIE NIEZALEŻNE OSIE. Kolumna „Typ źródła" (`packSourceTypeLabel`/
 * `packSourceTypeTone`) NIGDY nie odpowiada na „czy sprawdzono", a kolumna
 * „Weryfikacja" (`packVerificationLabel`/`packVerificationTone`) NIGDY nie
 * zmienia etykiety typu. Ton `success` przysługuje wyłącznie
 * `verificationStatus === 'VERIFIED'` — oś typu źródła go nie zna.
 */
import { Library as LibraryIcon, PlayCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import {
  type StandardRowMenu,
  StandardPreview,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard';
import type { ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { ErrorState } from '@/components/shared/states';
import { StatusChip } from '@/components/ui/primitives/chips';
import { formatListDate } from '@/utils/listDateFormat';

import { auditRoleLabel } from '../auditRoleLabels';
import {
  packPublicationLabel,
  packPublicationTone,
  packSourceTypeLabel,
  packSourceTypeTone,
  packVerificationLabel,
  packVerificationTone,
} from '../auditStatusTones';
import {
  AUDIT_SOURCE_TYPES,
  AUDIT_VERIFICATION_STATES,
  getPack,
  isComplianceGrade,
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

/**
 * Bramka „czy ten pakiet wolno traktować jako opublikowaną podstawę audytu".
 * Wymaga OBU: `publicationStatus === 'published'` I przypisanego źródła —
 * pakiet bez źródła (`sourceId` puste) nie może zachowywać się w UI jak
 * opublikowany, niezależnie od tego, co zwróci API (test: „pakiet bez źródła
 * nie może mieć statusu published w UI").
 */
function evaluateStartGate(
  row: AuditPackSummary,
  isPolish: boolean
): { allowed: boolean; reason?: string } {
  if (!row.sourceId) {
    return {
      allowed: false,
      reason: isPolish
        ? 'Pakiet nie ma przypisanego źródła — nie może mieć statusu „opublikowany" do audytu.'
        : 'Pack has no source attached — it cannot count as "published" for an audit.',
    };
  }
  if (row.publicationStatus !== 'published') {
    return {
      allowed: false,
      reason: isPolish
        ? 'Pakiet nie jest opublikowany — nie można rozpocząć audytu.'
        : 'Pack is not published — an audit cannot be started from it.',
    };
  }
  return { allowed: true };
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
      id: 'sourceType',
      label: isPolish ? 'Typ źródła' : 'Source type',
      width: '190px',
      filterable: true,
      filterOptions: AUDIT_SOURCE_TYPES.map((value) => ({
        value,
        label: packSourceTypeLabel(value, isPolish),
      })),
      render: (row: AuditPackSummary) => (
        <StatusChip
          label={packSourceTypeLabel(row.sourceType, isPolish)}
          tone={packSourceTypeTone(row.sourceType)}
        />
      ),
    },
    {
      id: 'verificationStatus',
      label: isPolish ? 'Weryfikacja' : 'Verification',
      width: '170px',
      filterable: true,
      filterOptions: AUDIT_VERIFICATION_STATES.map((value) => ({
        value,
        label: packVerificationLabel(value, isPolish),
      })),
      render: (row: AuditPackSummary) => (
        <StatusChip
          label={packVerificationLabel(row.verificationStatus, isPolish)}
          tone={packVerificationTone(row.verificationStatus)}
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
      render: (row: AuditPackSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">{formatListDate(row.updatedAt)}</span>
      ),
    },
  ];

  // StandardTable woła `rowMenu` z ogólnym `TableRow`; wiersze pochodzą z
  // `packs`, więc zawężenie jest bezpieczne i trzymane w jednym miejscu.
  const rowMenu = (rawRow: TableRow): StandardRowMenu => {
    const row = rawRow as unknown as AuditPackSummary;
    const gate = evaluateStartGate(row, isPolish);
    return {
      primary: [
        {
          id: 'start',
          label: isPolish ? 'Rozpocznij audyt' : 'Start audit',
          icon: PlayCircle,
          onClick: gate.allowed ? () => onStartAudit(row) : undefined,
          disabled: !gate.allowed || startingPackId === row.id,
          note: gate.reason,
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
          value: detail.requiredRoles.length
            ? detail.requiredRoles.map((role) => auditRoleLabel(role, isPolish)).join(', ')
            : '—',
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

  const startGate = selectedPack ? evaluateStartGate(selectedPack, isPolish) : { allowed: false };
  const complianceGrade = selectedPack
    ? isComplianceGrade(selectedPack.sourceType, selectedPack.verificationStatus)
    : false;

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
                  label: isPolish ? 'Typ źródła' : 'Source type',
                  value: packSourceTypeLabel(selectedPack.sourceType, isPolish),
                  tone: packSourceTypeTone(selectedPack.sourceType),
                },
                {
                  label: isPolish ? 'Weryfikacja' : 'Verification',
                  value: packVerificationLabel(selectedPack.verificationStatus, isPolish),
                  tone: packVerificationTone(selectedPack.verificationStatus),
                },
                {
                  label: isPolish ? 'Publikacja' : 'Publication',
                  value: packPublicationLabel(selectedPack.publicationStatus, isPolish),
                  tone: packPublicationTone(selectedPack.publicationStatus),
                },
                {
                  // Widoczny dowód, że DEMONSTRATION/LEGACY nigdy nie liczą się
                  // jako podstawa audytu zgodności — nawet gdyby verificationStatus
                  // było VERIFIED, `isComplianceGrade` wymaga też normatywnego
                  // `sourceType`.
                  label: isPolish ? 'Podstawa audytu zgodności' : 'Compliance-audit basis',
                  value: complianceGrade ? (isPolish ? 'Tak' : 'Yes') : isPolish ? 'Nie' : 'No',
                  tone: complianceGrade ? 'success' : 'neutral',
                },
              ],
              recommendation: startGate.reason,
            }}
            details={{
              properties: detailProperties,
              label: isPolish ? 'Szczegóły' : 'Details',
              propertyLabel: isPolish ? 'Właściwość' : 'Property',
              valueLabel: isPolish ? 'Wartość' : 'Value',
            }}
            actions={{
              resolutions: [
                {
                  id: 'start',
                  // Kanon dopuszcza cztery warianty; `primary` nie istnieje, a
                  // crimson nie może być CTA. `positive` jest właściwym tonem
                  // dla akcji rozpoczynającej pracę.
                  variant: 'positive',
                  label: isPolish ? 'Rozpocznij audyt' : 'Start audit',
                  icon: PlayCircle,
                  onClick: () => onStartAudit(selectedPack),
                  disabled: !startGate.allowed || startingPackId === selectedPack.id,
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
