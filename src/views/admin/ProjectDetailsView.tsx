import {
  Activity,
  ArrowLeft,
  Briefcase,
  Check,
  ChevronRight,
  Edit,
  FileText,
  Globe,
  Info,
  Layers,
  Lock,
  PieChart,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Target,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { ProjectTeamPanel } from '../../components/PMO/ProjectTeamPanel';
import { ProjectTeamBoard } from '../../components/Projects/ProjectTeamBoard';
import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { Project } from '../../types';
import { AppView } from '../../types';

interface ProjectDetailsViewProps {
  projectId: string;
  onBack: () => void;
}

export const ProjectDetailsView: React.FC<ProjectDetailsViewProps> = ({ projectId, onBack }) => {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'team' | 'initiatives' | 'assessments' | 'documents'
  >('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    goal: string;
    status: Project['status'];
  }>({ name: '', description: '', goal: '', status: 'active' });
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const loadProjectDetails = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Api.getProjectDetails(projectId);
      if (!data) {
        throw new Error('Project not found');
      }
      setProject(data as any);
      setEditForm({
        name: data.name,
        description: data.description || '',
        goal: data.goal || '',
        status: data.status as Project['status'],
      });
    } catch (e) {
      console.error(e);
      toast.error('Failed to load project details');
      onBack();
    } finally {
      setLoading(false);
    }
  }, [projectId, onBack]);

  useEffect(() => {
    loadProjectDetails();
  }, [loadProjectDetails]);

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await Api.updateProject(projectId, editForm);
      toast.success('Project updated');
      setIsEditing(false);
      loadProjectDetails();
    } catch (e) {
      toast.error('Failed to update project');
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    try {
      await Api.uploadKnowledgeDocument(uploadFile, projectId);
      toast.success('Document uploaded and linked to project');
      setUploadFile(null);
      loadProjectDetails();
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        <p className="text-c-text-muted animate-pulse">
          Synchronizing project intelligence...
        </p>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <InfoButton cardId="project-details" position="top-right" />

      {/* Breadcrumbs & Navigation */}
      <div className="flex items-center gap-2 text-xs text-c-text-muted mb-2">
        <button onClick={onBack} className="hover:text-white transition-colors">
          Workspace
        </button>
        <ChevronRight size={12} />
        <button onClick={onBack} className="hover:text-white transition-colors">
          Projects
        </button>
        <ChevronRight size={12} />
        <span className="text-slate-300 font-medium">{project.name}</span>
      </div>

      {/* Project Header - DBR77 Compatible */}
      <div className="flex flex-wrap justify-between items-start gap-4 bg-gradient-to-r from-primary-600 to-secondary-700 dark:bg-navy-900/40 dark:from-transparent dark:to-transparent backdrop-blur-md p-8 rounded-xl border border-primary-500/20 dark:border-navy-700 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-c-surface/10 dark:bg-primary-600/5 blur-[100px] pointer-events-none"></div>

        <div className="flex gap-6 items-start z-10">
          <div className="p-5 rounded-xl bg-c-surface/20 dark:bg-gradient-to-br dark:from-primary-600 dark:to-indigo-600 text-white shadow-xl shadow-primary-900/20">
            <Layers size={32} />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-extrabold text-c-text tracking-tight">{project.name}</h1>
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border shadow-sm ${
                  project.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : project.status === 'completed'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'bg-slate-500/10 text-c-text-muted border-slate-500/20'
                }`}
              >
                {project.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-c-text-muted">
              <div className="flex items-center gap-1.5">
                <Users size={16} className="text-blue-400" />
                <span>{project.team?.length || 0} Members</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Target size={16} className="text-green-400" />
                <span>{project.initiatives?.length || 0} Initiatives</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity size={16} className="text-amber-400" />
                <span>{project.assessments?.length || 0} Assessments</span>
              </div>
              <div className="flex items-center gap-1.5 text-c-text-muted">
                <Globe size={16} />
                <span>
                  Created {new Date(project.created_at || project.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 sm:mt-0 z-10">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-semibold text-sm ${
              isEditing
                ? 'bg-c-surface text-navy-900 shadow-xl'
                : 'bg-c-surface/5 border border-c-border-subtle text-c-text hover:bg-c-surface-raised/40'
            }`}
          >
            {isEditing ? <X size={18} /> : <Edit size={18} />}
            {isEditing ? 'Cancel Edit' : 'Edit Project'}
          </button>
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-c-border-subtle text-c-text-secondary hover:text-c-text dark:hover:text-white rounded-xl transition-all text-sm font-semibold"
          >
            <ArrowLeft size={18} /> Back
          </button>
        </div>
      </div>

      {/* Tabs Navigation - DBR77 Compatible */}
      <div className="flex gap-2 p-1 bg-c-surface/50 backdrop-blur-sm border border-c-border-subtle rounded-xl w-fit shadow-sm dark:shadow-none">
        {[
          { id: 'overview', label: 'Overview', icon: Layers },
          { id: 'team', label: 'Team & PMO', icon: Users },
          { id: 'initiatives', label: 'Initiatives', icon: Target },
          { id: 'assessments', label: 'Assessments', icon: PieChart },
          { id: 'documents', label: 'Knowledge Base', icon: FileText },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-c-text text-c-bg shadow-lg shadow-primary-900/30'
                : 'text-c-text-muted hover:text-navy-900 dark:hover:text-slate-200 hover:bg-c-surface-raised dark:hover:bg-c-surface/5'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content Area */}
      <div className="mt-8 min-h-[500px]">
        {/* --- OVERVIEW TAB --- */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-2 duration-300">
            <div className="lg:col-span-2 space-y-6">
              {isEditing ? (
                <form
                  onSubmit={handleUpdateProject}
                  className="bg-c-surface border border-c-border-subtle rounded-xl p-8 space-y-6 shadow-xl"
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-c-text-muted uppercase tracking-widest mb-2">
                        Project Name
                      </label>
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full bg-c-text text-c-bg border border-c-border-subtle rounded-xl p-4 focus:border-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-c-text-muted uppercase tracking-widest mb-2">
                        Description
                      </label>
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        rows={4}
                        className="w-full bg-c-text text-c-bg border border-c-border-subtle rounded-xl p-4 focus:border-primary-500 outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-c-text-muted uppercase tracking-widest mb-2">
                        Strategic Goal (CEL)
                      </label>
                      <input
                        value={editForm.goal}
                        onChange={(e) => setEditForm({ ...editForm, goal: e.target.value })}
                        className="w-full bg-c-text text-c-bg border border-c-border-subtle rounded-xl p-4 focus:border-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-c-text-muted uppercase tracking-widest mb-2">
                        Status
                      </label>
                      <select
                        value={editForm.status}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            status: e.target.value as Project['status'],
                          })
                        }
                        className="w-full bg-c-text text-c-bg border border-c-border-subtle rounded-xl p-4 focus:border-primary-500 outline-none appearance-none"
                      >
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button
                      type="submit"
                      className="flex-1 py-4 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-xl font-bold shadow-lg shadow-primary-900/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Check size={20} /> Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-c-text-secondary rounded-xl font-bold transition-all"
                    >
                      Discard
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="bg-c-surface border border-c-border-subtle rounded-xl p-8 space-y-6 relative overflow-hidden shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-3 text-primary-600 dark:text-primary-400 mb-2">
                      <Info size={18} />
                      <h3 className="text-sm font-bold uppercase tracking-widest">About Project</h3>
                    </div>
                    <p className="text-c-text-secondary leading-relaxed text-lg">
                      {project.description ||
                        'No description provided for this project yet. Edit project details to add context for the team and AI.'}
                    </p>

                    <div className="pt-6 border-t border-c-border-subtle flex flex-col gap-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-success-500/10 text-success-600 dark:text-green-400">
                          <Target size={24} />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-c-text-muted uppercase tracking-widest">
                            Master Goal (CEL)
                          </div>
                          <div className="text-navy-900 dark:text-white font-semibold text-lg">
                            {project.goal || 'Not defined'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats Grid - DBR77 Compatible */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-c-surface/60 border border-c-border-subtle p-4 rounded-xl hover:border-primary-500/30 dark:hover:border-c-border-subtle transition-all group shadow-sm dark:shadow-none">
                      <Briefcase
                        size={20}
                        className="text-primary-600 dark:text-blue-400 mb-2 group-hover:scale-110 transition-transform"
                      />
                      <div className="text-2xl font-bold text-navy-900 dark:text-white">
                        {project.workstreams?.length || 0}
                      </div>
                      <div className="text-[10px] text-c-text-muted font-bold uppercase">
                        Workstreams
                      </div>
                    </div>
                    <div className="bg-c-surface/60 border border-c-border-subtle p-4 rounded-xl hover:border-success-500/30 dark:hover:border-c-border-subtle transition-all group shadow-sm dark:shadow-none">
                      <Target
                        size={20}
                        className="text-success-600 dark:text-green-400 mb-2 group-hover:scale-110 transition-transform"
                      />
                      <div className="text-2xl font-bold text-navy-900 dark:text-white">
                        {project.initiatives?.length || 0}
                      </div>
                      <div className="text-[10px] text-c-text-muted font-bold uppercase">
                        Initiatives
                      </div>
                    </div>
                    <div className="bg-c-surface/60 border border-c-border-subtle p-4 rounded-xl hover:border-primary-500/30 dark:hover:border-c-border-subtle transition-all group shadow-sm dark:shadow-none">
                      <PieChart
                        size={20}
                        className="text-primary-500 dark:text-amber-400 mb-2 group-hover:scale-110 transition-transform"
                      />
                      <div className="text-2xl font-bold text-navy-900 dark:text-white">
                        {project.assessments?.length || 0}
                      </div>
                      <div className="text-[10px] text-c-text-muted font-bold uppercase">
                        Assessments
                      </div>
                    </div>
                    <div className="bg-c-surface/60 border border-c-border-subtle p-4 rounded-xl hover:border-secondary-500/30 dark:hover:border-c-border-subtle transition-all group shadow-sm dark:shadow-none">
                      <FileText
                        size={20}
                        className="text-secondary-600 dark:text-indigo-400 mb-2 group-hover:scale-110 transition-transform"
                      />
                      <div className="text-2xl font-bold text-navy-900 dark:text-white">
                        {project.documents?.length || 0}
                      </div>
                      <div className="text-[10px] text-c-text-muted font-bold uppercase">
                        Documents
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {/* Project Ownership Panel - DBR77 Compatible */}
              <div className="bg-c-surface border border-c-border-subtle rounded-xl p-6 shadow-sm dark:shadow-none">
                <h3 className="text-sm font-bold text-c-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-primary-600 dark:text-primary-400" />
                  Project Director
                </h3>
                <div className="flex items-center gap-4 bg-c-surface-raised p-4 rounded-xl border border-c-border-subtle">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {project.owner_first_name?.[0] || 'U'}
                  </div>
                  <div>
                    <div className="text-navy-900 dark:text-white font-bold">
                      {project.owner_first_name} {project.owner_last_name}
                    </div>
                    <div className="text-xs text-c-text-muted">
                      Account Executive
                    </div>
                  </div>
                </div>
              </div>

              {/* Security & Access - DBR77 Compatible */}
              <div className="bg-c-surface border border-c-border-subtle rounded-xl p-6 shadow-sm dark:shadow-none">
                <h3 className="text-sm font-bold text-c-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Lock size={16} className="text-primary-500 dark:text-amber-400" />
                  Data Governance
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-c-text-muted">Visibility</span>
                    <span className="text-c-text-secondary px-2 py-0.5 bg-c-surface-raised dark:bg-c-surface/5 rounded">
                      Org Wide
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-c-text-muted">AI Processing</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-success-500/10 text-success-600 dark:text-emerald-400 border border-success-500/20">
                      <Check size={12} /> Active
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-c-text-muted">Data Residency</span>
                    <span className="text-c-text-secondary flex items-center gap-1">
                      <Globe size={12} /> EU (AWS)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TEAM TAB --- */}
        {activeTab === 'team' && (
          <div className="animate-in fade-in duration-300">
            <div className="space-y-6">
              <ProjectTeamPanel projectId={projectId} canManageTeam />
              <ProjectTeamBoard projectId={projectId} projectName={project.name} />
            </div>
          </div>
        )}

        {/* --- INITIATIVES TAB --- */}
        {activeTab === 'initiatives' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-c-text">Project Initiatives</h3>
              <button className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-green-900/20">
                <Plus size={16} /> New Initiative
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {project.initiatives?.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-c-surface/50 border border-dashed border-c-border-subtle rounded-xl text-c-text-muted">
                  No initiatives defined for this project.
                </div>
              ) : (
                project.initiatives?.map((item: any) => (
                  <div
                    key={item.id}
                    className="bg-c-surface border border-c-border-subtle p-6 rounded-xl hover:border-primary-500/30 transition-all flex justify-between items-start group"
                  >
                    <div>
                      <h4 className="font-bold text-c-text mb-1 group-hover:text-primary-400 transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-xs text-c-text-muted mb-4">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded uppercase">
                          {item.status}
                        </span>
                        <span className="text-[10px] text-c-text-secondary">
                          ROI: {item.expected_roi || 'TBD'}
                        </span>
                      </div>
                    </div>
                    <button className="p-2 text-c-text-secondary hover:text-white transition-colors">
                      <Edit size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* --- ASSESSMENTS TAB --- */}
        {activeTab === 'assessments' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-c-text">Project Assessments</h3>
              <button className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-xl text-sm font-bold shadow-lg shadow-primary-900/20">
                <Plus size={16} /> Run New Assessment
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {project.assessments?.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-c-surface/50 border border-dashed border-c-border-subtle rounded-xl text-c-text-muted">
                  No multi-framework assessments found.
                </div>
              ) : (
                project.assessments?.map((item: any) => (
                  <div
                    key={item.id}
                    className="bg-c-surface border border-c-border-subtle p-6 rounded-xl hover:bg-c-surface-raised transition-all group"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                        <PieChart size={20} />
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                          item.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-yellow-500/10 text-yellow-500'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <h4 className="font-bold text-c-text mb-2 group-hover:text-amber-400 transition-colors">
                      {item.framework} Diagnostic
                    </h4>
                    <div className="flex justify-between items-center mt-6">
                      <div className="text-[10px] text-c-text-muted uppercase tracking-widest font-bold">
                        Maturity Score
                      </div>
                      <div className="text-xl font-black text-c-text">
                        {item.result_score || '--'}/5
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* --- DOCUMENTS TAB --- */}
        {activeTab === 'documents' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
            {/* Upload Panel */}
            <div className="bg-c-surface border border-c-border-subtle p-8 rounded-xl shadow-xl">
              <h3 className="text-xl font-bold text-c-text mb-6 flex items-center gap-2">
                <Upload size={22} className="text-blue-500" />
                Project Document Ingestion
              </h3>
              <form onSubmit={handleUploadDocument} className="flex gap-4 items-center">
                <div className="flex-1 relative">
                  <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="bg-c-bg border-2 border-dashed border-c-border-subtle rounded-xl p-4 text-center transition-all hover:bg-c-surface-raised/20 hover:border-blue-500 group">
                    {uploadFile ? (
                      <span className="text-blue-400 font-bold flex justify-center items-center gap-2">
                        <FileText size={18} /> {uploadFile.name}
                      </span>
                    ) : (
                      <span className="text-c-text-muted text-sm group-hover:text-slate-300 transition-colors italic">
                        Drag & drop files to ingest into project brain...
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!uploadFile || uploading}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/30 transition-all"
                >
                  {uploading ? (
                    <RefreshCw className="animate-spin" size={20} />
                  ) : (
                    <Upload size={20} />
                  )}
                  {uploading ? 'Analyzing...' : 'Ingest'}
                </button>
              </form>
            </div>

            {/* Documents List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {project.documents?.length === 0 ? (
                <div className="col-span-full py-12 text-center text-c-text-muted bg-c-surface/30 border border-dashed border-c-border-subtle rounded-xl">
                  No documents ingested for this project.
                </div>
              ) : (
                project.documents?.map((item: any) => (
                  <div
                    key={item.id}
                    className="bg-c-surface border border-c-border-subtle p-4 rounded-xl hover:border-blue-500/30 transition-all flex justify-between items-center group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-c-bg rounded-xl">
                        <FileText className="text-blue-400" size={22} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-c-text truncate max-w-[150px]">
                          {item.filename}
                        </div>
                        <div className="text-[10px] text-c-text-muted">
                          {new Date(item.created_at || item.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-c-text-secondary hover:text-danger-400 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetailsView;
