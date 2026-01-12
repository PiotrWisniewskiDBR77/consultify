/**
 * Full Reports View
 * Main entry point for Management Reports module
 *
 * PMO Standards: ISO 21500, PMBOK 7, PRINCE2
 */

import React from 'react';

import { ManagementReportsView } from '../components/Reports/Management/ManagementReportsView';
import { SplitLayout } from '../components/SplitLayout';

export const FullReportsView: React.FC = () => {
    return (
        <SplitLayout title="Management Reports">
            <ManagementReportsView />
        </SplitLayout>
    );
};
