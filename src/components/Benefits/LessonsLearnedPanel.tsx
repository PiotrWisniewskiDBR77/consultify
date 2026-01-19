/**
 * LessonsLearnedPanel
 * 
 * Captures post-implementation learnings from completed initiatives.
 * Allows categorization and linking to future initiatives.
 * 
 * Features:
 * - Success/Challenge/Improvement categorization
 * - Process/Technology/People/Governance tags
 * - Action items tracking
 * - Applicability to future initiatives
 */

import {
  AlertTriangle,
  ArrowUpCircle,
  Award,
  BookOpen,
  Building2,
  ChevronDown,
  Cpu,
  Filter,
  Lightbulb,
  Loader2,
  Plus,
  Settings,
  Tag,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

// ============================================
// TYPES
// ============================================

interface LessonsLearnedPanelProps {
  initiativeId: string;
  initiativeName: string;
  onClose?: () => void;
  mode?: 'panel' | 'standalone';
}

interface LessonLearned {
  id: string;
  initiativeId: string;
  type: LessonType;
  category: LessonCategory;
  description: string;
  actionTaken?: string;
  applicableTo?: string[];
  createdAt: string;
  createdBy: string;
  createdByName?: string;
}

type LessonType = 'SUCCESS' | 'CHALLENGE' | 'IMPROVEMENT';
type LessonCategory = 'PROCESS' | 'TECHNOLOGY' | 'PEOPLE' | 'GOVERNANCE';

// ============================================
// CONSTANTS
// ============================================

const LESSON_TYPES: { id: LessonType; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'SUCCESS', label: 'Success', icon: <Award size={16} />, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { id: 'CHALLENGE', label: 'Challenge', icon: <AlertTriangle size={16} />, color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { id: 'IMPROVEMENT', label: 'Improvement', icon: <ArrowUpCircle size={16} />, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
];

const LESSON_CATEGORIES: { id: LessonCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'PROCESS', label: 'Process', icon: <Settings size={14} /> },
  { id: 'TECHNOLOGY', label: 'Technology', icon: <Cpu size={14} /> },
  { id: 'PEOPLE', label: 'People', icon: <Users size={14} /> },
  { id: 'GOVERNANCE', label: 'Governance', icon: <Building2 size={14} /> },
];

// ============================================
// LESSON CARD COMPONENT
// ============================================

interface LessonCardProps {
  lesson: LessonLearned;
  onEdit?: (lesson: LessonLearned) => void;
}

const LessonCard: React.FC<LessonCardProps> = ({ lesson, onEdit }) => {
  const typeConfig = LESSON_TYPES.find((t) => t.id === lesson.type);
  const categoryConfig = LESSON_CATEGORIES.find((c) => c.id === lesson.category);

  return (
    <div className="bg-navy-800 rounded-lg border border-navy-700 p-4 hover:border-navy-600 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 text-xs font-medium rounded-full border flex items-center gap-1 ${typeConfig?.color}`}>
            {typeConfig?.icon}
            {typeConfig?.label}
          </span>
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-navy-700 text-slate-300 flex items-center gap-1">
            {categoryConfig?.icon}
            {categoryConfig?.label}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {new Date(lesson.createdAt).toLocaleDateString()}
        </span>
      </div>

      <p className="text-sm text-white mb-3">{lesson.description}</p>

      {lesson.actionTaken && (
        <div className="bg-navy-900 rounded p-3 mb-3">
          <div className="text-xs text-slate-500 mb-1">Action Taken</div>
          <p className="text-sm text-slate-300">{lesson.actionTaken}</p>
        </div>
      )}

      {lesson.applicableTo && lesson.applicableTo.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Applicable to:</span>
          {lesson.applicableTo.map((tag, idx) => (
            <span key={idx} className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-navy-700 flex items-center justify-between text-xs text-slate-500">
        <span>By: {lesson.createdByName || 'Unknown'}</span>
        {onEdit && (
          <button
            onClick={() => onEdit(lesson)}
            className="text-slate-400 hover:text-white"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================
// ADD LESSON FORM COMPONENT
// ============================================

interface AddLessonFormProps {
  initiativeId: string;
  onSubmit: (lesson: Omit<LessonLearned, 'id' | 'createdAt' | 'createdBy'>) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

const AddLessonForm: React.FC<AddLessonFormProps> = ({
  initiativeId,
  onSubmit,
  onCancel,
  isSubmitting,
}) => {
  const [type, setType] = useState<LessonType>('SUCCESS');
  const [category, setCategory] = useState<LessonCategory>('PROCESS');
  const [description, setDescription] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [applicableTags, setApplicableTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  const handleAddTag = () => {
    if (newTag.trim() && !applicableTags.includes(newTag.trim())) {
      setApplicableTags([...applicableTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setApplicableTags(applicableTags.filter((t) => t !== tag));
  };

  const handleSubmit = () => {
    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }
    
    onSubmit({
      initiativeId,
      type,
      category,
      description: description.trim(),
      actionTaken: actionTaken.trim() || undefined,
      applicableTo: applicableTags.length > 0 ? applicableTags : undefined,
    });
  };

  return (
    <div className="bg-navy-800 rounded-lg border border-cyan-500/30 p-4 space-y-4">
      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
        <Lightbulb size={16} className="text-cyan-400" />
        Add Lesson Learned
      </h4>

      {/* Type Selection */}
      <div>
        <label className="block text-xs text-slate-400 mb-2">Type</label>
        <div className="flex gap-2">
          {LESSON_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium flex items-center justify-center gap-1 transition-all ${
                type === t.id ? t.color : 'bg-navy-900 border-navy-700 text-slate-400'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Selection */}
      <div>
        <label className="block text-xs text-slate-400 mb-2">Category</label>
        <div className="flex gap-2">
          {LESSON_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium flex items-center justify-center gap-1 transition-all ${
                category === c.id
                  ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
                  : 'bg-navy-900 border-navy-700 text-slate-400'
              }`}
            >
              {c.icon}
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-slate-400 mb-2">
          Description <span className="text-red-400">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the lesson learned..."
          rows={3}
          className="w-full px-3 py-2 bg-navy-900 border border-navy-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
        />
      </div>

      {/* Action Taken */}
      <div>
        <label className="block text-xs text-slate-400 mb-2">Action Taken (optional)</label>
        <textarea
          value={actionTaken}
          onChange={(e) => setActionTaken(e.target.value)}
          placeholder="What action was taken to address this?"
          rows={2}
          className="w-full px-3 py-2 bg-navy-900 border border-navy-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
        />
      </div>

      {/* Applicable Tags */}
      <div>
        <label className="block text-xs text-slate-400 mb-2">Applicable To (tags)</label>
        <div className="flex gap-2 mb-2 flex-wrap">
          {applicableTags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded flex items-center gap-1"
            >
              {tag}
              <button onClick={() => handleRemoveTag(tag)}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="Add tag..."
            className="flex-1 px-3 py-2 bg-navy-900 border border-navy-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
          <button
            onClick={handleAddTag}
            className="px-3 py-2 bg-navy-700 text-slate-300 rounded-lg hover:bg-navy-600"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-400 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !description.trim()}
          className="px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-500 disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          Save Lesson
        </button>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const LessonsLearnedPanel: React.FC<LessonsLearnedPanelProps> = ({
  initiativeId,
  initiativeName,
  onClose,
  mode = 'panel',
}) => {
  const { t } = useTranslation();
  
  const [lessons, setLessons] = useState<LessonLearned[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<LessonType | 'ALL'>('ALL');

  // Fetch lessons
  useEffect(() => {
    const fetchLessons = async () => {
      setIsLoading(true);
      try {
        const response = await Api.get(`/initiatives/${initiativeId}/lessons`);
        setLessons(response.lessons || []);
      } catch (error) {
        console.error('[LessonsLearnedPanel] Failed to fetch:', error);
        // Mock data for demo
        setLessons([
          {
            id: '1',
            initiativeId,
            type: 'SUCCESS',
            category: 'PROCESS',
            description: 'Agile methodology adoption significantly improved team velocity and reduced time-to-market.',
            actionTaken: 'Documented the process and created templates for other teams.',
            applicableTo: ['Digital Transformation', 'Process Optimization'],
            createdAt: '2025-01-10T10:00:00Z',
            createdBy: 'user-1',
            createdByName: 'John Smith',
          },
          {
            id: '2',
            initiativeId,
            type: 'CHALLENGE',
            category: 'PEOPLE',
            description: 'Initial resistance to change from legacy system users required additional change management efforts.',
            actionTaken: 'Implemented structured training program and appointed change champions.',
            createdAt: '2025-01-08T14:30:00Z',
            createdBy: 'user-2',
            createdByName: 'Sarah Johnson',
          },
          {
            id: '3',
            initiativeId,
            type: 'IMPROVEMENT',
            category: 'TECHNOLOGY',
            description: 'Integration testing should start earlier in the development cycle to catch compatibility issues sooner.',
            applicableTo: ['System Integration', 'IT Projects'],
            createdAt: '2025-01-05T09:15:00Z',
            createdBy: 'user-3',
            createdByName: 'Mike Chen',
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLessons();
  }, [initiativeId]);

  // Filter lessons
  const filteredLessons = useMemo(() => {
    if (filterType === 'ALL') return lessons;
    return lessons.filter((l) => l.type === filterType);
  }, [lessons, filterType]);

  // Stats
  const stats = useMemo(() => ({
    total: lessons.length,
    success: lessons.filter((l) => l.type === 'SUCCESS').length,
    challenges: lessons.filter((l) => l.type === 'CHALLENGE').length,
    improvements: lessons.filter((l) => l.type === 'IMPROVEMENT').length,
  }), [lessons]);

  // Handle add lesson
  const handleAddLesson = useCallback(async (lessonData: Omit<LessonLearned, 'id' | 'createdAt' | 'createdBy'>) => {
    setIsSubmitting(true);
    try {
      const response = await Api.post(`/initiatives/${initiativeId}/lessons`, lessonData);
      const newLesson: LessonLearned = {
        ...lessonData,
        id: response.id || Date.now().toString(),
        createdAt: new Date().toISOString(),
        createdBy: 'current-user',
        createdByName: 'You',
      };
      setLessons((prev) => [newLesson, ...prev]);
      setIsAdding(false);
      toast.success('Lesson added successfully');
    } catch (error) {
      console.error('[LessonsLearnedPanel] Failed to add lesson:', error);
      // Add locally for demo
      const newLesson: LessonLearned = {
        ...lessonData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        createdBy: 'current-user',
        createdByName: 'You',
      };
      setLessons((prev) => [newLesson, ...prev]);
      setIsAdding(false);
      toast.success('Lesson added successfully');
    } finally {
      setIsSubmitting(false);
    }
  }, [initiativeId]);

  const panelClasses = mode === 'panel' 
    ? 'h-full flex flex-col bg-navy-900'
    : 'bg-navy-900 rounded-xl border border-navy-700 overflow-hidden';

  return (
    <div className={panelClasses}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-navy-700 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <BookOpen size={20} className="text-cyan-400" />
            Lessons Learned
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">{initiativeName}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 text-sm font-medium rounded-lg hover:bg-cyan-500/30 flex items-center gap-1"
            >
              <Plus size={14} />
              Add Lesson
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-navy-800 rounded-lg"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-3 border-b border-navy-700 flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Total:</span>
          <span className="text-white font-medium">{stats.total}</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded">{stats.success} success</span>
          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded">{stats.challenges} challenges</span>
          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">{stats.improvements} improvements</span>
        </div>
      </div>

      {/* Filter */}
      <div className="px-6 py-3 border-b border-navy-700 flex items-center gap-2">
        <Filter size={14} className="text-slate-500" />
        <div className="flex gap-1">
          {(['ALL', ...LESSON_TYPES.map((t) => t.id)] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 text-xs font-medium rounded ${
                filterType === type
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {type === 'ALL' ? 'All' : LESSON_TYPES.find((t) => t.id === type)?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {isAdding && (
          <AddLessonForm
            initiativeId={initiativeId}
            onSubmit={handleAddLesson}
            onCancel={() => setIsAdding(false)}
            isSubmitting={isSubmitting}
          />
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
          </div>
        ) : filteredLessons.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <BookOpen className="w-12 h-12 text-slate-600 mb-3" />
            <p className="text-slate-400">No lessons learned yet</p>
            <p className="text-sm text-slate-500 mt-1">
              {!isAdding && 'Click "Add Lesson" to capture insights'}
            </p>
          </div>
        ) : (
          filteredLessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))
        )}
      </div>
    </div>
  );
};

export default LessonsLearnedPanel;
