/**
 * NewAuditModal — "Nowy audyt" primary CTA target for `AuditsMethodHub`'s
 * `StandardModuleBar` (expert panel gap pack, 2026-08-26, item 3/audits
 * fixes: the bar had zero action buttons, violating TRIADA_KANON.md:17 and
 * the acceptance checklist point 2).
 *
 * Deliberately thin: picks one eligible pack from the library (same
 * `evaluateStartGate` rule as the per-row "Rozpocznij audyt" action in
 * `AuditLibraryTab` — published + has a source) and hands off to the hub's
 * existing `onStartAudit`, which already calls the REAL, canonical
 * `createProgram` (`auditsMethodApi.ts:453`) with an idempotency key and a
 * readback check. No second code path to `/audits/programs` — this modal
 * only supplies the missing pack picker in front of the proven flow.
 *
 * Behind `ff_auditsScaleAndPolish` (default OFF) — see
 * `AuditsMethodHub.tsx`.
 */
import { FileWarning } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/primitives/Button';
import { Modal } from '@/components/ui/primitives/Modal';

import type { AuditPackSummary } from './auditsMethodApi';
import { evaluateStartGate } from './tabs/AuditLibraryTab';

interface NewAuditModalProps {
  open: boolean;
  onClose: () => void;
  packs: AuditPackSummary[];
  isPolish: boolean;
  onStartAudit: (pack: AuditPackSummary) => void;
  starting: boolean;
}

export const NewAuditModal: React.FC<NewAuditModalProps> = ({
  open,
  onClose,
  packs,
  isPolish,
  onStartAudit,
  starting,
}) => {
  const { t } = useTranslation();
  const eligiblePacks = useMemo(
    () => packs.filter((p) => evaluateStartGate(p, isPolish).allowed),
    [packs, isPolish]
  );
  const [selectedPackId, setSelectedPackId] = useState<string>('');

  const effectiveSelectedId = selectedPackId || eligiblePacks[0]?.id || '';
  const selectedPack = eligiblePacks.find((p) => p.id === effectiveSelectedId) ?? null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('audits.method.newAudit.title', isPolish ? 'Nowy audyt' : 'New audit')}
      description={t(
        'audits.method.newAudit.description',
        isPolish
          ? 'Wybierz opublikowany pakiet, aby utworzyć nowy program audytowy.'
          : 'Pick a published pack to create a new audit program.'
      )}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={starting}>
            {t('common.cancel', isPolish ? 'Anuluj' : 'Cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!selectedPack || starting}
            loading={starting}
            onClick={() => selectedPack && onStartAudit(selectedPack)}
            data-testid="new-audit-modal-submit"
          >
            {t('audits.method.newAudit.submit', isPolish ? 'Rozpocznij audyt' : 'Start audit')}
          </Button>
        </div>
      }
    >
      {eligiblePacks.length === 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-c-border-subtle bg-c-surface-muted p-3 text-sm text-c-text-muted">
          <FileWarning size={16} className="mt-0.5 flex-shrink-0" />
          <span>
            {t(
              'audits.method.newAudit.empty',
              isPolish
                ? 'Brak opublikowanych pakietów z przypisanym źródłem. Opublikuj pakiet w zakładce Biblioteka, aby rozpocząć audyt.'
                : 'No published packs with an assigned source. Publish a pack in the Library tab to start an audit.'
            )}
          </span>
        </div>
      ) : (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-c-text-primary">
            {t('audits.method.newAudit.packLabel', isPolish ? 'Pakiet audytowy' : 'Audit pack')}
          </span>
          <select
            className="h-9 w-full rounded-lg border border-c-border-subtle bg-c-surface px-3 text-sm text-c-text-primary focus:outline-none focus:ring-2 focus:ring-c-focus"
            value={effectiveSelectedId}
            onChange={(e) => setSelectedPackId(e.target.value)}
            data-testid="new-audit-modal-pack-select"
          >
            {eligiblePacks.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.title}
                {pack.version ? ` v${pack.version}` : ''}
              </option>
            ))}
          </select>
        </label>
      )}
    </Modal>
  );
};
