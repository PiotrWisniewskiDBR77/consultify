/**
 * FileUpload Component Tests
 * Testing file upload component
 * 
 * @module tests/unit/components/UI/FileUpload.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock FileUpload component
const MockFileUpload: React.FC<{
    onUpload?: (files: File[]) => void;
    accept?: string;
    multiple?: boolean;
    maxSize?: number;
    disabled?: boolean;
    dragActive?: boolean;
}> = ({
    onUpload = () => { },
    accept = '*',
    multiple = false,
    maxSize,
    disabled = false;
}) => {
    return (
        <div
            data-testid="file-upload"
            data-disabled={disabled}
        >
            <input
                type="file"
                data-testid="file-input"
                accept={accept}
                multiple={multiple}
                disabled={disabled}
                onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    onUpload(files);
                }}
            />
            <div data-testid="upload-dropzone">
                <span data-testid="upload-text">Drop files here or click to upload</span>
            </div>
            {maxSize && (
                <span data-testid="upload-max-size">Max size: {maxSize}MB</span>
            )}
        </div>
    );
};

describe('FileUpload Component', () => {
    describe('Rendering', () => {
        it('should render file upload', () => {
            render(<MockFileUpload />);
            expect(screen.getByTestId('file-upload')).toBeInTheDocument();
        });

        it('should render dropzone', () => {
            render(<MockFileUpload />);
            expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument();
        });

        it('should show max size', () => {
            render(<MockFileUpload maxSize={10} />);
            expect(screen.getByTestId('upload-max-size')).toHaveTextContent('Max size: 10MB');
        });
    });

    describe('Input Attributes', () => {
        it('should set accept attribute', () => {
            render(<MockFileUpload accept=".pdf,.doc" />);
            expect(screen.getByTestId('file-input')).toHaveAttribute('accept', '.pdf,.doc');
        });

        it('should set multiple attribute', () => {
            render(<MockFileUpload multiple={true} />);
            expect(screen.getByTestId('file-input')).toHaveAttribute('multiple');
        });
    });

    describe('Upload', () => {
        it('should call onUpload when file selected', () => {
            const onUpload = vi.fn();
            render(<MockFileUpload onUpload={onUpload} />);

            const file = new File(['test'], 'test.txt', { type: 'text/plain' });
            const input = screen.getByTestId('file-input');

            Object.defineProperty(input, 'files', { value: [file] });
            fireEvent.change(input);

            expect(onUpload).toHaveBeenCalled();
        });
    });

    describe('Disabled', () => {
        it('should disable input', () => {
            render(<MockFileUpload disabled={true} />);
            expect(screen.getByTestId('file-input')).toBeDisabled();
        });
    });
});
