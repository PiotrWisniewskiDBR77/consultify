import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LoadingScreen } from '../../components/LoadingScreen';

describe('Component Test: LoadingScreen', () => {
    it('renders loading spinner', () => {
        render(<LoadingScreen />);
        const spinner = screen.getByRole('status', { hidden: true }) || document.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
    });

    it('has correct styling classes', () => {
        const { container } = render(<LoadingScreen />);
        const mainDiv = container.firstChild as HTMLElement;
        expect(mainDiv).toHaveClass('flex', 'items-center', 'justify-center', 'min-h-screen');
    });
});

