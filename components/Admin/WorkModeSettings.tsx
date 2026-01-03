import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Building2, Users, FolderKanban, GitBranch, Save, Loader2, 
  AlertTriangle, CheckCircle2, HelpCircle, Tag 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { InfoButton } from '../shared/InfoButton';

/**
 * Work Mode Settings Component
 * 
 * Allows organization admin to configure:
 * - Work mode (SIMPLE, LOCATION_BASED, PROJECT_BASED, FULL)
 * - Custom labels for projects, locations, and teams
 * 
 * Part of Work Dimensions System
 * ISO 21500 / PMBOK / PRINCE2 Compliant
 */

interface WorkModeConfig {
  workMode: 'SIMPLE' | 'LOCATION_BASED' | 'PROJECT_BASED' | 'FULL';
  hasProjects: boolean;
  hasLocations: boolean;
  labels: {
    project: string;
    location: string;
    team: string;
  };
  workModeInfo: {
    name: string;
    namePl: string;
    description: string;
    descriptionPl: string;
  };
}

interface WorkModeOption {
  code: 'SIMPLE' | 'LOCATION_BASED' | 'PROJECT_BASED' | 'FULL';
  name: string;
  namePl: string;
  description: string;
  descriptionPl: string;
  hasLocations: boolean;
  hasProjects: boolean;
  icon: React.ReactNode;
}

const WORK_MODE_OPTIONS: WorkModeOption[] = [
  {
    code: 'SIMPLE',
    name: 'Simple',
    namePl: 'Prosty',
    description: 'Single team without location or project divisions. All users see all tasks.',
    descriptionPl: 'Jeden zespół bez podziału na lokalizacje czy projekty. Wszyscy użytkownicy widzą wszystkie zadania.',
    hasLocations: false,
    hasProjects: false,
    icon: <Users className="h-6 w-6" />
  },
  {
    code: 'LOCATION_BASED',
    name: 'Location-Based',
    namePl: 'Oparty na lokalizacjach',
    description: 'Multiple locations/units. Users are assigned to specific locations and see tasks from their locations.',
    descriptionPl: 'Wiele lokalizacji/jednostek. Użytkownicy przypisani do lokalizacji widzą zadania z tych lokalizacji.',
    hasLocations: true,
    hasProjects: false,
    icon: <Building2 className="h-6 w-6" />
  },
  {
    code: 'PROJECT_BASED',
    name: 'Project-Based',
    namePl: 'Oparty na projektach',
    description: 'Project-centric work. Users assigned to projects with PMO roles. Tasks belong to projects.',
    descriptionPl: 'Praca projektowa. Użytkownicy przypisani do projektów z rolami PMO. Zadania należą do projektów.',
    hasLocations: false,
    hasProjects: true,
    icon: <FolderKanban className="h-6 w-6" />
  },
  {
    code: 'FULL',
    name: 'Full Matrix',
    namePl: 'Pełna matryca',
    description: 'Full matrix organization with both locations and projects. Users can be assigned to both.',
    descriptionPl: 'Pełna organizacja macierzowa z lokalizacjami i projektami. Użytkownicy mogą być przypisani do obu.',
    hasLocations: true,
    hasProjects: true,
    icon: <GitBranch className="h-6 w-6" />
  }
];

export const WorkModeSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language === 'pl';
  
  const [config, setConfig] = useState<WorkModeConfig | null>(null);
  const [selectedMode, setSelectedMode] = useState<WorkModeOption['code']>('SIMPLE');
  const [labels, setLabels] = useState({
    project: 'Project',
    location: 'Location',
    team: 'Team'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showChangeWarning, setShowChangeWarning] = useState(false);
  const [pendingMode, setPendingMode] = useState<WorkModeOption['code'] | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/org/work-mode', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setSelectedMode(data.workMode);
        setLabels(data.labels);
      }
    } catch (err) {
      console.error('Failed to fetch work mode config:', err);
      toast.error(t('admin.workMode.fetchError', 'Failed to load work mode settings'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeSelect = (mode: WorkModeOption['code']) => {
    // If changing to a simpler mode, show warning
    if (config) {
      const currentOption = WORK_MODE_OPTIONS.find(o => o.code === config.workMode);
      const newOption = WORK_MODE_OPTIONS.find(o => o.code === mode);
      
      if (currentOption && newOption) {
        const isDowngrade = 
          (currentOption.hasProjects && !newOption.hasProjects) ||
          (currentOption.hasLocations && !newOption.hasLocations);
        
        if (isDowngrade) {
          setPendingMode(mode);
          setShowChangeWarning(true);
          return;
        }
      }
    }
    
    setSelectedMode(mode);
  };

  const confirmModeChange = () => {
    if (pendingMode) {
      setSelectedMode(pendingMode);
      setPendingMode(null);
    }
    setShowChangeWarning(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/org/work-mode', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          workMode: selectedMode,
          projectLabel: labels.project,
          locationLabel: labels.location,
          teamLabel: labels.team
        })
      });

      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        toast.success(t('admin.workMode.saveSuccess', 'Work mode settings saved successfully'));
      } else {
        const error = await res.json();
        toast.error(error.error || t('admin.workMode.saveError', 'Failed to save settings'));
      }
    } catch (err) {
      console.error('Failed to save work mode:', err);
      toast.error(t('admin.workMode.saveError', 'Failed to save settings'));
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = config && (
    selectedMode !== config.workMode ||
    labels.project !== config.labels.project ||
    labels.location !== config.labels.location ||
    labels.team !== config.labels.team
  );

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <GitBranch className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('admin.workMode.title', 'Work Mode Configuration')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('admin.workMode.subtitle', 'Configure how your organization structures work')}
              </p>
            </div>
          </div>
          <InfoButton
            title={t('admin.workMode.helpTitle', 'Work Mode Help')}
            content={t('admin.workMode.helpContent', 'Work mode determines how tasks and team members are organized. Choose SIMPLE for small teams, LOCATION_BASED for multi-site organizations, PROJECT_BASED for project-centric work, or FULL for matrix organizations.')}
          />
        </div>
      </div>

      {/* Work Mode Selection */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          {t('admin.workMode.selectMode', 'Select Work Mode')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {WORK_MODE_OPTIONS.map((option) => (
            <div
              key={option.code}
              onClick={() => handleModeSelect(option.code)}
              className={`
                relative p-4 rounded-lg border-2 cursor-pointer transition-all
                ${selectedMode === option.code 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'}
              `}
            >
              {selectedMode === option.code && (
                <div className="absolute top-2 right-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                </div>
              )}
              
              <div className="flex items-start gap-3">
                <div className={`
                  p-2 rounded-lg
                  ${selectedMode === option.code 
                    ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-400' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}
                `}>
                  {option.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {isPl ? option.namePl : option.name}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {isPl ? option.descriptionPl : option.description}
                  </p>
                  <div className="flex gap-2 mt-2">
                    {option.hasLocations && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        <Building2 className="h-3 w-3" />
                        {t('admin.workMode.locations', 'Locations')}
                      </span>
                    )}
                    {option.hasProjects && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                        <FolderKanban className="h-3 w-3" />
                        {t('admin.workMode.projects', 'Projects')}
                      </span>
                    )}
                    {!option.hasLocations && !option.hasProjects && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        <Users className="h-3 w-3" />
                        {t('admin.workMode.singleTeam', 'Single Team')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Labels */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Tag className="h-5 w-5 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('admin.workMode.customLabels', 'Custom Labels')}
          </h3>
          <span className="text-xs text-gray-400">
            ({t('admin.workMode.optional', 'optional')})
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {t('admin.workMode.labelsHelp', 'Customize how projects, locations, and teams are named in your organization.')}
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.workMode.projectLabel', 'Project Label')}
            </label>
            <input
              type="text"
              value={labels.project}
              onChange={(e) => setLabels(prev => ({ ...prev, project: e.target.value }))}
              placeholder="Project, Campaign, Engagement..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.workMode.locationLabel', 'Location Label')}
            </label>
            <input
              type="text"
              value={labels.location}
              onChange={(e) => setLabels(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Location, Office, Department..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.workMode.teamLabel', 'Team Label')}
            </label>
            <input
              type="text"
              value={labels.team}
              onChange={(e) => setLabels(prev => ({ ...prev, team: e.target.value }))}
              placeholder="Team, Squad, Pod..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Current Status */}
      {config && (
        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('admin.workMode.currentStatus', 'Current Status')}
          </h3>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {t('admin.workMode.currentMode', 'Current Mode')}:
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {isPl ? config.workModeInfo?.namePl : config.workModeInfo?.name || config.workMode}
              </span>
            </span>
            {config.hasLocations && (
              <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                {t('admin.workMode.locationsEnabled', 'Locations Enabled')}
              </span>
            )}
            {config.hasProjects && (
              <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400">
                <CheckCircle2 className="h-4 w-4" />
                {t('admin.workMode.projectsEnabled', 'Projects Enabled')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="p-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors
            ${hasChanges 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'}
          `}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t('admin.workMode.save', 'Save Changes')}
        </button>
      </div>

      {/* Change Warning Modal */}
      {showChangeWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('admin.workMode.warningTitle', 'Change Work Mode?')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {t('admin.workMode.warningMessage', 
                    'Changing to a simpler work mode may affect existing user assignments and task visibility. This action should be done carefully.')}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowChangeWarning(false);
                  setPendingMode(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={confirmModeChange}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md"
              >
                {t('admin.workMode.confirmChange', 'Confirm Change')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkModeSettings;






