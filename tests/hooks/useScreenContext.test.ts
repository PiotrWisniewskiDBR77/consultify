import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useScreenContext } from '../../hooks/useScreenContext';
import { useAIContext } from '../../contexts/AIContext';

vi.mock('../../contexts/AIContext');

describe('Hook Test: useScreenContext', () => {
    const mockSetScreenContext = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useAIContext as any).mockReturnValue({
            setScreenContext: mockSetScreenContext,
        });
    });

    it('sets screen context on mount', () => {
        const screenData = { test: 'data' };

        renderHook(() => useScreenContext('screen-1', 'Test Screen', screenData, 'Test description'));

        expect(mockSetScreenContext).toHaveBeenCalledWith({
            screenId: 'screen-1',
            title: 'Test Screen',
            data: screenData,
            description: 'Test description',
        });
    });

    it('updates context when data changes', () => {
        const { rerender } = renderHook<any, { data: any }>(
            ({ data }) => useScreenContext('screen-1', 'Test', data),
            { initialProps: { data: { initial: 'data' } } }
        );

        expect(mockSetScreenContext).toHaveBeenCalledTimes(1);

        rerender({ data: { updated: 'data' } });

        expect(mockSetScreenContext).toHaveBeenCalledTimes(2);
    });

    it('handles optional description', () => {
        renderHook(() => useScreenContext('screen-1', 'Test', { data: 'test' }));

        expect(mockSetScreenContext).toHaveBeenCalledWith(
            expect.objectContaining({
                screenId: 'screen-1',
                title: 'Test',
                data: { data: 'test' },
            })
        );
    });
});

