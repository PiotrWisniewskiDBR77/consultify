/**
 * AIContextSettings - AI Context Configuration
 *
 * Features:
 * - Context window size
 * - Include/exclude specific projects in context
 * - Include/exclude team members' data
 * - AI knowledge base preferences
 */

import {
  BookOpen,
  CheckCircle,
  Database,
  Filter,
  FolderOpen,
  Info,
  Loader2,
  Plus,
  Save,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../../services/api';
import { User } from '../../../types';

interface AIContextSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface Project {
  id: string;
  name: string;
  status: string;
}

interface ContextSettings {
  contextWindowSize: 'small' | 'medium' | 'large' | 'unlimited';
  includedProjects: string[];
  excludedProjects: string[];
  projectContextMode: 'all' | 'include' | 'exclude';
  includeTeamData: boolean;
  includedTeamMembers: string[];
  excludedTeamMembers: string[];
  teamDataMode: 'all' | 'include' | 'exclude';
  knowledgeBases: {
    companyDocs: boolean;
    projectDocs: boolean;
    pastConversations: boolean;
    industryKnowledge: boolean;
    customSources: string[];
  };
}

const defaultSettings: ContextSettings = {
  contextWindowSize: 'medium',
  includedProjects: [],
  excludedProjects: [],
  projectContextMode: 'all',
  includeTeamData: true,
  includedTeamMembers: [],
  excludedTeamMembers: [],
  teamDataMode: 'all',
  knowledgeBases: {
    companyDocs: true,
    projectDocs: true,
    pastConversations: true,
    industryKnowledge: false,
    customSources: [],
  },
};

export const AIContextSettings: React.FC<AIContextSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ContextSettings>(defaultSettings);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [newCustomSource, setNewCustomSource] = useState('');

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [settingsRes, projectsRes, membersRes] = await Promise.all([
        Api.get('/api/user/ai-preferences/context').catch(() => ({ data: null })),
        Api.get('/api/projects').catch(() => ({ data: [] })),
        Api.get('/api/users').catch(() => ({ data: [] })),
      ]);

      if (settingsRes.data) {
        setSettings({ ...defaultSettings, ...settingsRes.data });
      }
      if (projectsRes.data) {
        setProjects(projectsRes.data);
      }
      if (membersRes.data) {
        setTeamMembers(membersRes.data.filter((u: any) => u.id !== currentUser.id));
      }
    } catch (error) {
      console.error('Error loading AI context settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await Api.put('/api/user/ai-preferences/context', settings);
      toast.success(t('settings.ai.contextSaved', 'AI context settings saved'));
    } catch (error) {
      toast.error(t('settings.ai.contextError', 'Failed to save AI context settings'));
    } finally {
      setSaving(false);
    }
  };

  const toggleProject = (projectId: string, mode: 'include' | 'exclude') => {
    if (mode === 'include') {
      const included = settings.includedProjects.includes(projectId)
        ? settings.includedProjects.filter((id) => id !== projectId)
        : [...settings.includedProjects, projectId];
      setSettings({ ...settings, includedProjects: included });
    } else {
      const excluded = settings.excludedProjects.includes(projectId)
        ? settings.excludedProjects.filter((id) => id !== projectId)
        : [...settings.excludedProjects, projectId];
      setSettings({ ...settings, excludedProjects: excluded });
    }
  };

  const toggleTeamMember = (memberId: string, mode: 'include' | 'exclude') => {
    if (mode === 'include') {
      const included = settings.includedTeamMembers.includes(memberId)
        ? settings.includedTeamMembers.filter((id) => id !== memberId)
        : [...settings.includedTeamMembers, memberId];
      setSettings({ ...settings, includedTeamMembers: included });
    } else {
      const excluded = settings.excludedTeamMembers.includes(memberId)
        ? settings.excludedTeamMembers.filter((id) => id !== memberId)
        : [...settings.excludedTeamMembers, memberId];
      setSettings({ ...settings, excludedTeamMembers: excluded });
    }
  };

  const addCustomSource = () => {
    if (newCustomSource && !settings.knowledgeBases.customSources.includes(newCustomSource)) {
      setSettings({
        ...settings,
        knowledgeBases: {
          ...settings.knowledgeBases,
          customSources: [...settings.knowledgeBases.customSources, newCustomSource],
        },
      });
      setNewCustomSource('');
    }
  };

  const removeCustomSource = (source: string) => {
    setSettings({
      ...settings,
      knowledgeBases: {
        ...settings.knowledgeBases,
        customSources: settings.knowledgeBases.customSources.filter((s) => s !== source),
      },
    });
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const filteredMembers = teamMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Database size={28} className="text-blue-500" />
            {t('settings.ai.context.title', 'AI Context')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t('settings.ai.context.description', 'Control what information AI can access')}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Changes
        </button>
      </div>

      {/* Context Window Size */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <Settings size={20} className="text-blue-500" />
          Context Window Size
        </h3>
        <p className="text-sm text-c-text-muted">How much context AI can consider at once</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { id: 'small', label: 'Small', desc: '4K tokens', icon: '📄' },
            { id: 'medium', label: 'Medium', desc: '16K tokens', icon: '📑' },
            { id: 'large', label: 'Large', desc: '64K tokens', icon: '📚' },
            { id: 'unlimited', label: 'Unlimited', desc: 'Max available', icon: '🌐' },
          ].map((size) => (
            <button
              key={size.id}
              onClick={() => setSettings({ ...settings, contextWindowSize: size.id as any })}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                settings.contextWindowSize === size.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                  : 'border-c-border-subtle dark:border-navy-700 hover:border-blue-300'
              }`}
            >
              <span className="text-2xl">{size.icon}</span>
              <p className="font-medium text-c-text mt-2">{size.label}</p>
              <p className="text-xs text-c-text-muted">{size.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Project Context */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <FolderOpen size={20} className="text-amber-500" />
          Project Context
        </h3>

        <div className="flex gap-3">
          {(['all', 'include', 'exclude'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setSettings({ ...settings, projectContextMode: mode })}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                settings.projectContextMode === mode
                  ? 'bg-amber-600 text-white'
                  : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-700'
              }`}
            >
              {mode === 'all' ? 'All Projects' : mode === 'include' ? 'Only Include' : 'Exclude'}
            </button>
          ))}
        </div>

        {settings.projectContextMode !== 'all' && (
          <div className="space-y-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-secondary"
              />
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-10 pr-4 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {filteredProjects.map((project) => {
                const isSelected =
                  settings.projectContextMode === 'include'
                    ? settings.includedProjects.includes(project.id)
                    : settings.excludedProjects.includes(project.id);
                return (
                  <button
                    key={project.id}
                    onClick={() =>
                      toggleProject(
                        project.id,
                        settings.projectContextMode as 'include' | 'exclude'
                      )
                    }
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                      isSelected
                        ? 'bg-amber-100 dark:bg-amber-500/20 border-2 border-amber-500'
                        : 'bg-c-surface-raised border-2 border-transparent hover:border-amber-300'
                    }`}
                  >
                    <span className="text-sm text-c-text">{project.name}</span>
                    {isSelected && <CheckCircle size={16} className="text-amber-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Team Data Context */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <Users size={20} className="text-green-500" />
            Team Data
          </h3>
          <button
            onClick={() => setSettings({ ...settings, includeTeamData: !settings.includeTeamData })}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              settings.includeTeamData ? 'bg-green-600' : 'bg-c-surface-raised'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${
                settings.includeTeamData ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        {settings.includeTeamData && (
          <>
            <div className="flex gap-3">
              {(['all', 'include', 'exclude'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSettings({ ...settings, teamDataMode: mode })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                    settings.teamDataMode === mode
                      ? 'bg-green-600 text-white'
                      : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-700'
                  }`}
                >
                  {mode === 'all' ? 'All Members' : mode === 'include' ? 'Only Include' : 'Exclude'}
                </button>
              ))}
            </div>

            {settings.teamDataMode !== 'all' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-secondary"
                  />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search team members..."
                    className="w-full pl-10 pr-4 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {filteredMembers.map((member) => {
                    const isSelected =
                      settings.teamDataMode === 'include'
                        ? settings.includedTeamMembers.includes(member.id)
                        : settings.excludedTeamMembers.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        onClick={() =>
                          toggleTeamMember(
                            member.id,
                            settings.teamDataMode as 'include' | 'exclude'
                          )
                        }
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                          isSelected
                            ? 'bg-green-100 dark:bg-green-500/20 border-2 border-green-500'
                            : 'bg-c-surface-raised border-2 border-transparent hover:border-green-300'
                        }`}
                      >
                        <div className="text-left">
                          <p className="text-sm text-c-text">{member.name}</p>
                          <p className="text-xs text-c-text-muted">{member.email}</p>
                        </div>
                        {isSelected && <CheckCircle size={16} className="text-green-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Knowledge Bases */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <BookOpen size={20} className="text-c-accent" />
          Knowledge Bases
        </h3>
        <p className="text-sm text-c-text-muted">Additional knowledge sources for AI</p>

        <div className="space-y-3">
          {[
            {
              key: 'companyDocs',
              label: 'Company Documents',
              desc: 'Internal policies and guides',
            },
            {
              key: 'projectDocs',
              label: 'Project Documentation',
              desc: 'Project specs and requirements',
            },
            {
              key: 'pastConversations',
              label: 'Past Conversations',
              desc: 'Previous AI chat history',
            },
            {
              key: 'industryKnowledge',
              label: 'Industry Knowledge',
              desc: 'External industry data',
            },
          ].map((kb) => (
            <div
              key={kb.key}
              className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg"
            >
              <div>
                <p className="font-medium text-c-text">{kb.label}</p>
                <p className="text-sm text-c-text-muted">{kb.desc}</p>
              </div>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    knowledgeBases: {
                      ...settings.knowledgeBases,
                      [kb.key]: !(settings.knowledgeBases as any)[kb.key],
                    },
                  })
                }
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  (settings.knowledgeBases as any)[kb.key] ? 'bg-navy-900' : 'bg-c-surface-raised'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${
                    (settings.knowledgeBases as any)[kb.key] ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Custom Sources */}
        <div className="pt-4 border-t border-c-border-subtle dark:border-navy-700">
          <p className="font-medium text-c-text mb-3">Custom Knowledge Sources</p>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newCustomSource}
              onChange={(e) => setNewCustomSource(e.target.value)}
              placeholder="Add custom URL or path..."
              className="flex-1 px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg"
              onKeyPress={(e) => e.key === 'Enter' && addCustomSource()}
            />
            <button
              onClick={addCustomSource}
              className="px-4 py-2 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg hover:bg-navy-800"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {settings.knowledgeBases.customSources.map((source) => (
              <span
                key={source}
                className="flex items-center gap-2 px-3 py-1.5 bg-c-accent-soft dark:bg-c-accent-soft text-c-accent rounded-lg text-sm"
              >
                {source}
                <button onClick={() => removeCustomSource(source)} className="hover:text-c-accent">
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIContextSettings;
