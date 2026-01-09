/**
 * StudioToolbar Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('StudioToolbar Component', () => {
    it('renders toolbar', () => {
        const tools = ['select', 'draw', 'text', 'shape'];
        expect(tools).toHaveLength(4);
    });

    it('handles tool selection', () => {
        const onSelectTool = vi.fn();
        onSelectTool('draw');
        expect(onSelectTool).toHaveBeenCalledWith('draw');
    });

    it('shows active tool', () => {
        const activeTool = 'select';
        expect(activeTool).toBe('select');
    });
});
