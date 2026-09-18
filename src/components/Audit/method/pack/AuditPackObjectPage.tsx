/**
 * AuditPackObjectPage — OP-2 (Wpis 99, wiersz planu 65 / U-27): ekran OBIEKTU
 * pakietu audytowego, SPEC-A archetyp C „Rekord".
 *
 * Do tej pory pakiet istniał w UI wyłącznie jako WIERSZ listy
 * (`AuditLibraryTab`, `StandardTable`) z read-only prawym panelem
 * (`JedenPrawyPanel` + `StandardPreview`, DEC-397). Ten ekran jest drugim
 * wejściem: trasa `/audit-programs/packs/:packId`, otwierana z listy za flagą
 * `VITE_AUDIT_PACKAGE_VIEWER` (domyślnie OFF — przy OFF lista zachowuje się
 * dokładnie jak wcześniej).
 *
 * Powłoka = WSPÓLNE prymitywy SPEC-A, przepis z nagłówka
 * `src/components/standard/ArtifactBreadcrumb.tsx` (§9.2/§11.2):
 * `ArtifactBreadcrumb` NAD `NModeShell` (Menu 1 = breadcrumb + nagłówek z
 * pigułkami i JEDNYM primary) + `ArtifactRightPanel` w slocie `rightPanel`.
 * Ten sam skład, który właściciel zaakceptował na
 * `AuditReportDocumentView` (archetyp B) — `StandardArtifactShell` NIE jest
 * użyty świadomie: jego kontrakt (`karta: KartaNKey`) jest zamkniętą unią
 * siedmiu kart programu SPEC-N i pakiet audytu do niej nie należy.
 *
 * ZERO kopiowania logiki listy. Bramki stanu (`evaluateStartGate`,
 * `evaluateApproveExpertGate`, `evaluatePublishPackGate`) i formatowanie
 * (`formatPackCriteriaCount`) są IMPORTOWANE z `AuditLibraryTab`, a przejścia
 * stanu wołają TE SAME funkcje API co kebab listy (`approvePackByExpert`,
 * `publishPack` z `auditsMethodApi`) — nie własny `fetch`.
 *
 * Prawy panel deklaruje DWIE sekcje kanoniczne (`properties`, `relations`) —
 * poniżej progu `CANONICAL_SHELL_THRESHOLD`, więc `ArtifactRightPanel`
 * przechodzi je 1:1 bez domykania do sześciu. To świadome: pakiet nie ma
 * backendu komentarzy ani historii zdarzeń, a sekcja-bez-danych byłaby
 * atrapą (zasada `AuditReportDocumentView`: „brak danych z backendu = brak
 * sekcji, nigdy atrapa"). RELATIONS czyta prawdziwe programy utworzone z tego
 * pakietu (`listPrograms` filtrowane po `packId`).
 */
import {
  CheckCircle2,
  ClipboardList,
  Library as LibraryIcon,
  ListChecks,
  Pencil,
  PlayCircle,
  Send,
  ShieldCheck,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { NModeShell } from '@/components/shared/NModeLayout/NModeShell';
import type {
  NModeHeaderConfig,
  NModeHeaderOverflowItem,
  NModeSection,
} from '@/components/shared/NModeLayout/types';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';
import { ArtifactBreadcrumb } from '@/components/standard/ArtifactBreadcrumb';
import {
  ArtifactPropertiesTable,
  type ArtifactPropertyRow,
} from '@/components/standard/ArtifactPropertiesTable';
import {
  ARTIFACT_PANEL_CARD_CLASS_DOCKED,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import { StandardTable, type TableColumn, type TableRow } from '@/components/standard';
import { Button } from '@/components/ui/primitives/Button';
import { StatusChip, type StatusTone } from '@/components/ui/primitives/chips';
import { useAppStore } from '@/store/useAppStore';
import { formatListDate } from '@/utils/listDateFormat';
import { isAdminOwnerOrSuperAdminRole } from '@/utils/roleGuards';

import { auditRoleLabel } from '../auditRoleLabels';
import {
  packPublicationLabel,
  packPublicationTone,
  packSourceTypeLabel,
  packSourceTypeTone,
  packVerificationLabel,
  packVerificationTone,
  programLifecycleLabel,
} from '../auditStatusTones';
import {
  approvePackByExpert,
  getPack,
  isComplianceGrade,
  listPrograms,
  publishPack,
  type AuditPackCriterionSummary,
  type AuditPackDetail,
  type AuditPackSummary,
  type AuditProgramSummary,
} from '../auditsMethodApi';
import {
  evaluateApproveExpertGate,
  evaluatePublishPackGate,
  evaluateStartGate,
} from '../tabs/AuditLibraryTab';
import { flattenCriteria, PackCriteriaEditor } from './PackCriteriaEditor';

export interface AuditPackObjectPageProps {
  /** `:packId` z trasy `/audit-programs/packs/:packId`. */
  packId: string | null;
  /**
   * „Start audit" — ta sama bramka `evaluateStartGate` co w liście. Realny
   * przepływ uruchamiania (idempotencja, toast, odświeżenie list, przełączenie
   * zakładki) żyje w `AuditsMethodHub.handleStartAudit` i NIE jest tu kopiowany:
   * wołacz trasy przekazuje nawigację do Biblioteki z tym pakietem zaznaczonym,
   * więc utworzenie programu wykonuje ten sam handler co kebab listy.
   */
  onStartAudit: (pack: AuditPackSummary) => void;
  /** Powrót do listy pakietów (breadcrumb, Back w Menu 1, kebab). */
  onBack: () => void;
}

/** `StatusTone` (chip) → ton pigułki statusu w Menu 1 (`NModeHeaderConfig`). */
const HEADER_STATUS_TONE: Record<
  StatusTone,
  'draft' | 'review' | 'approved' | 'rejected' | 'neutral'
> = {
  neutral: 'neutral',
  info: 'review',
  warning: 'review',
  success: 'approved',
  danger: 'rejected',
};

export const AuditPackObjectPage: React.FC<AuditPackObjectPageProps> = ({
  packId,
  onStartAudit,
  onBack,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const currentUserRole = useAppStore((state) => state.currentUser?.role ?? null);
  // Ta sama bramka platformowa co w `AuditsMethodHub` (`isPlatformAdmin` na
  // backendzie) — importowana, nie przepisana.
  const canManagePackLibrary = useMemo(
    () => isAdminOwnerOrSuperAdminRole(currentUserRole),
    [currentUserRole]
  );

  const [pack, setPack] = useState<AuditPackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [programs, setPrograms] = useState<AuditProgramSummary[]>([]);
  const [programsError, setProgramsError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<'approve' | 'publish' | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [editingCriteria, setEditingCriteria] = useState(false);

  const load = useCallback(async () => {
    if (!packId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getPack(packId);
      if (!result) {
        setError(t('audit.pack.viewer.notFound', 'The pack was not found.'));
        setPack(null);
      } else {
        setPack(result);
      }
    } catch (e: any) {
      setError(
        e?.message || t('audit.pack.viewer.loadFailed', 'Could not load the audit pack.')
      );
      setPack(null);
    } finally {
      setLoading(false);
    }
  }, [packId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * RELATIONS = programy audytowe utworzone z tego pakietu. Odczyt jest
   * najlepszym wysiłkiem: `GET /audits/programs` jest scope'owany do roli, więc
   * brak uprawnień kończy się pustą listą oddaną `ArtifactRightPanel` (sekcja
   * z `isEmpty`), a nie błędem całego ekranu.
   */
  useEffect(() => {
    if (!pack?.id) {
      setPrograms([]);
      setProgramsError(null);
      return;
    }
    let cancelled = false;
    listPrograms({})
      .then((result) => {
        if (cancelled) return;
        setPrograms(result.items.filter((p) => p.packId === pack.id));
        setProgramsError(null);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setPrograms([]);
        setProgramsError(
          e?.message ||
            t('audit.pack.viewer.relationsLoadFailed', 'Could not load the related programs.')
        );
      });
    return () => {
      cancelled = true;
    };
  }, [pack?.id, t]);

  const runTransition = useCallback(
    async (action: 'approve' | 'publish') => {
      if (!pack || transitioning) return;
      setTransitioning(action);
      setTransitionError(null);
      try {
        // TE SAME funkcje API co kebab listy (`AuditsMethodHub`
        // `handleApprovePackExpert` / `handlePublishPack`) — nie własny fetch.
        const updated =
          action === 'approve'
            ? await approvePackByExpert(pack.id)
            : await publishPack(pack.id);
        if (updated) {
          const reread = await getPack(pack.id);
          setPack(reread ?? ({ ...pack, ...updated } as AuditPackDetail));
        } else {
          await load();
        }
      } catch (e: any) {
        setTransitionError(
          e?.message ||
            t('audit.pack.viewer.transitionFailed', 'Could not change the pack status.')
        );
      } finally {
        setTransitioning(null);
      }
    },
    [pack, transitioning, load, t]
  );

  /**
   * OP-2b: edycja kryteriów tylko w `draft` i tylko dla administratora
   * platformy. Oba warunki są zmierzone z backendu, nie wymyślone:
   * `packService.replaceCriteria` rzuca `AuditStateError` dla pakietu
   * `published`, a `PUT /packs/:id/criteria` jest za `requireAdmin(actor)`
   * (`isPlatformAdmin`). Dla `published` lista zostaje read-only; przycisku
   * „New version" NIE ma, bo `createNewVersion` nie ma w frontendzie żadnego
   * wołacza (DEC-607: jedno zdanie w meldunku, zero dopinania).
   */
  const canEditCriteria = pack?.publicationStatus === 'draft' && canManagePackLibrary;

  /**
   * Po udanym zapisie ekran czyta pakiet PONOWNIE (`getPack` w `load`) i
   * renderuje z odpowiedzi serwera: `replaceCriteria` nadaje kryteriom nowe id
   * i `ordinal`, więc lokalny stan roboczy po zapisie nie jest już prawdą.
   */
  const handleCriteriaSaved = useCallback(async () => {
    setEditingCriteria(false);
    await load();
  }, [load]);

  /**
   * `GET /audits/packs/:id` oddaje kryteria jako DRZEWO (`buildCriteriaTree`),
   * więc tabela read-only musi je spłaszczyć tym samym helperem co edytor —
   * inaczej pakiet z zagnieżdżonymi kryteriami pokazuje w podglądzie mniej
   * wierszy, niż użytkownik widzi w trybie edycji.
   */
  const criteriaRows = useMemo<TableRow[]>(
    () =>
      flattenCriteria(pack?.criteria).map((c) => ({
        id: c.key,
        ordinal: c.ordinal,
        refCode: c.refCode,
        title: c.title,
        mandatory: c.mandatory,
      })),
    [pack?.criteria]
  );

  const criteriaCount = criteriaRows.length;

  const criteriaColumns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'ordinal',
        label: t('audit.pack.viewer.criteria.ordinal', 'No.'),
        width: '70px',
        dataType: 'number',
        align: 'right',
        sortable: true,
        render: (row: AuditPackCriterionSummary) => (
          <span className="text-xs text-c-text-secondary tabular-nums">{row.ordinal}</span>
        ),
      },
      {
        id: 'refCode',
        label: t('audit.pack.viewer.criteria.refCode', 'Reference'),
        width: '140px',
        render: (row: AuditPackCriterionSummary) => (
          <span className="font-mono text-xs text-c-text-secondary">{row.refCode || '—'}</span>
        ),
      },
      {
        id: 'title',
        label: t('audit.pack.viewer.criteria.title', 'Criterion'),
        primary: true,
        render: (row: AuditPackCriterionSummary) => (
          <span className="text-sm text-c-text">{row.title}</span>
        ),
      },
      {
        id: 'mandatory',
        label: t('audit.pack.viewer.criteria.mandatory', 'Mandatory'),
        width: '130px',
        dataType: 'status',
        render: (row: AuditPackCriterionSummary) => (
          <StatusChip
            label={
              row.mandatory
                ? t('audit.pack.viewer.yes', 'Yes')
                : t('audit.pack.viewer.no', 'No')
            }
            tone={row.mandatory ? 'info' : 'neutral'}
          />
        ),
      },
    ],
    [t]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <LoadingState
          template="panel"
          label={t('audit.pack.viewer.loading', 'Loading the audit pack…')}
        />
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div className="p-6">
        <ErrorState
          title={t('audit.pack.viewer.loadFailedTitle', 'Could not load the audit pack')}
          description={error || undefined}
          onRetry={load}
          onBack={onBack}
          backLabel={t('audit.pack.viewer.backToList', 'Back to the pack library')}
        />
      </div>
    );
  }

  const startGate = evaluateStartGate(pack, isPolish);
  const approveGate = evaluateApproveExpertGate(pack, isPolish, canManagePackLibrary);
  const publishGate = evaluatePublishPackGate(pack, isPolish, canManagePackLibrary);
  const complianceGrade = isComplianceGrade(pack.sourceType, pack.verificationStatus);

  // JEDEN primary w Menu 1 (SPEC-A §11.2): najbliższe dozwolone przejście stanu.
  // Reszta dozwolonych ląduje w kebabie (`extraOverflowItems` — jedyny prop
  // nagłówka, który realnie renderuje menu; `secondaryActions` jest martwy).
  const startAction = startGate.allowed
    ? {
        id: 'start',
        label: t('audit.pack.viewer.startAudit', 'Start audit'),
        icon: PlayCircle,
        onClick: () => onStartAudit(pack),
      }
    : null;
  const approveAction = approveGate.allowed
    ? {
        id: 'approve-expert',
        label: t('audit.pack.viewer.approveExpert', 'Approve (expert)'),
        icon: CheckCircle2,
        onClick: () => void runTransition('approve'),
      }
    : null;
  const publishAction = publishGate.allowed
    ? {
        id: 'publish',
        label: t('audit.pack.viewer.publish', 'Publish'),
        icon: Send,
        onClick: () => void runTransition('publish'),
      }
    : null;

  const ordered = [startAction, approveAction, publishAction].filter(
    (a): a is NonNullable<typeof a> => a !== null
  );
  const primary = ordered[0];
  const overflowTransitions = ordered.slice(1);

  /**
   * Uczciwy „następny krok": gdy żadna akcja nie jest dozwolona, pokazujemy
   * POWÓD z tej samej bramki co lista — w kolejności start → approve → publish,
   * czyli najpierw to, czego brakuje PAKIETOWI („nie jest opublikowany"), a
   * dopiero potem brak uprawnienia. `NModeHeader` nie umie renderować pozycji
   * disabled z powodem (`NModeHeaderOverflowItem` nie ma `disabled`), więc to
   * ten wiersz niesie wyjaśnienie zamiast ukrytej akcji.
   */
  const nextStepValue = primary
    ? primary.label
    : startGate.reason || approveGate.reason || publishGate.reason;

  const header: NModeHeaderConfig = {
    title: pack.title,
    onTitleChange: () => {},
    titleReadOnly: true,
    // Pakiet nie ma kodu artefaktu ani permalinku w `ARTIFACT_IDENTITY`, więc
    // `artifactId` jest pominięty świadomie: bez niego nagłówek nie renderuje
    // „Kopiuj kod obiektu"/„Kopiuj link" (obie pozycje są bramkowane na
    // `artifactId`) i nie podszywa się pod inny typ artefaktu w linkach.
    artifactType: 'knowledge',
    onSave: () => {},
    hideSaveState: true,
    onClose: onBack,
    statusLabel: packPublicationLabel(pack.publicationStatus, isPolish),
    statusTone: HEADER_STATUS_TONE[packPublicationTone(pack.publicationStatus)] ?? 'neutral',
    inlineActions: (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-c-border-subtle bg-c-surface-raised px-2 py-0.5 font-mono text-[11px] text-c-text-secondary">
          {t('audit.pack.viewer.versionPill', 'Version')} v{pack.version}
        </span>
        <span
          data-testid="audit-pack-criteria-pill"
          className="inline-flex items-center rounded-full border border-c-border-subtle bg-c-surface-raised px-2 py-0.5 text-[11px] tabular-nums text-c-text-secondary"
        >
          {t('audit.pack.viewer.criteriaPill', 'Criteria')} {criteriaCount}
        </span>
      </div>
    ),
    primaryAction: primary
      ? {
          label: { en: primary.label, pl: primary.label },
          icon: primary.icon,
          onClick: primary.onClick,
          disabled: transitioning !== null,
        }
      : undefined,
    extraOverflowItems: [
      ...overflowTransitions.map<NModeHeaderOverflowItem>((action) => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        onClick: action.onClick,
      })),
      {
        id: 'open-library',
        label: t('audit.pack.viewer.openLibrary', 'Open the pack library'),
        icon: LibraryIcon,
        onClick: onBack,
      },
    ],
  };

  const overviewRows: ArtifactPropertyRow[] = [
    {
      id: 'summary',
      label: t('audit.pack.viewer.summary', 'Summary'),
      value:
        pack.summary || t('audit.pack.viewer.noSummary', 'No pack summary recorded yet.'),
    },
    {
      id: 'purpose',
      label: t('audit.pack.viewer.purpose', 'Purpose'),
      value: pack.purpose || t('audit.pack.viewer.noPurpose', 'No pack purpose recorded yet.'),
    },
    {
      id: 'scope',
      label: t('audit.pack.viewer.scope', 'Scope'),
      value: pack.scope || t('audit.pack.viewer.noScope', 'No pack scope recorded yet.'),
    },
    {
      id: 'objectives',
      label: t('audit.pack.viewer.objectives', 'Objectives'),
      value:
        pack.objectives ||
        t('audit.pack.viewer.noObjectives', 'No pack objectives recorded yet.'),
    },
    {
      id: 'auditType',
      label: t('audit.pack.viewer.auditType', 'Audit type'),
      value: pack.auditType || '—',
    },
    {
      id: 'roles',
      label: t('audit.pack.viewer.requiredRoles', 'Required roles'),
      value: pack.requiredRoles.length
        ? pack.requiredRoles.map((role) => auditRoleLabel(role, isPolish)).join(', ')
        : '—',
    },
    {
      id: 'competencies',
      label: t('audit.pack.viewer.requiredCompetencies', 'Required competencies'),
      value: pack.requiredCompetencies.length ? pack.requiredCompetencies.join(', ') : '—',
    },
    {
      id: 'rights',
      label: t('audit.pack.viewer.rights', 'Rights'),
      value: pack.rightsStatus || '—',
    },
  ];

  const propertyRows: ArtifactPropertyRow[] = [
    {
      id: 'publicationStatus',
      label: t('audit.pack.viewer.status', 'Status'),
      value: (
        <StatusChip
          label={packPublicationLabel(pack.publicationStatus, isPolish)}
          tone={packPublicationTone(pack.publicationStatus)}
        />
      ),
    },
    {
      id: 'version',
      label: t('audit.pack.viewer.version', 'Version'),
      value: `v${pack.version}`,
      mono: true,
    },
    {
      id: 'sourceType',
      label: t('audit.pack.viewer.sourceType', 'Source type'),
      value: (
        <StatusChip
          label={packSourceTypeLabel(pack.sourceType, isPolish)}
          tone={packSourceTypeTone(pack.sourceType)}
        />
      ),
    },
    {
      id: 'verificationStatus',
      label: t('audit.pack.viewer.verification', 'Verification'),
      value: (
        <StatusChip
          label={packVerificationLabel(pack.verificationStatus, isPolish)}
          tone={packVerificationTone(pack.verificationStatus)}
        />
      ),
    },
    {
      id: 'complianceGrade',
      label: t('audit.pack.viewer.complianceBasis', 'Compliance-audit basis'),
      value: complianceGrade
        ? t('audit.pack.viewer.yes', 'Yes')
        : t('audit.pack.viewer.no', 'No'),
    },
    {
      id: 'source',
      label: t('audit.pack.viewer.source', 'Source'),
      value: `${pack.sourceTitle || '—'}${pack.sourceVersion ? ` (v${pack.sourceVersion})` : ''}`,
    },
    {
      id: 'taxonomy',
      label: t('audit.pack.viewer.findingTaxonomy', 'Finding taxonomy'),
      value: pack.findingTaxonomy.length
        ? pack.findingTaxonomy.map((entry) => entry.label).join(', ')
        : '—',
    },
    {
      id: 'criteriaCount',
      label: t('audit.pack.viewer.criteriaCount', 'Criteria count'),
      value: criteriaCount,
      mono: true,
    },
    {
      id: 'expertApprovedBy',
      label: t('audit.pack.viewer.expertApproval', 'Expert approval'),
      value: pack.expertApprovedBy
        ? t('audit.pack.viewer.expertApproved', 'Approved')
        : t('audit.pack.viewer.expertPending', 'Not approved yet'),
    },
    {
      id: 'nextStep',
      label: t('audit.pack.viewer.nextStep', 'Next step'),
      value: nextStepValue || '—',
    },
    {
      id: 'updatedAt',
      label: t('audit.pack.viewer.updated', 'Updated'),
      value: formatListDate(pack.updatedAt),
      mono: true,
    },
  ];

  const rightPanelSections: ArtifactRightPanelSection[] = [
    {
      id: 'properties',
      label: t('audit.pack.viewer.properties', 'Properties'),
      defaultOpen: true,
      children: (
        <ArtifactPropertiesTable
          rows={propertyRows}
          propertyLabel={t('audit.pack.viewer.property', 'Property')}
          valueLabel={t('audit.pack.viewer.value', 'Value')}
        />
      ),
    },
    {
      id: 'relations',
      label: t('audit.pack.viewer.relations', 'Relations'),
      badge: programs.length,
      isEmpty: programs.length === 0 && !programsError,
      emptyLabel: t(
        'audit.pack.viewer.noPrograms',
        'No audit programs were started from this pack yet.'
      ),
      defaultOpen: false,
      children: programsError ? (
        <p
          data-testid="audit-pack-relations-error"
          className="text-xs text-c-danger"
          role="alert"
        >
          {programsError}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {programs.map((program) => (
            <li key={program.id} className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-xs text-c-text">
                <span className="block truncate">{program.name}</span>
                <span className="block text-[11px] text-c-text-muted tabular-nums">
                  {t('audit.pack.viewer.updated', 'Updated')} {formatListDate(program.updatedAt)}
                </span>
              </span>
              <StatusChip
                label={programLifecycleLabel(program.lifecycleState, isPolish)}
                tone="neutral"
              />
            </li>
          ))}
        </ul>
      ),
    },
  ];

  const sections: NModeSection[] = [
    {
      id: 'overview',
      icon: ClipboardList,
      label: { en: 'Overview', pl: 'Przegląd' },
      alwaysShow: true,
      component: (
        <div className="flex flex-col gap-4">
          <ArtifactPropertiesTable
            rows={overviewRows}
            propertyLabel={t('audit.pack.viewer.property', 'Property')}
            valueLabel={t('audit.pack.viewer.value', 'Value')}
          />
        </div>
      ),
    },
    {
      id: 'criteria',
      icon: ListChecks,
      label: { en: 'Criteria', pl: 'Kryteria' },
      badge: pack.criteria.length,
      alwaysShow: true,
      component: editingCriteria && canEditCriteria ? (
        <PackCriteriaEditor
          packId={pack.id}
          criteria={pack.criteria}
          onSaved={handleCriteriaSaved}
          onCancel={() => setEditingCriteria(false)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {canEditCriteria ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-c-text-secondary">
                {t(
                  'audit.pack.viewer.criteria.editHint',
                  'Saving replaces the whole criteria list in one request.'
                )}
              </p>
              <Button
                variant="secondary"
                size="sm"
                icon={<Pencil size={14} />}
                onClick={() => setEditingCriteria(true)}
                data-testid="pack-criteria-edit"
              >
                {t('audit.pack.viewer.criteria.edit', 'Edit criteria')}
              </Button>
            </div>
          ) : null}
          {!canEditCriteria && canManagePackLibrary ? (
            <p className="text-xs text-c-text-secondary" data-testid="pack-criteria-readonly">
              {t(
                'audit.pack.viewer.criteria.readOnly',
                'Criteria of a published pack are read-only.'
              )}
            </p>
          ) : null}
          <StandardTable
            columns={criteriaColumns}
            data={criteriaRows}
            rowDescription={() => null}
            minTableWidth="auto"
            persistKey="audits.method.pack.criteria"
            empty={{
              icon: ListChecks,
              title: t('audit.pack.viewer.noCriteria', 'No criteria in this pack'),
              description: t(
                'audit.pack.viewer.noCriteriaHint',
                'The pack has no criteria recorded yet.'
              ),
            }}
          />
        </div>
      ),
    },
    {
      id: 'taxonomy',
      icon: ShieldCheck,
      label: { en: 'Taxonomy', pl: 'Taksonomia' },
      badge: pack.findingTaxonomy.length,
      hasData: pack.findingTaxonomy.length > 0,
      component: pack.findingTaxonomy.length ? (
        <ul className="flex flex-col gap-2">
          {pack.findingTaxonomy.map((entry) => (
            <li
              key={entry.key}
              className="flex items-center justify-between gap-2 rounded-lg border border-c-border-subtle px-3 py-2"
            >
              <span className="min-w-0 text-xs text-c-text truncate">{entry.label}</span>
              <StatusChip
                label={
                  entry.nonConforming
                    ? t('audit.pack.viewer.nonConforming', 'Non-conforming')
                    : t('audit.pack.viewer.observation', 'Observation')
                }
                tone={entry.nonConforming ? 'warning' : 'neutral'}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          variant="new"
          icon={ShieldCheck}
          title={t('audit.pack.viewer.noTaxonomy', 'No finding taxonomy')}
          description={t(
            'audit.pack.viewer.noTaxonomyHint',
            'This pack does not define finding categories yet.'
          )}
        />
      ),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="audit-pack-object-page">
      <ArtifactBreadcrumb
        items={[
          { label: t('audit.pack.viewer.audits', 'Audits'), onClick: onBack },
          { label: t('audit.pack.viewer.library', 'Pack library'), onClick: onBack },
          { label: pack.title },
        ]}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        {transitionError ? (
          <div
            role="alert"
            className="shrink-0 px-6 pt-2"
            data-testid="audit-pack-transition-error"
          >
            <div className="rounded-lg border border-c-danger/30 bg-c-danger/5 px-3 py-2 text-xs text-c-danger">
              {transitionError}
            </div>
          </div>
        ) : null}
        <div className="min-h-0 flex-1">
          <NModeShell
            header={header}
            sections={sections}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            presentationMode="n"
            onPresentationModeChange={() => {}}
            showModeSwitcher={false}
            rightPanel={
              <ArtifactRightPanel
                sections={rightPanelSections}
                ariaLabel={t('audit.pack.viewer.panelAria', 'Audit pack panel')}
                className={ARTIFACT_PANEL_CARD_CLASS_DOCKED}
              />
            }
          />
        </div>
      </div>
    </div>
  );
};

export default AuditPackObjectPage;
