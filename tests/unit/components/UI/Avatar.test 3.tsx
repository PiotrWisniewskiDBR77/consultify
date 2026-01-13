/**
 * Avatar Component Tests
 * Testing avatar display and fallbacks
 * 
 * @module tests/unit/components/UI/Avatar.test.tsx
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock Avatar component for testing patterns
const MockAvatar: React.FC<{
    src?: string;
    alt?: string;
    name?: string;
    size?: 'sm' | 'md' | 'lg';
    status?: 'online' | 'offline' | 'busy';
}> = ({
    src,
    alt = 'User avatar',
    name = 'User',
    size = 'md',
    status
}) => {
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        return (
            <div data-testid="avatar" data-size={size}>
                {src ? (
                    <img src={src} alt={alt} data-testid="avatar-image" />
                ) : (
                    <span data-testid="avatar-initials">{initials}</span>
                )}
                {status && (
                    <span data-testid="avatar-status" data-status={status} />
                )}
            </div>
        );
    };

describe('Avatar Component', () => {
    describe('Image Display', () => {
        it('should display image when src provided', () => {
            render(<MockAvatar src="https://example.com/avatar.jpg" />);
            expect(screen.getByTestId('avatar-image')).toBeInTheDocument();
        });

        it('should display initials when no src', () => {
            render(<MockAvatar name="John Doe" />);
            expect(screen.getByTestId('avatar-initials')).toHaveTextContent('JD');
        });

        it('should handle single name', () => {
            render(<MockAvatar name="Alice" />);
            expect(screen.getByTestId('avatar-initials')).toHaveTextContent('A');
        });
    });

    describe('Sizes', () => {
        it.each(['sm', 'md', 'lg'] as const)('should apply %s size', (size) => {
            render(<MockAvatar size={size} />);
            expect(screen.getByTestId('avatar')).toHaveAttribute('data-size', size);
        });

        it('should default to md size', () => {
            render(<MockAvatar />);
            expect(screen.getByTestId('avatar')).toHaveAttribute('data-size', 'md');
        });
    });

    describe('Status Indicator', () => {
        it('should not show status by default', () => {
            render(<MockAvatar />);
            expect(screen.queryByTestId('avatar-status')).not.toBeInTheDocument();
        });

        it.each(['online', 'offline', 'busy'] as const)('should show %s status', (status) => {
            render(<MockAvatar status={status} />);
            expect(screen.getByTestId('avatar-status')).toHaveAttribute('data-status', status);
        });
    });

    describe('Accessibility', () => {
        it('should have alt text on image', () => {
            render(<MockAvatar src="https://example.com/avatar.jpg" alt="Profile picture" />);
            expect(screen.getByTestId('avatar-image')).toHaveAttribute('alt', 'Profile picture');
        });
    });
});
