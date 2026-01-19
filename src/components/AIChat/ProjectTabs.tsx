/**
 * ProjectTabs Component
 *
 * Tabbed navigation for Personal/Team project separation.
 * Similar to HelpSidePanel tabs design.
 */

import { User, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useChatProjectStore } from '../../store/useChatProjectStore';

interface ProjectTabsProps {
  className?: string;
}

const TABS = [
  { id: 'personal' as const, icon: User, labelKey: 'aiChat.projectTabs.personal' },
  { id: 'team' as const, icon: Users, labelKey: 'aiChat.projectTabs.team' },
];

export const ProjectTabs: React.FC<ProjectTabsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { activeTab, setActiveTab, counts } = useChatProjectStore();

  return (
    <div className={`flex border-b border-slate-200 dark:border-navy-700 ${className}`}>
      {TABS.map(({ id, icon: Icon, labelKey }) => {
        const isActive = activeTab === id;
        const count = counts[id] || 0;

        return (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`
              flex-1 flex items-center justify-center gap-1.5 py-2.5 
              text-xs font-medium border-b-2 transition-colors
              ${
                isActive
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }
            `}
          >
            <Icon size={14} />
            <span>{t(labelKey, id === 'personal' ? 'Moje' : 'Zespołu')}</span>
            {count > 0 && (
              <span
                className={`
                  ml-1 px-1.5 py-0.5 text-[10px] rounded-full
                  ${
                    isActive
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                      : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
                  }
                `}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ProjectTabs;
