/**
 * LessonsLearnedPanel
 *
 * Panel for capturing and viewing post-implementation learnings.
 */

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

// ============================================
// TYPES
// ============================================

export type LessonType = 'SUCCESS' | 'CHALLENGE' | 'IMPROVEMENT';
export type LessonCategory = 'PROCESS' | 'TECHNOLOGY' | 'PEOPLE' | 'GOVERNANCE';

export interface LessonLearned {
  id: string;
  initiativeId: string;
  initiativeName?: string;
  type: LessonType;
  description: string;
  category: LessonCategory;
  actionTaken?: string;
  applicableTo?: string[];
  createdAt: string;
  createdBy: string;
  createdByName?: string;
}

interface LessonsLearnedPanelProps {
  initiativeId?: string;
  initiativeName?: string;
  className?: string;
}

// ============================================
// CONFIG
// ============================================

const LESSON_TYPE_CONFIG: Record<
  LessonType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  SUCCESS: {
    label: 'Success',
    icon: <CheckCircle2 size={16} />,
    color: 'green',
  },
  CHALLENGE: {
    label: 'Challenge',
    icon: <AlertTriangle size={16} />,
    color: 'amber',
  },
  IMPROVEMENT: {
    label: 'Improvement',
    icon: <Lightbulb size={16} />,
    color: 'blue',
  },
};

const LESSON_CATEGORY_CONFIG: Record<LessonCategory, { label: string; color: string }> = {
  PROCESS: { label: 'Process', color: 'purple' },
  TECHNOLOGY: { label: 'Technology', color: 'cyan' },
  PEOPLE: { label: 'People', color: 'pink' },
  GOVERNANCE: { label: 'Governance', color: 'slate' },
};

// ============================================
// LESSON CARD COMPONENT
// ============================================

interface LessonCardProps {
  lesson: LessonLearned;
}

const LessonCard: React.FC<LessonCardProps> = ({ lesson }) => {
  const [expanded, setExpanded] = useState(false);
  const typeConfig = LESSON_TYPE_CONFIG[lesson.type];
  const categoryConfig = LESSON_CATEGORY_CONFIG[lesson.category];

  const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    green: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
  };

  const colors = colorClasses[typeConfig.color];

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full p-4 text-left">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>{typeConfig.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}
              >
                {typeConfig.label}
              </span>
              <span className="text-xs text-slate-500 px-2 py-0.5 rounded-full bg-slate-200 dark:bg-navy-700">
                {categoryConfig.label}
              </span>
            </div>
            <p className="text-sm text-slate-900 dark:text-white line-clamp-2">
              {lesson.description}
            </p>
            {lesson.initiativeName && (
              <p className="text-xs text-slate-500 mt-1">From: {lesson.initiativeName}</p>
            )}
          </div>
          <div className="text-slate-500 dark:text-slate-400">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-200 dark:border-navy-700/50 pt-3">
          {lesson.actionTaken && (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-slate-600 mb-1">Action Taken</h4>
              <p className="text-sm text-slate-600">{lesson.actionTaken}</p>
            </div>
          )}

          {lesson.applicableTo && lesson.applicableTo.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-slate-600 mb-1">Applicable To</h4>
              <div className="flex flex-wrap gap-1">
                {lesson.applicableTo.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200 dark:border-navy-700/50">
            <span>
              Added {new Date(lesson.createdAt).toLocaleDateString()}
              {lesson.createdByName && ` by ${lesson.createdByName}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// ADD LESSON MODAL
// ============================================

interface AddLessonModalProps {
  initiativeId: string;
  initiativeName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const AddLessonModal: React.FC<AddLessonModalProps> = ({
  initiativeId,
  initiativeName,
  onClose,
  onSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    type: 'SUCCESS' as LessonType,
    category: 'PROCESS' as LessonCategory,
    description: '',
    actionTaken: '',
    applicableTo: '',
  });

  const handleSubmit = async () => {
    if (!formData.description.trim()) {
      toast.error('Description is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await Api.post(`/initiatives/${initiativeId}/lessons`, {
        type: formData.type,
        category: formData.category,
        description: formData.description,
        actionTaken: formData.actionTaken || undefined,
        applicableTo: formData.applicableTo
          ? formData.applicableTo
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      });

      toast.success('Lesson added successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[AddLessonModal] Submit error:', error);
      toast.error(error.message || 'Failed to add lesson');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-overlay flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Add Lesson Learned
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{initiativeName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
              Type
            </label>
            <div className="flex gap-2">
              {(
                Object.entries(LESSON_TYPE_CONFIG) as [
                  LessonType,
                  (typeof LESSON_TYPE_CONFIG)[LessonType],
                ][]
              ).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setFormData((prev) => ({ ...prev, type: key }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    formData.type === key
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-slate-50 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700'
                  }`}
                >
                  {config.icon}
                  {config.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {(
                Object.entries(LESSON_CATEGORY_CONFIG) as [
                  LessonCategory,
                  (typeof LESSON_CATEGORY_CONFIG)[LessonCategory],
                ][]
              ).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setFormData((prev) => ({ ...prev, category: key }))}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    formData.category === key
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-50 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700'
                  }`}
                >
                  {config.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the lesson learned..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Action Taken */}
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
              Action Taken (optional)
            </label>
            <textarea
              value={formData.actionTaken}
              onChange={(e) => setFormData((prev) => ({ ...prev, actionTaken: e.target.value }))}
              placeholder="What was done as a result of this learning?"
              rows={2}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Applicable To */}
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
              Applicable To (optional)
            </label>
            <input
              type="text"
              value={formData.applicableTo}
              onChange={(e) => setFormData((prev) => ({ ...prev, applicableTo: e.target.value }))}
              placeholder="e.g., Digital Projects, IT Implementation (comma-separated)"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-navy-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-navy-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            Add Lesson
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN PANEL COMPONENT
// ============================================

export const LessonsLearnedPanel: React.FC<LessonsLearnedPanelProps> = ({
  initiativeId,
  initiativeName,
  className = '',
}) => {
  const [lessons, setLessons] = useState<LessonLearned[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<LessonType | 'ALL'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch lessons
  const fetchLessons = useCallback(async () => {
    setIsLoading(true);
    try {
      const endpoint = initiativeId ? `/initiatives/${initiativeId}/lessons` : '/lessons';

      const response = await Api.get(endpoint);
      setLessons(response.lessons || []);
    } catch (error) {
      console.error('[LessonsLearnedPanel] Fetch error:', error);
      setLessons([]);
      toast.error('Failed to load lessons learned');
    } finally {
      setIsLoading(false);
    }
  }, [initiativeId, initiativeName]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  // Filter lessons
  const filteredLessons = lessons.filter((lesson) => {
    const matchesSearch =
      !searchQuery ||
      lesson.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lesson.actionTaken?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = filterType === 'ALL' || lesson.type === filterType;

    return matchesSearch && matchesType;
  });

  // Stats
  const stats = {
    total: lessons.length,
    successes: lessons.filter((l) => l.type === 'SUCCESS').length,
    challenges: lessons.filter((l) => l.type === 'CHALLENGE').length,
    improvements: lessons.filter((l) => l.type === 'IMPROVEMENT').length,
  };

  return (
    <div
      className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 ${className}`}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lightbulb size={20} className="text-amber-400" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Lessons Learned
            </h3>
          </div>
          {initiativeId && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={16} />
              Add Lesson
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="text-center p-2 bg-slate-50 dark:bg-navy-800 rounded-lg">
            <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
          <div className="text-center p-2 bg-green-500/10 rounded-lg">
            <p className="text-xl font-bold text-green-400">{stats.successes}</p>
            <p className="text-xs text-slate-500">Successes</p>
          </div>
          <div className="text-center p-2 bg-amber-500/10 rounded-lg">
            <p className="text-xl font-bold text-amber-400">{stats.challenges}</p>
            <p className="text-xs text-slate-500">Challenges</p>
          </div>
          <div className="text-center p-2 bg-blue-500/10 rounded-lg">
            <p className="text-xl font-bold text-blue-400">{stats.improvements}</p>
            <p className="text-xs text-slate-500">Improvements</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lessons..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-1">
            {(['ALL', 'SUCCESS', 'CHALLENGE', 'IMPROVEMENT'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  filterType === type
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-50 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700'
                }`}
              >
                {type === 'ALL' ? 'All' : LESSON_TYPE_CONFIG[type].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : filteredLessons.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Lightbulb className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No lessons found</p>
            {initiativeId && (
              <button
                onClick={() => setShowAddModal(true)}
                className="text-blue-400 hover:text-blue-300 text-sm mt-2"
              >
                Add the first lesson
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && initiativeId && initiativeName && (
        <AddLessonModal
          initiativeId={initiativeId}
          initiativeName={initiativeName}
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchLessons}
        />
      )}
    </div>
  );
};

export default LessonsLearnedPanel;
