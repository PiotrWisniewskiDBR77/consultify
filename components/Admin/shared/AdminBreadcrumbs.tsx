/**
 * AdminBreadcrumbs - Breadcrumb navigation for admin module
 *
 * Features:
 * - Hierarchical path display
 * - Clickable navigation items
 * - Current page indicator
 * - Responsive (collapses on mobile)
 *
 * Design: Clean horizontal breadcrumb with chevron separators
 */

import { ChevronRight, Home, MoreHorizontal } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';

// Breadcrumb item
export interface BreadcrumbItem {
    id: string;
    label: string;
    href?: string;
    icon?: React.ElementType;
    onClick?: () => void;
}

interface AdminBreadcrumbsProps {
    items: BreadcrumbItem[];
    homeLabel?: string;
    onHomeClick?: () => void;
    maxVisibleItems?: number;
    className?: string;
}

export const AdminBreadcrumbs: React.FC<AdminBreadcrumbsProps> = ({
    items,
    homeLabel,
    onHomeClick,
    maxVisibleItems = 4,
    className,
}) => {
    const { t } = useTranslation();

    // Handle collapsing for long breadcrumbs
    const displayItems = useMemo(() => {
        if (items.length <= maxVisibleItems) {
            return { collapsed: false, items };
        }

        // Show first item, ellipsis, and last (maxVisibleItems - 2) items
        const first = items[0];
        const lastItems = items.slice(-(maxVisibleItems - 2));
        const hiddenItems = items.slice(1, items.length - (maxVisibleItems - 2));

        return {
            collapsed: true,
            items: [first, ...lastItems],
            hiddenItems,
        };
    }, [items, maxVisibleItems]);

    return (
        <nav aria-label="Breadcrumb" className={cn('flex items-center', className)}>
            <ol className="flex items-center gap-1 text-sm">
                {/* Home */}
                <li>
                    <button
                        onClick={onHomeClick}
                        className="flex items-center gap-1.5 px-2 py-1 text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-700 rounded-md transition-colors"
                    >
                        <Home size={14} />
                        {homeLabel && (
                            <span className="hidden sm:inline">
                                {homeLabel || t('admin.breadcrumbs.home', 'Admin')}
                            </span>
                        )}
                    </button>
                </li>

                {/* Separator after home */}
                {items.length > 0 && (
                    <li className="text-slate-300 dark:text-navy-600">
                        <ChevronRight size={14} />
                    </li>
                )}

                {/* Collapsed indicator */}
                {displayItems.collapsed && (
                    <>
                        {/* First item */}
                        <li>
                            <BreadcrumbButton item={displayItems.items[0]} />
                        </li>
                        <li className="text-slate-300 dark:text-navy-600">
                            <ChevronRight size={14} />
                        </li>

                        {/* Ellipsis */}
                        <li>
                            <div className="group relative">
                                <button className="flex items-center px-2 py-1 text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-700 rounded-md transition-colors">
                                    <MoreHorizontal size={14} />
                                </button>

                                {/* Dropdown for hidden items */}
                                <div className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[150px]">
                                    {displayItems.hiddenItems?.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={item.onClick}
                                            className="block w-full px-3 py-2 text-left text-sm text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-navy-700"
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </li>
                        <li className="text-slate-300 dark:text-navy-600">
                            <ChevronRight size={14} />
                        </li>

                        {/* Remaining items (excluding first) */}
                        {displayItems.items.slice(1).map((item, index) => (
                            <React.Fragment key={item.id}>
                                <li>
                                    <BreadcrumbButton
                                        item={item}
                                        isLast={index === displayItems.items.length - 2}
                                    />
                                </li>
                                {index < displayItems.items.length - 2 && (
                                    <li className="text-slate-300 dark:text-navy-600">
                                        <ChevronRight size={14} />
                                    </li>
                                )}
                            </React.Fragment>
                        ))}
                    </>
                )}

                {/* Non-collapsed items */}
                {!displayItems.collapsed &&
                    displayItems.items.map((item, index) => (
                        <React.Fragment key={item.id}>
                            <li>
                                <BreadcrumbButton
                                    item={item}
                                    isLast={index === displayItems.items.length - 1}
                                />
                            </li>
                            {index < displayItems.items.length - 1 && (
                                <li className="text-slate-300 dark:text-navy-600">
                                    <ChevronRight size={14} />
                                </li>
                            )}
                        </React.Fragment>
                    ))}
            </ol>
        </nav>
    );
};

// Individual breadcrumb button
const BreadcrumbButton: React.FC<{
    item: BreadcrumbItem;
    isLast?: boolean;
}> = ({ item, isLast }) => {
    const Icon = item.icon;

    if (isLast) {
        return (
            <span className="flex items-center gap-1.5 px-2 py-1 font-medium text-navy-900 dark:text-white">
                {Icon && <Icon size={14} />}
                {item.label}
            </span>
        );
    }

    return (
        <button
            onClick={item.onClick}
            className="flex items-center gap-1.5 px-2 py-1 text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-700 rounded-md transition-colors"
        >
            {Icon && <Icon size={14} />}
            {item.label}
        </button>
    );
};

export default AdminBreadcrumbs;

