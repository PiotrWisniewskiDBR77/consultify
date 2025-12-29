import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Building2, FolderKanban, Users, Plus, X, Save, Loader2, 
  MapPin, Briefcase, ChevronDown, Check, AlertCircle, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * User Assignments Panel Component
 * 
 * Manages user assignments to:
 * - Facilities (locations) with roles
 * - Projects with PMO roles
 * 
 * Shows effective capabilities from all assignments.
 * Part of Work Dimensions System.
 */

interface UserAssignment {
  userId: string;
  userName: string;
}

interface FacilityAssignment {
  facilityId: string;
  facilityName: string;
  role: 'manager' | 'lead' | 'member' | 'viewer';
  assignmentType: 'primary' | 'secondary' | 'temporary';
  permissions: {
    canViewAllTasks: boolean;
    canManageUsers: boolean;
    canEditFacility: boolean;
  };
}

interface ProjectAssignment {
  projectId: string;
  projectName: string;
  pmoRole: {
    id: string;
    code: string;
    name: string;
    namePl: string;
    level: number;
  } | null;
  allocationPercent: number;
}

interface PMORole {
  id: string;
  code: string;
  name: string;
  namePl: string;
  level: number;
  levelName: string;
  description: string;
  descriptionPl: string;
}

interface Facility {
  id: string;
  name: string;
  code?: string;
}

interface Project {
  id: string;
  name: string;
}

interface WorkModeConfig {
  workMode: string;
  hasProjects: boolean;
  hasLocations: boolean;
  labels: {
    project: string;
    location: string;
  };
}

interface UserAssignmentsPanelProps {
  userId: string;
  userName: string;
  onClose: () => void;
  onSave?: () => void;
}

const FACILITY_ROLES = [
  { value: 'manager', label: 'Manager', labelPl: 'Menedżer' },
  { value: 'lead', label: 'Lead', labelPl: 'Lider' },
  { value: 'member', label: 'Member', labelPl: 'Członek' },
  { value: 'viewer', label: 'Viewer', labelPl: 'Obserwator' }
];

const ASSIGNMENT_TYPES = [
  { value: 'primary', label: 'Primary', labelPl: 'Główna' },
  { value: 'secondary', label: 'Secondary', labelPl: 'Dodatkowa' },
  { value: 'temporary', label: 'Temporary', labelPl: 'Tymczasowa' }
];

export const UserAssignmentsPanel: React.FC<UserAssignmentsPanelProps> = ({
  userId,
  userName,
  onClose,
  onSave
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language === 'pl';

  // State
  const [workModeConfig, setWorkModeConfig] = useState<WorkModeConfig | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pmoRoles, setPmoRoles] = useState<PMORole[]>([]);
  const [facilityAssignments, setFacilityAssignments] = useState<FacilityAssignment[]>([]);
  const [projectAssignments, setProjectAssignments] = useState<ProjectAssignment[]>([]);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'facilities' | 'projects' | 'capabilities'>('facilities');

  // New assignment form state
  const [showAddFacility, setShowAddFacility] = useState(false);
  const [newFacility, setNewFacility] = useState({
    facilityId: '',
    role: 'member' as const,
    assignmentType: 'primary' as const
  });
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProject, setNewProject] = useState({
    projectId: '',
    pmoRoleId: '',
    allocationPercent: 100
  });

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch work mode config
      const configRes = await fetch('/api/org/work-mode', { headers });
      const configData = await configRes.json();
      setWorkModeConfig(configData);

      // Fetch available facilities and projects in parallel
      const [facilitiesRes, projectsRes, rolesRes] = await Promise.all([
        fetch('/api/locations', { headers }),
        fetch('/api/projects', { headers }),
        fetch('/api/pmo-roles', { headers })
      ]);

      const [facilitiesData, projectsData, rolesData] = await Promise.all([
        facilitiesRes.json(),
        projectsRes.json(),
        rolesRes.json()
      ]);

      setFacilities(Array.isArray(facilitiesData) ? facilitiesData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setPmoRoles(Array.isArray(rolesData) ? rolesData : []);

      // Fetch user's current assignments
      const [userFacilitiesRes, userProjectsRes, capabilitiesRes] = await Promise.all([
        fetch(`/api/locations/users/${userId}/facilities`, { headers }),
        fetch(`/api/pmo-roles/users/${userId}/project-roles`, { headers }),
        fetch('/api/org/work-mode/capabilities', { headers })
      ]);

      if (userFacilitiesRes.ok) {
        const data = await userFacilitiesRes.json();
        setFacilityAssignments(Array.isArray(data) ? data : []);
      }

      if (userProjectsRes.ok) {
        const data = await userProjectsRes.json();
        setProjectAssignments(Array.isArray(data) ? data : []);
      }

      if (capabilitiesRes.ok) {
        const data = await capabilitiesRes.json();
        setCapabilities(data.capabilities || []);
      }

      // Set initial tab based on work mode
      if (configData.hasLocations) {
        setActiveTab('facilities');
      } else if (configData.hasProjects) {
        setActiveTab('projects');
      }

    } catch (err) {
      console.error('Failed to fetch assignment data:', err);
      toast.error(t('admin.assignments.fetchError', 'Failed to load assignment data'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFacility = async () => {
    if (!newFacility.facilityId) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/locations/facilities/${newFacility.facilityId}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          userId,
          role: newFacility.role,
          assignmentType: newFacility.assignmentType
        })
      });

      if (res.ok) {
        toast.success(t('admin.assignments.facilityAdded', 'User assigned to location'));
        setShowAddFacility(false);
        setNewFacility({ facilityId: '', role: 'member', assignmentType: 'primary' });
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || t('admin.assignments.assignError', 'Failed to assign'));
      }
    } catch (err) {
      toast.error(t('admin.assignments.assignError', 'Failed to assign'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveFacility = async (facilityId: string) => {
    if (!confirm(t('admin.assignments.confirmRemove', 'Remove this assignment?'))) return;

    try {
      const res = await fetch(`/api/locations/facilities/${facilityId}/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (res.ok) {
        toast.success(t('admin.assignments.removed', 'Assignment removed'));
        fetchData();
      }
    } catch (err) {
      toast.error(t('admin.assignments.removeError', 'Failed to remove'));
    }
  };

  const handleAddProject = async () => {
    if (!newProject.projectId || !newProject.pmoRoleId) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/pmo-roles/projects/${newProject.projectId}/team`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          userId,
          pmoRoleId: newProject.pmoRoleId,
          allocationPercent: newProject.allocationPercent
        })
      });

      if (res.ok) {
        toast.success(t('admin.assignments.projectAdded', 'User assigned to project'));
        setShowAddProject(false);
        setNewProject({ projectId: '', pmoRoleId: '', allocationPercent: 100 });
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || t('admin.assignments.assignError', 'Failed to assign'));
      }
    } catch (err) {
      toast.error(t('admin.assignments.assignError', 'Failed to assign'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveProject = async (projectId: string) => {
    if (!confirm(t('admin.assignments.confirmRemove', 'Remove this assignment?'))) return;

    try {
      const res = await fetch(`/api/pmo-roles/projects/${projectId}/team/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (res.ok) {
        toast.success(t('admin.assignments.removed', 'Assignment removed'));
        fetchData();
      }
    } catch (err) {
      toast.error(t('admin.assignments.removeError', 'Failed to remove'));
    }
  };

  const pmoRolesByLevel = pmoRoles.reduce((acc, role) => {
    const level = role.levelName || `Level ${role.level}`;
    if (!acc[level]) acc[level] = [];
    acc[level].push(role);
    return acc;
  }, {} as Record<string, PMORole[]>);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {t('admin.assignments.title', 'User Assignments')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {userName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            {workModeConfig?.hasLocations && (
              <button
                onClick={() => setActiveTab('facilities')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'facilities'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {workModeConfig.labels.location || t('admin.assignments.locations', 'Locations')}
                  <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-xs">
                    {facilityAssignments.length}
                  </span>
                </div>
              </button>
            )}
            {workModeConfig?.hasProjects && (
              <button
                onClick={() => setActiveTab('projects')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'projects'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4" />
                  {workModeConfig.labels.project || t('admin.assignments.projects', 'Projects')}
                  <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-xs">
                    {projectAssignments.length}
                  </span>
                </div>
              </button>
            )}
            <button
              onClick={() => setActiveTab('capabilities')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'capabilities'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {t('admin.assignments.capabilities', 'Capabilities')}
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Facilities Tab */}
          {activeTab === 'facilities' && (
            <div className="space-y-4">
              {/* Add Button */}
              {!showAddFacility && (
                <button
                  onClick={() => setShowAddFacility(true)}
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 
                           hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  {t('admin.assignments.addLocation', 'Add Location')}
                </button>
              )}

              {/* Add Form */}
              {showAddFacility && (
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {workModeConfig?.labels.location || 'Location'}
                      </label>
                      <select
                        value={newFacility.facilityId}
                        onChange={(e) => setNewFacility(prev => ({ ...prev, facilityId: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">{t('common.select', 'Select...')}</option>
                        {facilities.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('admin.assignments.role', 'Role')}
                      </label>
                      <select
                        value={newFacility.role}
                        onChange={(e) => setNewFacility(prev => ({ ...prev, role: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        {FACILITY_ROLES.map(r => (
                          <option key={r.value} value={r.value}>
                            {isPl ? r.labelPl : r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('admin.assignments.type', 'Type')}
                      </label>
                      <select
                        value={newFacility.assignmentType}
                        onChange={(e) => setNewFacility(prev => ({ ...prev, assignmentType: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        {ASSIGNMENT_TYPES.map(t => (
                          <option key={t.value} value={t.value}>
                            {isPl ? t.labelPl : t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowAddFacility(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                      onClick={handleAddFacility}
                      disabled={!newFacility.facilityId || isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md
                               hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {t('common.add', 'Add')}
                    </button>
                  </div>
                </div>
              )}

              {/* Assignments List */}
              {facilityAssignments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{t('admin.assignments.noLocations', 'No location assignments')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {facilityAssignments.map((a) => (
                    <div
                      key={a.facilityId}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                          <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {a.facilityName}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="capitalize">{a.role}</span>
                            <span>•</span>
                            <span className="capitalize">{a.assignmentType}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFacility(a.facilityId)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Projects Tab */}
          {activeTab === 'projects' && (
            <div className="space-y-4">
              {/* Add Button */}
              {!showAddProject && (
                <button
                  onClick={() => setShowAddProject(true)}
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 
                           hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  {t('admin.assignments.addProject', 'Add Project')}
                </button>
              )}

              {/* Add Form */}
              {showAddProject && (
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {workModeConfig?.labels.project || 'Project'}
                      </label>
                      <select
                        value={newProject.projectId}
                        onChange={(e) => setNewProject(prev => ({ ...prev, projectId: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">{t('common.select', 'Select...')}</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('admin.assignments.pmoRole', 'PMO Role')}
                      </label>
                      <select
                        value={newProject.pmoRoleId}
                        onChange={(e) => setNewProject(prev => ({ ...prev, pmoRoleId: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">{t('common.select', 'Select...')}</option>
                        {Object.entries(pmoRolesByLevel).map(([level, roles]) => (
                          <optgroup key={level} label={level}>
                            {roles.map(r => (
                              <option key={r.id} value={r.id}>
                                {isPl ? r.namePl : r.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('admin.assignments.allocation', 'Allocation %')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={newProject.allocationPercent}
                        onChange={(e) => setNewProject(prev => ({ ...prev, allocationPercent: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowAddProject(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                      onClick={handleAddProject}
                      disabled={!newProject.projectId || !newProject.pmoRoleId || isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md
                               hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {t('common.add', 'Add')}
                    </button>
                  </div>
                </div>
              )}

              {/* Assignments List */}
              {projectAssignments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{t('admin.assignments.noProjects', 'No project assignments')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {projectAssignments.map((a) => (
                    <div
                      key={a.projectId}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                          <FolderKanban className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {a.projectName}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{isPl ? a.pmoRole?.namePl : a.pmoRole?.name || 'No role'}</span>
                            <span>•</span>
                            <span>{a.allocationPercent}%</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveProject(a.projectId)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Capabilities Tab */}
          {activeTab === 'capabilities' && (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('admin.assignments.capabilitiesHelp', 'Effective capabilities computed from all role assignments.')}
              </p>
              
              {capabilities.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{t('admin.assignments.noCapabilities', 'No capabilities assigned')}</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {capabilities.map((cap, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 
                               text-blue-800 dark:text-blue-200 rounded-full text-sm"
                    >
                      <Check className="h-3 w-3" />
                      {cap}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 
                     rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserAssignmentsPanel;

