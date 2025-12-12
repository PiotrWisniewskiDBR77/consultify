/**
 * ANTYGRACITY REFAKTORING
 * Wspólne komponenty formularza wyekstrahowane z InitiativeDetailModal i TaskDetailModal
 * Cel: DRY (Don't Repeat Yourself) - eliminacja duplikacji kodu UI
 */

import React from 'react';
import { User } from '../../../types';

// ============================================================================
// InputGroup - wspólny wrapper dla pól formularza
// Poprzednio zdefiniowany lokalnie w InitiativeDetailModal.tsx
// ============================================================================
interface InputGroupProps {
    label: string;
    children: React.ReactNode;
    className?: string;
}

export const InputGroup: React.FC<InputGroupProps> = ({ label, children, className = '' }) => (
    <div className={`mb-4 ${className}`}>
        <label className="block text-xs uppercase text-slate-500 font-bold mb-1">
            {label}
        </label>
        {children}
    </div>
);

// ============================================================================
// FormInput - standardowy input z ciemnym stylem navy
// ============================================================================
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    variant?: 'default' | 'large' | 'small';
}

export const FormInput: React.FC<FormInputProps> = ({
    variant = 'default',
    className = '',
    ...props
}) => {
    const sizeClasses = {
        small: 'p-1 text-xs',
        default: 'p-2 text-sm',
        large: 'p-3 text-lg font-semibold'
    };

    return (
        <input
            className={`
                w-full bg-navy-950 border border-white/10 rounded-lg 
                text-white focus:border-blue-500 outline-none
                ${sizeClasses[variant]}
                ${className}
            `}
            {...props}
        />
    );
};

// ============================================================================
// FormTextarea - standardowa textarea z ciemnym stylem navy
// ============================================================================
interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    variant?: 'default' | 'highlighted';
}

export const FormTextarea: React.FC<FormTextareaProps> = ({
    variant = 'default',
    className = '',
    ...props
}) => {
    const variantClasses = {
        default: 'bg-navy-950 border-white/10',
        highlighted: 'bg-blue-900/10 border-blue-500/20'
    };

    return (
        <textarea
            className={`
                w-full border rounded-lg p-3 text-slate-300 
                focus:border-blue-500 outline-none resize-none
                ${variantClasses[variant]}
                ${className}
            `}
            {...props}
        />
    );
};

// ============================================================================
// FormSelect - standardowy select z ciemnym stylem navy
// ============================================================================
interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    options: { value: string; label: string }[];
    placeholder?: string;
}

export const FormSelect: React.FC<FormSelectProps> = ({
    options,
    placeholder,
    className = '',
    ...props
}) => (
    <select
        className={`
            w-full bg-navy-950 border border-white/10 rounded-lg p-2 
            text-sm text-white focus:border-blue-500 outline-none
            ${className}
        `}
        {...props}
    >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
    </select>
);

// ============================================================================
// UserSelect - select dla wyboru użytkownika (powtarzający się wzorzec)
// Wyekstrahowany z InitiativeDetailModal gdzie był powielony 3 razy
// ============================================================================
interface UserSelectProps {
    label: string;
    value: string | undefined;
    onChange: (userId: string) => void;
    users: User[];
    placeholder?: string;
}

export const UserSelect: React.FC<UserSelectProps> = ({
    label,
    value,
    onChange,
    users,
    placeholder = 'Select...'
}) => (
    <InputGroup label={label}>
        <select
            className="w-full bg-navy-900 border border-white/10 rounded p-2 text-sm text-white"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
        >
            <option value="">{placeholder}</option>
            {users.map(u => (
                <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                </option>
            ))}
        </select>
    </InputGroup>
);

// ============================================================================
// ArrayFieldEditor - edytor pól tablicowych (deliverables, scopeIn, etc.)
// Wyekstrahowany z InitiativeDetailModal - ten sam wzorzec powtarzał się 4 razy
// ============================================================================
interface ArrayFieldEditorProps {
    items: string[];
    onChange: (items: string[]) => void;
    placeholder?: string;
    addLabel?: string;
    colorScheme?: 'default' | 'green' | 'red';
}

export const ArrayFieldEditor: React.FC<ArrayFieldEditorProps> = ({
    items,
    onChange,
    placeholder = 'Enter item...',
    addLabel = '+ Add Item',
    colorScheme = 'default'
}) => {
    const handleItemChange = (index: number, value: string) => {
        const newItems = [...items];
        newItems[index] = value;
        onChange(newItems);
    };

    const addItem = () => {
        onChange([...items, '']);
    };

    const removeItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        onChange(newItems);
    };

    const colorClasses = {
        default: 'text-blue-400 hover:text-blue-300',
        green: 'text-green-400 hover:text-green-300',
        red: 'text-red-400 hover:text-red-300'
    };

    return (
        <div className="space-y-2">
            {items.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                    <input
                        className="flex-1 bg-navy-950 border border-white/10 rounded p-2 text-sm text-white"
                        value={item}
                        onChange={e => handleItemChange(idx, e.target.value)}
                        placeholder={placeholder}
                    />
                    <button
                        onClick={() => removeItem(idx)}
                        className="text-slate-500 hover:text-red-500 px-2"
                        type="button"
                    >
                        ×
                    </button>
                </div>
            ))}
            <button
                onClick={addItem}
                className={`text-sm font-medium ${colorClasses[colorScheme]}`}
                type="button"
            >
                {addLabel}
            </button>
        </div>
    );
};

