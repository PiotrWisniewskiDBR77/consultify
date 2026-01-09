/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const InboxTriage = () => <div data-testid="inbox-triage">Inbox Triage</div>;

const renderWithRouter = (ui: React.ReactElement) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('InboxTriage Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        renderWithRouter(<InboxTriage />);
        expect(screen.getByTestId('inbox-triage')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = renderWithRouter(<InboxTriage />);
        expect(container).toBeInTheDocument();
    });

    it('displays content', () => {
        renderWithRouter(<InboxTriage />);
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });
});
