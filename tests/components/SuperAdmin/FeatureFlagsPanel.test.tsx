/**
 * Feature Flags Panel Tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { FeatureFlagsPanel } from '../../components/SuperAdmin/FeatureFlagsPanel';
import { Api } from '../../../services/api';

jest.mock('../../../services/api');

describe('FeatureFlagsPanel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render feature flags panel', async () => {
        (Api.getFeatureFlags as jest.Mock).mockResolvedValue([]);

        render(<FeatureFlagsPanel />);

        await waitFor(() => {
            expect(screen.getByText('Feature Flags')).toBeInTheDocument();
        });
    });

    test('should display feature flags list', async () => {
        const mockFlags = [
            {
                id: '1',
                flag_key: 'test_flag',
                name: 'Test Flag',
                enabled: true,
                flag_type: 'boolean',
                environment: 'production'
            }
        ];

        (Api.getFeatureFlags as jest.Mock).mockResolvedValue(mockFlags);

        render(<FeatureFlagsPanel />);

        await waitFor(() => {
            expect(screen.getByText('Test Flag')).toBeInTheDocument();
        });
    });
});








