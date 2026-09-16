/**
 * CreateOrganizationModal — wspólny modal „Create Organization".
 *
 * K-21b (FEEDBACK-1, zgłoszenie testera Tomka #61 „nie da się utworzyć
 * organizacji"): modal był ciałem `OrganizationSettings.tsx`, a ten komponent
 * NIE MA w produkcie ani jednego importera (Ustawienia nie mają sekcji
 * „organization" — patrz `SettingsSidebar.SettingsSection`). Naprawa z K-21
 * (przycisk poza gałęzią zero-org + bramka roli) nie była więc dla nikogo
 * widoczna. Modal jest tu WYCIĄGNIĘTY, żeby to samo wejście dało się osadzić w
 * realnej powłoce produktu — przełączniku organizacji w `UserProfileMenu`
 * (nagłówek `MainLayout`, jedyne miejsce w produkcie, gdzie użytkownik widzi
 * listę swoich organizacji i między nimi przełącza) — bez fabrykowania drugiej
 * listy organizacji.
 *
 * Bramka roli zostaje po stronie WOŁAJĄCEGO (serwer wymaga ADMIN/OWNER/
 * SUPERADMIN na POST /api/organizations).
 */

import { Building2, Loader2, X } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface CreateOrganizationModalProps {
  open: boolean;
  onClose: () => void;
  /** Wywoływane po udanym utworzeniu (np. odświeżenie listy organizacji). */
  onCreated?: () => void | Promise<void>;
}

export const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const { t } = useTranslation();
  const [newOrgName, setNewOrgName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  const handleCreateOrganization = async () => {
    // T-VIII (tester Tomek, 2026-09-13): przycisk był wyłączany przez
    // `disabled={creatingOrg}`, ale wciśnięcie Enter w polu nazwy omijało tę
    // blokadę — sam handler nie sprawdzał niczego, więc każde kolejne Enter
    // wysyłało kolejne żądanie i fabrykowało bliźniaczą organizację.
    // Blokada musi siedzieć W HANDLERZE, nie tylko w atrybucie przycisku.
    if (creatingOrg) return;
    if (!newOrgName.trim()) {
      toast.error(t('settings.organization.nameRequired', 'Organization name is required'));
      return;
    }
    setCreatingOrg(true);
    try {
      await Api.createOrganization(newOrgName.trim());
      toast.success(
        t('settings.organization.createdSuccess', 'Organization created successfully!')
      );
      setNewOrgName('');
      onClose();
      await onCreated?.();
    } catch (error: any) {
      // Serwer odsyła sam KOD (bramka językowa J0) — zdanie dla człowieka
      // składa ekran, więc tester widzi komunikat w swoim języku zamiast
      // surowego ORGANIZATION_NAME_DUPLICATE.
      const code = String(error?.code || error?.message || '');
      if (code.includes('ORGANIZATION_NAME_DUPLICATE')) {
        toast.error(
          t(
            'settings.organization.duplicateName',
            'You already have an organization with this name.'
          )
        );
      } else {
        toast.error(error?.message || 'Failed to create organization');
      }
    } finally {
      setCreatingOrg(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={t('settings.organization.createOrgModalTitle', 'Create Organization')}
      data-testid="create-organization-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-c-surface rounded-xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-c-text flex items-center gap-2">
            <Building2 size={20} className="text-c-text-secondary" />
            {t('settings.organization.createOrgModalTitle', 'Create Organization')}
          </h3>
          <button
            onClick={onClose}
            aria-label={t('settings.organization.cancel', 'Cancel')}
            className="p-2 rounded-lg hover:bg-c-surface-raised text-c-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="create-organization-name"
              className="block text-sm font-medium text-c-text-secondary mb-2"
            >
              {t('settings.organization.orgNameLabel', 'Organization Name')}
            </label>
            <input
              id="create-organization-name"
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder={t('settings.organization.orgNamePlaceholder', 'e.g., Acme Corporation')}
              className="w-full px-4 py-3 bg-c-surface-raised border border-c-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)] text-c-text"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreateOrganization();
              }}
              autoFocus
            />
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised rounded-lg font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
            >
              {t('settings.organization.cancel', 'Cancel')}
            </button>
            <button
              onClick={() => void handleCreateOrganization()}
              disabled={creatingOrg || !newOrgName.trim()}
              className="px-6 py-2 bg-c-text hover:bg-c-text text-c-surface rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
            >
              {creatingOrg && <Loader2 size={16} className="animate-spin" />}
              {creatingOrg
                ? t('settings.organization.creating', 'Creating...')
                : t('settings.organization.createOrgModalTitle', 'Create Organization')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateOrganizationModal;
