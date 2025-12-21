/**
 * OrgSwitcher - Component for switching between organizations
 * 
 * Features:
 * - Dropdown showing available orgs
 * - Visual indicator for current org
 * - Role badges (OWNER, ADMIN, MEMBER, CONSULTANT)
 * - Loading states
 */

import React, { useState, useRef, useEffect } from 'react';
import { useOrgContext, Organization } from '../contexts/OrgContext';
import { useTranslation } from 'react-i18next';

interface OrgSwitcherProps {
    className?: string;
    compact?: boolean;
}

const getRoleBadgeColor = (role: string): string => {
    switch (role) {
        case 'OWNER':
            return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
        case 'ADMIN':
            return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
        case 'MEMBER':
            return 'bg-green-500/20 text-green-300 border-green-500/30';
        case 'CONSULTANT':
            return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
        default:
            return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
};

const OrgSwitcher: React.FC<OrgSwitcherProps> = ({ className = '', compact = false }) => {
    const { t } = useTranslation();
    const { currentOrg, availableOrgs, isLoading, switchOrg } = useOrgContext();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Don't show if only one org
    if (!isLoading && availableOrgs.length <= 1) {
        if (compact) return null;
        return (
            <div className={`px-3 py-2 text-sm text-slate-400 ${className}`}>
                {currentOrg?.name || t('common.noOrganization', 'No organization')}
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className={`px-3 py-2 ${className}`}>
                <div className="animate-pulse bg-slate-700 h-6 w-32 rounded"></div>
            </div>
        );
    }

    const handleSelect = (org: Organization) => {
        switchOrg(org.id);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 transition-colors w-full"
            >
                <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-slate-200 truncate">
                        {currentOrg?.name || t('common.selectOrganization', 'Select Organization')}
                    </div>
                    {!compact && currentOrg && (
                        <div className="text-xs text-slate-400">
                            {currentOrg.access_type === 'CONSULTANT' ? t('common.consultantAccess', 'Consultant Access') : currentOrg.role}
                        </div>
                    )}
                </div>
                <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                        {availableOrgs.map((org) => (
                            <button
                                key={org.id}
                                onClick={() => handleSelect(org)}
                                className={`w-full px-3 py-2 text-left hover:bg-slate-700/50 transition-colors flex items-center gap-2
                                    ${org.id === currentOrg?.id ? 'bg-slate-700/30' : ''}`}
                            >
                                {/* Checkmark for current */}
                                <div className="w-4 flex-shrink-0">
                                    {org.id === currentOrg?.id && (
                                        <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>

                                {/* Org info */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-200 truncate">
                                        {org.name}
                                    </div>
                                </div>

                                {/* Role badge */}
                                <span className={`text-xs px-1.5 py-0.5 rounded border ${getRoleBadgeColor(org.role)}`}>
                                    {org.access_type === 'CONSULTANT' ? 'C' : org.role.charAt(0)}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrgSwitcher;
