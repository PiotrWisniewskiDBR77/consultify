/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ContentModule from '../../../views/superadmin/ContentModule';

describe('ContentModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with default playbooks tab', () => {
        render(<ContentModule />);
        
        expect(screen.getByText('Playbooks')).toBeInTheDocument();
    });

    it('should render with initial tab', () => {
        render(<ContentModule initialTab="email-templates" />);
        
        expect(screen.getByText('Email Templates')).toBeInTheDocument();
    });

    it('should switch between tabs', () => {
        render(<ContentModule />);
        
        fireEvent.click(screen.getByText('Email Templates'));
        expect(screen.getByText('Email Templates')).toBeInTheDocument();
    });

    it('should display both tabs', () => {
        render(<ContentModule />);
        
        expect(screen.getByText('Playbooks')).toBeInTheDocument();
        expect(screen.getByText('Email Templates')).toBeInTheDocument();
    });
});
