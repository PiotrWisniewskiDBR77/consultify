/**
 * ReportSkeleton Component
 *
 * Loading skeleton for management reports.
 * Shows animated placeholders while report data is being fetched.
 *
 * PMO Standards: ISO 21500, PMBOK 7, PRINCE2
 */

import React from 'react';

interface ReportSkeletonProps {
    reportType?: 'TEAM_MEETING' | 'STEERING_COMMITTEE';
}

export const ReportSkeleton: React.FC<ReportSkeletonProps> = ({ reportType = 'TEAM_MEETING' }) => {
    const isSteeringCommittee = reportType === 'STEERING_COMMITTEE';

    return (
        <div className="animate-pulse space-y-6 p-6">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-72 bg-slate-200 dark:bg-navy-700 rounded-lg" />
                    <div className="h-4 w-48 bg-slate-200 dark:bg-navy-700 rounded" />
                </div>
                <div className="flex gap-2">
                    <div className="h-10 w-24 bg-slate-200 dark:bg-navy-700 rounded-lg" />
                    <div className="h-10 w-24 bg-slate-200 dark:bg-navy-700 rounded-lg" />
                </div>
            </div>

            {/* AI Narrative Skeleton */}
            <div className="h-32 bg-slate-200 dark:bg-navy-700 rounded-xl" />

            {/* Status Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 bg-slate-200 dark:bg-navy-700 rounded-xl" />
                ))}
            </div>

            {isSteeringCommittee ? (
                <>
                    {/* RAG Status Grid for Steering Committee */}
                    <div className="grid grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-20 bg-slate-200 dark:bg-navy-700 rounded-xl" />
                        ))}
                    </div>

                    {/* KPIs Section */}
                    <div className="space-y-3">
                        <div className="h-6 w-32 bg-slate-200 dark:bg-navy-700 rounded" />
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="h-28 bg-slate-200 dark:bg-navy-700 rounded-xl" />
                            ))}
                        </div>
                    </div>

                    {/* Risks Section */}
                    <div className="space-y-3">
                        <div className="h-6 w-40 bg-slate-200 dark:bg-navy-700 rounded" />
                        <div className="h-48 bg-slate-200 dark:bg-navy-700 rounded-xl" />
                    </div>

                    {/* Decisions Section */}
                    <div className="space-y-3">
                        <div className="h-6 w-36 bg-slate-200 dark:bg-navy-700 rounded" />
                        <div className="h-36 bg-slate-200 dark:bg-navy-700 rounded-xl" />
                    </div>
                </>
            ) : (
                <>
                    {/* Team Meeting Sections */}
                    {/* Completed Work */}
                    <div className="space-y-3">
                        <div className="h-6 w-40 bg-slate-200 dark:bg-navy-700 rounded" />
                        <div className="space-y-2">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-12 bg-slate-200 dark:bg-navy-700 rounded-lg" />
                            ))}
                        </div>
                    </div>

                    {/* Work in Progress */}
                    <div className="space-y-3">
                        <div className="h-6 w-36 bg-slate-200 dark:bg-navy-700 rounded" />
                        <div className="space-y-2">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-12 bg-slate-200 dark:bg-navy-700 rounded-lg" />
                            ))}
                        </div>
                    </div>

                    {/* Blockers */}
                    <div className="space-y-3">
                        <div className="h-6 w-28 bg-slate-200 dark:bg-navy-700 rounded" />
                        <div className="space-y-2">
                            {[1, 2].map((i) => (
                                <div key={i} className="h-16 bg-slate-200 dark:bg-navy-700 rounded-lg" />
                            ))}
                        </div>
                    </div>

                    {/* Next Period Plan */}
                    <div className="space-y-3">
                        <div className="h-6 w-44 bg-slate-200 dark:bg-navy-700 rounded" />
                        <div className="h-32 bg-slate-200 dark:bg-navy-700 rounded-xl" />
                    </div>
                </>
            )}

            {/* Footer Skeleton */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-navy-600">
                <div className="h-4 w-64 bg-slate-200 dark:bg-navy-700 rounded" />
                <div className="h-4 w-40 bg-slate-200 dark:bg-navy-700 rounded" />
            </div>
        </div>
    );
};

/**
 * Compact skeleton for inline loading states
 */
export const ReportSkeletonCompact: React.FC = () => (
    <div className="animate-pulse space-y-4 p-4">
        <div className="h-6 w-48 bg-slate-200 dark:bg-navy-700 rounded" />
        <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-slate-200 dark:bg-navy-700 rounded-lg" />
            ))}
        </div>
        <div className="h-24 bg-slate-200 dark:bg-navy-700 rounded-lg" />
    </div>
);

/**
 * Table row skeleton for report history
 */
export const ReportHistoryRowSkeleton: React.FC = () => (
    <tr className="animate-pulse">
        <td className="px-4 py-3">
            <div className="h-4 w-32 bg-slate-200 dark:bg-navy-700 rounded" />
        </td>
        <td className="px-4 py-3">
            <div className="h-4 w-24 bg-slate-200 dark:bg-navy-700 rounded" />
        </td>
        <td className="px-4 py-3">
            <div className="h-4 w-28 bg-slate-200 dark:bg-navy-700 rounded" />
        </td>
        <td className="px-4 py-3">
            <div className="h-6 w-16 bg-slate-200 dark:bg-navy-700 rounded-full" />
        </td>
        <td className="px-4 py-3">
            <div className="h-4 w-20 bg-slate-200 dark:bg-navy-700 rounded" />
        </td>
        <td className="px-4 py-3">
            <div className="flex gap-2">
                <div className="h-8 w-8 bg-slate-200 dark:bg-navy-700 rounded" />
                <div className="h-8 w-8 bg-slate-200 dark:bg-navy-700 rounded" />
            </div>
        </td>
    </tr>
);

export default ReportSkeleton;



