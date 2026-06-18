/**
 * TeamSection - Owner, Sponsor assignments
 */

import { Target, User, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const TeamSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { t } = useTranslation();
  const {
    users,
    ownerId,
    setOwnerId,
    sponsorId,
    setSponsorId,
    ownerName,
    sponsorName,
    canEditOwner,
  } = useInitiativeContext();

  return (
    <CollapsibleSection
      id="team"
      title={t('initiatives.teamSection.team')}
      icon={<Users size={18} className="text-indigo-500 dark:text-indigo-400" />}
      iconBg="bg-gradient-to-br from-crimson-500/10 to-primary-500/10 dark:from-crimson-500/20 dark:to-primary-500/20"
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        {/* Owner */}
        <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/50 dark:border-navy-700/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <User size={14} className="text-blue-500" />
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                {t('initiatives.teamSection.owner')}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            {t('initiatives.teamSection.ownerDescription')}
          </p>
          <select
            id="initiative-team-owner"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            disabled={!canEditOwner}
            title={!canEditOwner ? t('initiatives.teamSection.cannotEditOwner') : undefined}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-400"
          >
            <option value="">{t('initiatives.teamSection.selectOwner')}</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName}
              </option>
            ))}
          </select>
        </div>
        {/* Sponsor */}
        <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/50 dark:border-navy-700/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary-500/10">
                <Target size={14} className="text-primary-500" />
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                Sponsor
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            {t('initiatives.teamSection.sponsorDescription')}
          </p>
          <select
            id="initiative-team-sponsor"
            value={sponsorId}
            onChange={(e) => setSponsorId(e.target.value)}
            disabled={!canEditOwner}
            title={!canEditOwner ? t('initiatives.teamSection.cannotEditSponsor') : undefined}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-400"
          >
            <option value="">{t('initiatives.teamSection.selectSponsor')}</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName}
              </option>
            ))}
          </select>
        </div>
        {/* Summary */}
        {(ownerName || sponsorName) && (
          <div className="pt-3 border-t border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-4 text-xs">
              {ownerName && (
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <User size={12} className="text-blue-500" />
                  </div>
                  <span className="text-slate-600 dark:text-slate-400">{ownerName}</span>
                </div>
              )}
              {sponsorName && (
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center">
                    <Target size={12} className="text-primary-500" />
                  </div>
                  <span className="text-slate-600 dark:text-slate-400">{sponsorName}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};
