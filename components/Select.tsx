import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
}

interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    label?: string;
    className?: string;
    disabled?: boolean;
}

export const Select: React.FC<SelectProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    label,
    className = '',
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && (
                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">
                    {label}
                </label>
            )}

            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between
                    bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg p-2.5
                    text-sm text-left transition-colors duration-200
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-500/50 hover:bg-slate-50 dark:hover:bg-navy-800'}
                    ${isOpen ? 'border-blue-500 ring-1 ring-blue-500/20' : ''}
                `}
                disabled={disabled}
            >
                <div className="flex items-center gap-2 truncate">
                    {selectedOption?.icon}
                    <span className={selectedOption ? 'text-navy-900 dark:text-white' : 'text-slate-500'}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>
                <ChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto">
                    {options.length > 0 ? (
                        <div className="py-1">
                            {options.map((option) => {
                                const isSelected = option.value === value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleSelect(option.value)}
                                        className={`
                                            w-full flex items-center justify-between px-3 py-2 text-sm
                                            transition-colors text-left
                                            ${isSelected
                                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-navy-900 dark:hover:text-white'}
                                        `}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            {option.icon}
                                            <span>{option.label}</span>
                                        </div>
                                        {isSelected && <Check size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-3 text-center text-xs text-slate-500">
                            No options available
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
