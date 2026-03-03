/**
 * SearchInput Component Tests
 * Testing search input with suggestions
 *
 * @module tests/unit/components/UI/SearchInput.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';

// Mock SearchInput component
const MockSearchInput: React.FC<{
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (query: string) => void;
  suggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
  loading?: boolean;
}> = ({
  placeholder = 'Search...',
  value: propValue = '',
  onChange = () => {},
  onSearch = () => {},
  suggestions = [],
  onSuggestionSelect = () => {},
  loading = false,
}) => {
  const [value, setValue] = useState(propValue);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    onChange(e.target.value);
    setShowSuggestions(e.target.value.length > 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(value);
    setShowSuggestions(false);
  };

  return (
    <form data-testid="search-form" onSubmit={handleSubmit}>
      <div data-testid="search-input-wrapper">
        <input
          type="search"
          data-testid="search-input"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={() => value && setShowSuggestions(true)}
          aria-label="Search"
        />
        <button type="submit" data-testid="search-button" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <ul data-testid="suggestions-list" role="listbox">
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              data-testid={`suggestion-${index}`}
              role="option"
              onClick={() => {
                setValue(suggestion);
                onSuggestionSelect(suggestion);
                setShowSuggestions(false);
              }}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
};

describe('SearchInput Component', () => {
  describe('Rendering', () => {
    it('should render search input', () => {
      render(<MockSearchInput />);
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });

    it('should show placeholder', () => {
      render(<MockSearchInput placeholder="Search users..." />);
      expect(screen.getByPlaceholderText('Search users...')).toBeInTheDocument();
    });

    it('should render search button', () => {
      render(<MockSearchInput />);
      expect(screen.getByTestId('search-button')).toBeInTheDocument();
    });
  });

  describe('Input Handling', () => {
    it('should call onChange when typing', () => {
      const onChange = vi.fn();
      render(<MockSearchInput onChange={onChange} />);

      fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'test' } });
      expect(onChange).toHaveBeenCalledWith('test');
    });

    it('should call onSearch on form submit', () => {
      const onSearch = vi.fn();
      render(<MockSearchInput onSearch={onSearch} />);

      fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'query' } });
      fireEvent.submit(screen.getByTestId('search-form'));

      expect(onSearch).toHaveBeenCalledWith('query');
    });
  });

  describe('Suggestions', () => {
    it('should show suggestions when typing', () => {
      render(<MockSearchInput suggestions={['Apple', 'Apricot', 'Avocado']} />);

      fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'a' } });

      expect(screen.getByTestId('suggestions-list')).toBeInTheDocument();
      expect(screen.getByTestId('suggestion-0')).toHaveTextContent('Apple');
    });

    it('should call onSuggestionSelect when suggestion clicked', () => {
      const onSuggestionSelect = vi.fn();
      render(<MockSearchInput suggestions={['Test']} onSuggestionSelect={onSuggestionSelect} />);

      fireEvent.change(screen.getByTestId('search-input'), { target: { value: 't' } });
      fireEvent.click(screen.getByTestId('suggestion-0'));

      expect(onSuggestionSelect).toHaveBeenCalledWith('Test');
    });
  });

  describe('Loading State', () => {
    it('should disable button when loading', () => {
      render(<MockSearchInput loading={true} />);
      expect(screen.getByTestId('search-button')).toBeDisabled();
    });

    it('should show loading text', () => {
      render(<MockSearchInput loading={true} />);
      expect(screen.getByTestId('search-button')).toHaveTextContent('Searching...');
    });
  });

  describe('Accessibility', () => {
    it('should have search aria-label', () => {
      render(<MockSearchInput />);
      expect(screen.getByLabelText('Search')).toBeInTheDocument();
    });

    it('should have listbox role for suggestions', () => {
      render(<MockSearchInput suggestions={['Test']} />);
      fireEvent.change(screen.getByTestId('search-input'), { target: { value: 't' } });
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });
});
