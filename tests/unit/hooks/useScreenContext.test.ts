import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useScreenContext } from '../../../hooks/useScreenContext';
import { useAIContext } from '../../../contexts/AIContext';

vi.mock('../../../contexts/AIContext');

describe('Hook Test: useScreenContext', () => {
    const mockSetScreenContext = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        (useAIContext as any).mockReturnValue({
            setScreenContext: mockSetScreenContext,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('sets screen context on mount after debounce', () => {
        const screenData = { test: 'data' };

        renderHook(() => useScreenContext('screen-1', 'Test Screen', screenData, 'Test description'));

        // Fast-forward debounce
        vi.advanceTimersByTime(300);

        expect(mockSetScreenContext).toHaveBeenCalledWith(expect.objectContaining({
            screenId: 'screen-1',
            version: '1.0',
            intent: 'Test description',
            data: expect.objectContaining({
                test: 'data',
                _meta: expect.objectContaining({
                    title: 'Test Screen',
                    description: 'Test description'
                })
            })
        }));
    });

    it('updates context when data changes', () => {
        const { rerender } = renderHook<any, { data: any }>(
            ({ data }) => useScreenContext('screen-1', 'Test', data),
            { initialProps: { data: { initial: 'data' } } }
        );

        vi.advanceTimersByTime(300);
        expect(mockSetScreenContext).toHaveBeenCalledTimes(1);

        rerender({ data: { updated: 'data' } });

        vi.advanceTimersByTime(300);
        expect(mockSetScreenContext).toHaveBeenCalledTimes(2);
    });
});

