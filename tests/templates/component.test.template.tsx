/**
 * TEMPLATE: React Component Test
 * 
 * Ten plik służy jako szablon do tworzenia testów komponentów React.
 * Skopiuj i dostosuj do konkretnego komponentu.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

// Import component to test
import ComponentName from '@/components/path/ComponentName';

// Mock hooks
vi.mock('@/hooks/useCustomHook', () => ({
  useCustomHook: () => ({
    data: [],
    isLoading: false,
    error: null,
    mutate: vi.fn(),
  }),
}));

// Mock API service
vi.mock('@/services/api', () => ({
  apiService: {
    getData: vi.fn(),
    postData: vi.fn(),
  },
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// Test wrapper with providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {/* Add other providers as needed: QueryClientProvider, OrgContext, etc. */}
    {children}
  </BrowserRouter>
);

// Helper function for rendering with wrapper
const renderComponent = (props = {}) => {
  const defaultProps = {
    // Default props here
  };
  
  return render(
    <ComponentName {...defaultProps} {...props} />,
    { wrapper: TestWrapper }
  );
};

describe('ComponentName', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders without crashing', () => {
      renderComponent();
      expect(screen.getByTestId('component-name')).toBeInTheDocument();
    });

    it('displays correct title', () => {
      renderComponent({ title: 'Test Title' });
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('renders all required elements', () => {
      renderComponent();
      
      expect(screen.getByRole('heading')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading spinner when isLoading is true', () => {
      vi.mocked(useCustomHook).mockReturnValue({
        data: [],
        isLoading: true,
        error: null,
        mutate: vi.fn(),
      });

      renderComponent();
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    });

    it('hides loading spinner when data is loaded', () => {
      renderComponent();
      
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when error occurs', () => {
      vi.mocked(useCustomHook).mockReturnValue({
        data: [],
        isLoading: false,
        error: new Error('Failed to load data'),
        mutate: vi.fn(),
      });

      renderComponent();
      
      expect(screen.getByText(/failed to load data/i)).toBeInTheDocument();
    });

    it('shows retry button on error', () => {
      vi.mocked(useCustomHook).mockReturnValue({
        data: [],
        isLoading: false,
        error: new Error('Error'),
        mutate: vi.fn(),
      });

      renderComponent();
      
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state message when no data', () => {
      vi.mocked(useCustomHook).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        mutate: vi.fn(),
      });

      renderComponent();
      
      expect(screen.getByText(/no items found/i)).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('calls onSubmit when form is submitted', async () => {
      const mockOnSubmit = vi.fn();
      renderComponent({ onSubmit: mockOnSubmit });

      await user.type(screen.getByRole('textbox'), 'test input');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({ input: 'test input' });
      });
    });

    it('opens modal on button click', async () => {
      renderComponent();

      await user.click(screen.getByRole('button', { name: /open modal/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('closes modal when close button is clicked', async () => {
      renderComponent();

      await user.click(screen.getByRole('button', { name: /open modal/i }));
      
      const modal = screen.getByRole('dialog');
      const closeButton = within(modal).getByRole('button', { name: /close/i });
      
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('filters items when search input changes', async () => {
      const mockData = [
        { id: 1, name: 'Item One' },
        { id: 2, name: 'Item Two' },
        { id: 3, name: 'Different' },
      ];

      vi.mocked(useCustomHook).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        mutate: vi.fn(),
      });

      renderComponent();

      await user.type(screen.getByPlaceholderText(/search/i), 'Item');

      await waitFor(() => {
        expect(screen.getByText('Item One')).toBeInTheDocument();
        expect(screen.getByText('Item Two')).toBeInTheDocument();
        expect(screen.queryByText('Different')).not.toBeInTheDocument();
      });
    });
  });

  describe('keyboard navigation', () => {
    it('supports keyboard navigation with arrow keys', async () => {
      renderComponent();

      const firstItem = screen.getByTestId('item-0');
      firstItem.focus();

      await user.keyboard('{ArrowDown}');

      expect(screen.getByTestId('item-1')).toHaveFocus();
    });

    it('submits form on Enter key', async () => {
      const mockOnSubmit = vi.fn();
      renderComponent({ onSubmit: mockOnSubmit });

      await user.type(screen.getByRole('textbox'), 'test{Enter}');

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });

  describe('accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderComponent();
      
      // If using jest-axe:
      // const results = await axe(container);
      // expect(results).toHaveNoViolations();
      
      // Basic checks:
      expect(screen.getByRole('button')).toHaveAttribute('aria-label');
    });

    it('maintains focus on modal open/close', async () => {
      renderComponent();

      const openButton = screen.getByRole('button', { name: /open modal/i });
      await user.click(openButton);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveFocus();

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(openButton).toHaveFocus();
      });
    });
  });

  describe('props validation', () => {
    it('applies custom className', () => {
      renderComponent({ className: 'custom-class' });
      
      expect(screen.getByTestId('component-name')).toHaveClass('custom-class');
    });

    it('handles disabled state correctly', () => {
      renderComponent({ disabled: true });
      
      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByRole('textbox')).toBeDisabled();
    });
  });

  describe('data display', () => {
    it('renders list of items correctly', () => {
      const mockData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' },
      ];

      vi.mocked(useCustomHook).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        mutate: vi.fn(),
      });

      renderComponent();

      mockData.forEach((item) => {
        expect(screen.getByText(item.name)).toBeInTheDocument();
      });
    });

    it('formats dates correctly', () => {
      const mockData = [{ id: 1, date: '2024-12-27T10:00:00Z' }];

      vi.mocked(useCustomHook).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        mutate: vi.fn(),
      });

      renderComponent();

      expect(screen.getByText(/december 27, 2024/i)).toBeInTheDocument();
    });
  });
});










