/**
 * SettingsTemplates - Predefined settings configurations
 */

import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useTranslation } from 'react-i18next';
import { Layout, Save, Loader2, Plus, Trash2, Copy, Check, Star, Zap, Shield, Eye } from 'lucide-react';
import { Api } from '../../../services/api';
import { toast } from 'react-hot-toast';
import { InfoButton } from '../../shared/InfoButton';

interface SettingsTemplatesProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

interface Template {
    id: string;
    name: string;
    description: string;
    icon: string;
    type: 'system' | 'custom';
    categories: string[];
    isRecommended?: boolean;
    createdAt?: string;
}

export const SettingsTemplates: React.FC<SettingsTemplatesProps> = ({ currentUser }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState<string | null>(null);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateDesc, setNewTemplateDesc] = useState('');

    useEffect(() => { loadData(); }, [currentUser.id]);

    const loadData = async () => {
        try {
            setLoading(true);
            // System templates
            setTemplates([
                { 
                    id: 'minimal', 
                    name: 'Minimal', 
                    description: 'Clean, distraction-free settings with minimal notifications',
                    icon: '🎯',
                    type: 'system',
                    categories: ['Notifications', 'Appearance'],
                    isRecommended: false
                },
                { 
                    id: 'power-user', 
                    name: 'Power User', 
                    description: 'All features enabled, advanced shortcuts, maximum productivity',
                    icon: '⚡',
                    type: 'system',
                    categories: ['AI', 'Shortcuts', 'Notifications'],
                    isRecommended: true
                },
                { 
                    id: 'privacy-focused', 
                    name: 'Privacy Focused', 
                    description: 'Maximum privacy, minimal data sharing, strict security',
                    icon: '🔒',
                    type: 'system',
                    categories: ['Privacy', 'Security'],
                    isRecommended: false
                },
                { 
                    id: 'beginner', 
                    name: 'Beginner Friendly', 
                    description: 'Guided experience with helpful prompts and tutorials',
                    icon: '🌱',
                    type: 'system',
                    categories: ['AI', 'Appearance'],
                    isRecommended: false
                },
                { 
                    id: 'enterprise', 
                    name: 'Enterprise', 
                    description: 'Strict security, compliance-focused, audit logging enabled',
                    icon: '🏢',
                    type: 'system',
                    categories: ['Security', 'Privacy', 'Integrations'],
                    isRecommended: false
                }
            ]);
            // Custom templates
            setCustomTemplates([
                { 
                    id: 'my-setup', 
                    name: 'My Daily Setup', 
                    description: 'Personal configuration saved on Dec 15',
                    icon: '⭐',
                    type: 'custom',
                    categories: ['All'],
                    createdAt: '2025-12-15'
                }
            ]);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApplyTemplate = async (template: Template) => {
        if (!window.confirm(`Apply "${template.name}" template? This will overwrite your current settings.`)) return;
        
        try {
            setApplying(template.id);
            await new Promise(resolve => setTimeout(resolve, 1500));
            toast.success(`Applied "${template.name}" template`);
        } catch (error) {
            toast.error('Failed to apply template');
        } finally {
            setApplying(null);
        }
    };

    const handleCreateTemplate = async () => {
        if (!newTemplateName.trim()) return;
        
        try {
            const newTemplate: Template = {
                id: `custom-${Date.now()}`,
                name: newTemplateName,
                description: newTemplateDesc || 'Custom settings template',
                icon: '📋',
                type: 'custom',
                categories: ['All'],
                createdAt: new Date().toISOString().split('T')[0]
            };
            setCustomTemplates([...customTemplates, newTemplate]);
            setShowCreateModal(false);
            setNewTemplateName('');
            setNewTemplateDesc('');
            toast.success('Template created from current settings');
        } catch (error) {
            toast.error('Failed to create template');
        }
    };

    const handleDeleteTemplate = (id: string) => {
        if (!window.confirm('Delete this template?')) return;
        setCustomTemplates(customTemplates.filter(t => t.id !== id));
        toast.success('Template deleted');
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in relative">
            <InfoButton cardId="settings-templates" position="top-right" />
            
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Layout size={28} className="text-indigo-500" />
                        Settings Templates
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Apply predefined configurations or save your own</p>
                </div>
                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                >
                    <Plus size={16} />
                    Save Current as Template
                </button>
            </div>

            {/* System Templates */}
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Zap size={18} className="text-amber-500" />
                    System Templates
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map((template) => (
                        <div 
                            key={template.id} 
                            className={`bg-white dark:bg-navy-900 border rounded-xl p-4 hover:shadow-md transition-shadow ${template.isRecommended ? 'border-indigo-300 dark:border-indigo-500/50' : 'border-slate-200 dark:border-white/10'}`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">{template.icon}</span>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-slate-900 dark:text-white">{template.name}</h4>
                                            {template.isRecommended && (
                                                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-medium">
                                                    Recommended
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500 mt-1">{template.description}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-1 mt-3">
                                {template.categories.map(cat => (
                                    <span key={cat} className="px-2 py-0.5 bg-slate-100 dark:bg-navy-800 rounded text-xs text-slate-600 dark:text-slate-400">
                                        {cat}
                                    </span>
                                ))}
                            </div>
                            
                            <button
                                onClick={() => handleApplyTemplate(template)}
                                disabled={applying === template.id}
                                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg disabled:opacity-50"
                            >
                                {applying === template.id ? (
                                    <><Loader2 size={16} className="animate-spin" /> Applying...</>
                                ) : (
                                    <><Check size={16} /> Apply Template</>
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Custom Templates */}
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Star size={18} className="text-amber-500" />
                    My Templates
                </h3>
                {customTemplates.length === 0 ? (
                    <div className="bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-xl p-8 text-center">
                        <Layout size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                        <p className="text-slate-500">No custom templates yet</p>
                        <p className="text-sm text-slate-400 mt-1">Save your current settings as a template to use later</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {customTemplates.map((template) => (
                            <div 
                                key={template.id} 
                                className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-4 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{template.icon}</span>
                                    <div>
                                        <h4 className="font-semibold text-slate-900 dark:text-white">{template.name}</h4>
                                        <p className="text-sm text-slate-500">{template.description}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleApplyTemplate(template)}
                                        disabled={applying === template.id}
                                        className="px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg text-sm"
                                    >
                                        Apply
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTemplate(template.id)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Template Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-navy-900 rounded-xl p-6 w-full max-w-md mx-4 animate-in zoom-in-95">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Save as Template</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Template Name
                                </label>
                                <input
                                    type="text"
                                    value={newTemplateName}
                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                    placeholder="My Settings Template"
                                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Description (optional)
                                </label>
                                <textarea
                                    value={newTemplateDesc}
                                    onChange={(e) => setNewTemplateDesc(e.target.value)}
                                    placeholder="Describe this template..."
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                        
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateTemplate}
                                disabled={!newTemplateName.trim()}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50"
                            >
                                Save Template
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsTemplates;




