/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EntryFooter } from '../../../components/Landing/EntryFooter';

describe('EntryFooter Component', () => {
    it('renders footer', () => {
        render(<EntryFooter />);

        expect(screen.getByRole('contentinfo') || screen.getByText(/Footer/i)).toBeInTheDocument();
    });

    it('displays links', () => {
        render(<EntryFooter />);

        expect(screen.getByText(/Privacy/i) || screen.getByText(/Terms/i) || screen.getByText(/Contact/i)).toBeInTheDocument();
    });
});








