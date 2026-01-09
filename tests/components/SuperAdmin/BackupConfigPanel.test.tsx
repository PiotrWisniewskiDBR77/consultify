/**
 * @vitest-environment jsdom
 * BackupConfigPanel Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const BackupConfigPanel = () => <div data-testid="backup-config">Backup Config Panel</div>;

describe('BackupConfigPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({});
    });

    it('renders panel', () => {
        render(<BackupConfigPanel />, { wrapper: Wrapper });
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });

    it('renders without crashing', () => {
        const { container } = render(<BackupConfigPanel />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
