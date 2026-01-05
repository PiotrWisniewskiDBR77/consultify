import { Briefcase, Building, Check, ChevronDown, Crown, Eye, HelpCircle, Shield, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * PMO Role Selector Component
 *
 * Dropdown selector for PMO roles with hierarchy and descriptions.
 * Shows PRINCE2/PMBOK mapping for each role.
 *
 * Part of Work Dimensions System
 */

interface PMORole {
    id: string;
    code: string;
    name: string;
    namePl: string;
    level: number;
    levelName: string;
    standards: {
        prince2: string;
        pmbok: string;
        iso21500: string;
    };
    description: string;
    descriptionPl: string;
    isRequired: boolean;
}

interface PMORoleSelectorProps {
    value: string;
    onChange: (roleId: string) => void;
    roles?: PMORole[];
    disabled?: boolean;
    showDescription?: boolean;
    placeholder?: string;
    className?: string;
}

const LEVEL_ICONS: Record<number, React.ReactNode> = {
    0: <Crown className="h-4 w-4 text-amber-500" />,
    1: <Briefcase className="h-4 w-4 text-blue-500" />,
    2: <Shield className="h-4 w-4 text-purple-500" />,
    3: <Users className="h-4 w-4 text-green-500" />,
    4: <Eye className="h-4 w-4 text-gray-500" />,
};

const LEVEL_NAMES: Record<number, { en: string; pl: string }> = {
    0: { en: 'Executive', pl: 'Zarząd' },
    1: { en: 'Manager', pl: 'Menedżer' },
    2: { en: 'Lead', pl: 'Lider' },
    3: { en: 'Member', pl: 'Członek' },
    4: { en: 'Stakeholder', pl: 'Interesariusz' },
};

export const PMORoleSelector: React.FC<PMORoleSelectorProps> = ({
    value,
    onChange,
    roles: providedRoles,
    disabled = false,
    showDescription = true,
    placeholder,
    className = '',
}) => {
    const { t, i18n } = useTranslation();
    const isPl = i18n.language === 'pl';

    const [isOpen, setIsOpen] = useState(false);
    const [roles, setRoles] = useState<PMORole[]>(providedRoles || []);
    const [isLoading, setIsLoading] = useState(!providedRoles);
    const [hoveredRole, setHoveredRole] = useState<PMORole | null>(null);

    useEffect(() => {
        if (!providedRoles) {
            fetchRoles();
        }
    }, [providedRoles]);

    const fetchRoles = async () => {
        try {
            const res = await fetch('/api/pmo-roles', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (res.ok) {
                const data = await res.json();
                setRoles(data);
            }
        } catch (err) {
            console.error('Failed to fetch PMO roles:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const selectedRole = roles.find((r) => r.id === value);

    const rolesByLevel = roles.reduce(
        (acc, role) => {
            const level = role.level;
            if (!acc[level]) acc[level] = [];
            acc[level].push(role);
            return acc;
        },
        {} as Record<number, PMORole[]>,
    );

    const handleSelect = (roleId: string) => {
        onChange(roleId);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
          w-full flex items-center justify-between px-3 py-2 text-left
          border border-gray-300 dark:border-gray-600 rounded-md
          bg-white dark:bg-gray-700 text-gray-900 dark:text-white
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-500 cursor-pointer'}
          focus:outline-none focus:ring-2 focus:ring-blue-500
        `}
            >
                {isLoading ? (
                    <span className="text-gray-400">{t('common.loading', 'Loading...')}</span>
                ) : selectedRole ? (
                    <div className="flex items-center gap-2">
                        {LEVEL_ICONS[selectedRole.level]}
                        <span>{isPl ? selectedRole.namePl : selectedRole.name}</span>
                        {selectedRole.isRequired && (
                            <span className="text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                                {t('admin.pmoRoles.required', 'Required')}
                            </span>
                        )}
                    </div>
                ) : (
                    <span className="text-gray-400">
                        {placeholder || t('admin.pmoRoles.selectRole', 'Select PMO Role')}
                    </span>
                )}
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                    <div className="flex">
                        {/* Role List */}
                        <div className="flex-1 max-h-80 overflow-y-auto">
                            {Object.entries(rolesByLevel)
                                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                .map(([level, levelRoles]) => (
                                    <div key={level}>
                                        {/* Level Header */}
                                        <div className="sticky top-0 px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                {LEVEL_ICONS[parseInt(level)]}
                                                {isPl
                                                    ? LEVEL_NAMES[parseInt(level)]?.pl
                                                    : LEVEL_NAMES[parseInt(level)]?.en}
                                            </div>
                                        </div>

                                        {/* Level Roles */}
                                        {levelRoles.map((role) => (
                                            <button
                                                key={role.id}
                                                type="button"
                                                onClick={() => handleSelect(role.id)}
                                                onMouseEnter={() => setHoveredRole(role)}
                                                onMouseLeave={() => setHoveredRole(null)}
                                                className={`
                          w-full flex items-center justify-between px-3 py-2 text-left
                          ${
                              value === role.id
                                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }
                        `}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {LEVEL_ICONS[role.level]}
                                                    <span className="text-sm text-gray-900 dark:text-white">
                                                        {isPl ? role.namePl : role.name}
                                                    </span>
                                                    {role.isRequired && (
                                                        <span className="text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                                                            *
                                                        </span>
                                                    )}
                                                </div>
                                                {value === role.id && <Check className="h-4 w-4 text-blue-600" />}
                                            </button>
                                        ))}
                                    </div>
                                ))}
                        </div>

                        {/* Description Panel */}
                        {showDescription && hoveredRole && (
                            <div className="w-64 p-4 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                                    {isPl ? hoveredRole.namePl : hoveredRole.name}
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    {isPl ? hoveredRole.descriptionPl : hoveredRole.description}
                                </p>

                                {/* Standards Mapping */}
                                <div className="space-y-2">
                                    {hoveredRole.standards?.prince2 && (
                                        <div className="flex items-start gap-2 text-xs">
                                            <span className="font-medium text-gray-500 dark:text-gray-400 min-w-[60px]">
                                                PRINCE2:
                                            </span>
                                            <span className="text-gray-700 dark:text-gray-300">
                                                {hoveredRole.standards.prince2}
                                            </span>
                                        </div>
                                    )}
                                    {hoveredRole.standards?.pmbok && (
                                        <div className="flex items-start gap-2 text-xs">
                                            <span className="font-medium text-gray-500 dark:text-gray-400 min-w-[60px]">
                                                PMBOK:
                                            </span>
                                            <span className="text-gray-700 dark:text-gray-300">
                                                {hoveredRole.standards.pmbok}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Click outside handler */}
            {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
        </div>
    );
};

export default PMORoleSelector;
