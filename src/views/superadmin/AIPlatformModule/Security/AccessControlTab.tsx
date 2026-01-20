/**
 * AccessControlTab - Security > Access Control
 * RBAC for AI features - wrapper with AI context
 */

import {
  AlertCircle,
  Check,
  ChevronRight,
  Edit,
  Info,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Shield,
  User,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

interface AIPermission {
  id: string;
  name: string;
  description: string;
  category: 'chat' | 'analysis' | 'admin' | 'advanced';
}

interface Role {
  id: string;
  name: string;
  description: string;
  type: 'system' | 'custom';
  userCount: number;
  permissions: string[];
}

export const AccessControlTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<AIPermission[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  useEffect(() => {
    loadAccessControl();
  }, []);

  const loadAccessControl = async () => {
    setLoading(true);
    try {
      // Mock data - replace with API
      setPermissions([
        { id: 'ai_chat_basic', name: 'Basic AI Chat', description: 'Access to standard AI chat', category: 'chat' },
        { id: 'ai_chat_max', name: 'MAX Mode', description: 'Access to extended thinking mode', category: 'chat' },
        { id: 'ai_deep_research', name: 'Deep Research', description: 'Access to deep research feature', category: 'analysis' },
        { id: 'ai_code_interpreter', name: 'Code Interpreter', description: 'Execute code in AI chat', category: 'advanced' },
        { id: 'ai_vision', name: 'Vision Analysis', description: 'Analyze images in chat', category: 'analysis' },
        { id: 'ai_web_search', name: 'Web Search', description: 'AI web search capability', category: 'analysis' },
        { id: 'ai_document_analysis', name: 'Document Analysis', description: 'Analyze uploaded documents', category: 'analysis' },
        { id: 'ai_prompts_view', name: 'View Prompts', description: 'View prompt library', category: 'admin' },
        { id: 'ai_prompts_edit', name: 'Edit Prompts', description: 'Create and modify prompts', category: 'admin' },
        { id: 'ai_knowledge_manage', name: 'Manage Knowledge', description: 'Upload and manage knowledge base', category: 'admin' },
        { id: 'ai_experiments', name: 'Run Experiments', description: 'Create and manage A/B tests', category: 'admin' },
        { id: 'ai_config', name: 'AI Configuration', description: 'Full AI platform configuration', category: 'admin' },
      ]);

      setRoles([
        {
          id: '1',
          name: 'AI User',
          description: 'Standard AI chat access',
          type: 'system',
          userCount: 1250,
          permissions: ['ai_chat_basic', 'ai_vision', 'ai_document_analysis'],
        },
        {
          id: '2',
          name: 'AI Power User',
          description: 'Extended AI capabilities',
          type: 'system',
          userCount: 320,
          permissions: ['ai_chat_basic', 'ai_chat_max', 'ai_deep_research', 'ai_vision', 'ai_document_analysis', 'ai_web_search'],
        },
        {
          id: '3',
          name: 'AI Developer',
          description: 'AI development and testing',
          type: 'system',
          userCount: 45,
          permissions: ['ai_chat_basic', 'ai_chat_max', 'ai_deep_research', 'ai_code_interpreter', 'ai_vision', 'ai_document_analysis', 'ai_web_search', 'ai_prompts_view', 'ai_prompts_edit', 'ai_experiments'],
        },
        {
          id: '4',
          name: 'AI Admin',
          description: 'Full AI platform administration',
          type: 'system',
          userCount: 8,
          permissions: ['ai_chat_basic', 'ai_chat_max', 'ai_deep_research', 'ai_code_interpreter', 'ai_vision', 'ai_document_analysis', 'ai_web_search', 'ai_prompts_view', 'ai_prompts_edit', 'ai_knowledge_manage', 'ai_experiments', 'ai_config'],
        },
        {
          id: '5',
          name: 'Research Team',
          description: 'Custom role for research department',
          type: 'custom',
          userCount: 24,
          permissions: ['ai_chat_basic', 'ai_chat_max', 'ai_deep_research', 'ai_vision', 'ai_document_analysis', 'ai_web_search'],
        },
      ]);
    } catch (err) {
      toast.error('Failed to load access control');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: AIPermission['category']) => {
    const colors = {
      chat: 'bg-blue-500/10 text-blue-500',
      analysis: 'bg-emerald-500/10 text-emerald-500',
      admin: 'bg-purple-500/10 text-purple-500',
      advanced: 'bg-amber-500/10 text-amber-500',
    };
    return colors[category];
  };

  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, AIPermission[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Lock size={24} className="text-indigo-500" />
            AI Access Control
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage AI feature permissions and role assignments
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors">
          <Plus size={16} />
          Create Role
        </button>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
        <div>
          <div className="font-medium text-slate-900 dark:text-white">AI Permission Hierarchy</div>
          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            AI permissions are additive and work alongside organization-level roles. Users need both
            organizational access and AI permissions to use features.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="col-span-1 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">AI Roles</h3>
          <div className="space-y-2">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={`w-full p-4 rounded-xl border transition-all text-left ${
                  selectedRole?.id === role.id
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500'
                    : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 hover:border-indigo-300 dark:hover:border-indigo-500/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className={selectedRole?.id === role.id ? 'text-indigo-500' : 'text-slate-400'} />
                    <span className="font-medium text-slate-900 dark:text-white">{role.name}</span>
                  </div>
                  {role.type === 'custom' && (
                    <span className="px-2 py-0.5 text-xs bg-amber-500/10 text-amber-500 rounded">Custom</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{role.description}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Users size={12} />
                  <span>{role.userCount} users</span>
                  <span>•</span>
                  <span>{role.permissions.length} permissions</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Permissions Matrix */}
        <div className="col-span-2 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          {selectedRole ? (
            <>
              <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{selectedRole.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{selectedRole.description}</p>
                </div>
                {selectedRole.type === 'custom' && (
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg text-slate-500">
                    <Edit size={16} />
                  </button>
                )}
              </div>
              <div className="p-6 space-y-6">
                {Object.entries(groupedPermissions).map(([category, perms]) => (
                  <div key={category}>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase mb-3 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${getCategoryColor(category as AIPermission['category']).split(' ')[0].replace('/10', '')}`} />
                      {category}
                    </h4>
                    <div className="space-y-2">
                      {perms.map((perm) => {
                        const hasPermission = selectedRole.permissions.includes(perm.id);
                        return (
                          <div
                            key={perm.id}
                            className={`flex items-center justify-between p-3 rounded-lg ${
                              hasPermission
                                ? 'bg-emerald-50 dark:bg-emerald-500/10'
                                : 'bg-slate-50 dark:bg-navy-900/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-5 h-5 rounded flex items-center justify-center ${
                                  hasPermission
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-200 dark:bg-navy-700'
                                }`}
                              >
                                {hasPermission && <Check size={12} />}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-slate-900 dark:text-white">
                                  {perm.name}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {perm.description}
                                </div>
                              </div>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs ${getCategoryColor(perm.category)}`}>
                              {perm.category}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-slate-400">
              <Shield size={48} className="mb-4 opacity-50" />
              <p>Select a role to view permissions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccessControlTab;
