/**
 * ProfileFieldsConfig - Admin-configurable profile fields component
 *
 * Features:
 * - Add/edit/remove custom profile fields
 * - Field type selection (text, dropdown, date, etc.)
 * - Required/optional toggle
 * - Visibility settings
 * - Drag and drop reordering
 *
 * Design: List with inline editing and preview
 */

import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Hash,
  HelpCircle,
  Link,
  List,
  Mail,
  Phone,
  Plus,
  Save,
  Text,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Field types
export type ProfileFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'url'
  | 'number'
  | 'date'
  | 'dropdown'
  | 'multiselect';

// Visibility options
export type FieldVisibility = 'public' | 'team' | 'admin' | 'private';

// Profile field definition
export interface ProfileField {
  id: string;
  label: string;
  type: ProfileFieldType;
  required: boolean;
  visibility: FieldVisibility;
  placeholder?: string;
  helpText?: string;
  options?: string[]; // For dropdown/multiselect
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  isSystem?: boolean; // Built-in fields that can't be deleted
  order: number;
}

interface ProfileFieldsConfigProps {
  fields: ProfileField[];
  onChange: (fields: ProfileField[]) => void;
  onSave?: () => void;
  className?: string;
}

// Get icon for field type
const getFieldTypeIcon = (type: ProfileFieldType) => {
  switch (type) {
    case 'text':
      return Text;
    case 'textarea':
      return Text;
    case 'email':
      return Mail;
    case 'phone':
      return Phone;
    case 'url':
      return Link;
    case 'number':
      return Hash;
    case 'date':
      return Calendar;
    case 'dropdown':
    case 'multiselect':
      return List;
    default:
      return Text;
  }
};

// Get visibility label
const getVisibilityLabel = (visibility: FieldVisibility) => {
  switch (visibility) {
    case 'public':
      return 'Everyone';
    case 'team':
      return 'Team members';
    case 'admin':
      return 'Admins only';
    case 'private':
      return 'User only';
  }
};

export const ProfileFieldsConfig: React.FC<ProfileFieldsConfigProps> = ({
  fields,
  onChange,
  onSave,
  className,
}) => {
  const { t } = useTranslation();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [newField, setNewField] = useState<Partial<ProfileField> | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Add new field
  const handleAddField = useCallback(() => {
    setNewField({
      id: `field_${Date.now()}`,
      label: '',
      type: 'text',
      required: false,
      visibility: 'team',
      order: fields.length,
    });
  }, [fields.length]);

  // Save new field
  const handleSaveNewField = useCallback(() => {
    if (newField && newField.label) {
      onChange([...fields, newField as ProfileField]);
      setNewField(null);
    }
  }, [newField, fields, onChange]);

  // Update field
  const updateField = useCallback(
    (fieldId: string, updates: Partial<ProfileField>) => {
      onChange(fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)));
    },
    [fields, onChange]
  );

  // Delete field
  const deleteField = useCallback(
    (fieldId: string) => {
      onChange(fields.filter((f) => f.id !== fieldId));
    },
    [fields, onChange]
  );

  // Move field
  const moveField = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const newFields = [...fields];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newFields.length) return;

      [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];

      // Update order
      onChange(newFields.map((f, i) => ({ ...f, order: i })));
    },
    [fields, onChange]
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
            {t('admin.organization.profileFields.title', 'Profile Fields')}
            <Tooltip
              content={t(
                'admin.organization.profileFields.tooltip',
                'Configure which fields appear on user profiles'
              )}
            >
              <HelpCircle size={16} className="text-slate-400 dark:text-slate-500" />
            </Tooltip>
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('admin.organization.profileFields.subtitle', 'Customize user profile information')}
          </p>
        </div>
        <div className="flex gap-2">
          {onSave && (
            <Button variant="outline" size="sm" onClick={onSave} icon={<Save size={16} />}>
              {t('admin.organization.profileFields.save', 'Save Changes')}
            </Button>
          )}
          <Button size="sm" onClick={handleAddField} icon={<Plus size={16} />}>
            {t('admin.organization.profileFields.addField', 'Add Field')}
          </Button>
        </div>
      </div>

      {/* Fields List */}
      <div className="space-y-2">
        {fields
          .sort((a, b) => a.order - b.order)
          .map((field, index) => {
            const Icon = getFieldTypeIcon(field.type);
            const isEditing = editingField === field.id;

            return (
              <div
                key={field.id}
                className={cn(
                  'bg-white dark:bg-navy-800 rounded-lg border transition-all',
                  isEditing
                    ? 'border-primary-500 ring-2 ring-c-info/20'
                    : 'border-slate-200 dark:border-navy-700'
                )}
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Drag Handle */}
                  <div className="cursor-grab text-slate-400 hover:text-slate-600 dark:text-slate-400">
                    <GripVertical size={18} />
                  </div>

                  {/* Move Buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveField(index, 'up')}
                      disabled={index === 0}
                      className="p-0.5 text-slate-400 hover:text-slate-600 dark:text-slate-400 disabled:opacity-30"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => moveField(index, 'down')}
                      disabled={index === fields.length - 1}
                      className="p-0.5 text-slate-400 hover:text-slate-600 dark:text-slate-400 disabled:opacity-30"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {/* Field Icon */}
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-navy-700 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-slate-500 dark:text-slate-400" />
                  </div>

                  {/* Field Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-navy-900 dark:text-white truncate">
                        {field.label}
                      </h4>
                      {field.required && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300 rounded">
                          {t('admin.organization.profileFields.required', 'Required')}
                        </span>
                      )}
                      {field.isSystem && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 rounded">
                          {t('admin.organization.profileFields.system', 'System')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="capitalize">{field.type}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        {field.visibility === 'private' ? <EyeOff size={10} /> : <Eye size={10} />}
                        {getVisibilityLabel(field.visibility)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingField(isEditing ? null : field.id)}
                      className="h-8 w-8 p-0"
                    >
                      {isEditing ? <X size={14} /> : <Text size={14} />}
                    </Button>
                    {!field.isSystem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteField(field.id)}
                        className="h-8 w-8 p-0 text-danger-500 hover:text-danger-600"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded Editor */}
                {isEditing && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-200 dark:border-navy-700 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                          {t('admin.organization.profileFields.label', 'Label')}
                        </label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateField(field.id, { label: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                          {t('admin.organization.profileFields.type', 'Type')}
                        </label>
                        <select
                          value={field.type}
                          onChange={(e) =>
                            updateField(field.id, {
                              type: e.target.value as ProfileFieldType,
                            })
                          }
                          disabled={field.isSystem}
                          className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
                        >
                          <option value="text">Text</option>
                          <option value="textarea">Text Area</option>
                          <option value="email">Email</option>
                          <option value="phone">Phone</option>
                          <option value="url">URL</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="dropdown">Dropdown</option>
                          <option value="multiselect">Multi-select</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                          {t('admin.organization.profileFields.visibility', 'Visibility')}
                        </label>
                        <select
                          value={field.visibility}
                          onChange={(e) =>
                            updateField(field.id, {
                              visibility: e.target.value as FieldVisibility,
                            })
                          }
                          className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
                        >
                          <option value="public">Everyone</option>
                          <option value="team">Team members</option>
                          <option value="admin">Admins only</option>
                          <option value="private">User only</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-4 pt-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) =>
                              updateField(field.id, {
                                required: e.target.checked,
                              })
                            }
                            disabled={field.isSystem}
                            className="rounded border-slate-300 dark:border-navy-700"
                          />
                          <span className="text-sm text-navy-900 dark:text-white">
                            {t('admin.organization.profileFields.required', 'Required')}
                          </span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                        {t('admin.organization.profileFields.placeholder', 'Placeholder')}
                      </label>
                      <input
                        type="text"
                        value={field.placeholder || ''}
                        onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
                      />
                    </div>

                    {/* Options for dropdown/multiselect */}
                    {(field.type === 'dropdown' || field.type === 'multiselect') && (
                      <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                          {t('admin.organization.profileFields.options', 'Options (one per line)')}
                        </label>
                        <textarea
                          value={field.options?.join('\n') || ''}
                          onChange={(e) =>
                            updateField(field.id, {
                              options: e.target.value.split('\n').filter((o) => o.trim()),
                            })
                          }
                          rows={4}
                          className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white resize-none"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

        {/* New Field Form */}
        {newField && (
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800 p-4 space-y-4">
            <h4 className="font-medium text-primary-900 dark:text-primary-200">
              {t('admin.organization.profileFields.newField', 'New Field')}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
                  {t('admin.organization.profileFields.label', 'Label')}
                </label>
                <input
                  type="text"
                  value={newField.label || ''}
                  onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                  placeholder="e.g., Department, Location"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-primary-200 dark:border-primary-700 rounded-lg text-navy-900 dark:text-white"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
                  {t('admin.organization.profileFields.type', 'Type')}
                </label>
                <select
                  value={newField.type || 'text'}
                  onChange={(e) =>
                    setNewField({
                      ...newField,
                      type: e.target.value as ProfileFieldType,
                    })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-primary-200 dark:border-primary-700 rounded-lg text-navy-900 dark:text-white"
                >
                  <option value="text">Text</option>
                  <option value="textarea">Text Area</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="url">URL</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="dropdown">Dropdown</option>
                  <option value="multiselect">Multi-select</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setNewField(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveNewField}
                disabled={!newField.label}
                icon={<Check size={14} />}
              >
                {t('admin.organization.profileFields.addField', 'Add Field')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {fields.length === 0 && !newField && (
        <div className="text-center py-12 bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 border-dashed">
          <Text size={48} className="mx-auto mb-4 text-slate-300 dark:text-navy-600" />
          <h4 className="font-medium text-navy-900 dark:text-white mb-2">
            {t('admin.organization.profileFields.noFields', 'No custom fields yet')}
          </h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {t(
              'admin.organization.profileFields.noFieldsDesc',
              'Add custom fields to collect additional information on user profiles'
            )}
          </p>
          <Button onClick={handleAddField} icon={<Plus size={16} />}>
            {t('admin.organization.profileFields.addField', 'Add Field')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProfileFieldsConfig;
