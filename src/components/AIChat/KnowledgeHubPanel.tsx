/**
 * Knowledge Hub Panel
 * 
 * UI component for managing organization knowledge facts and insights.
 * Allows viewing, adding, editing, and verifying knowledge entries.
 * 
 * @version 1.0.0
 */

import {
  AlertTriangle,
  BookOpen,
  Building,
  Check,
  ChevronDown,
  ChevronRight,
  Code,
  Edit2,
  ExternalLink,
  GitBranch,
  Lightbulb,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Target,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

// ==========================================
// TYPES
// ==========================================

interface KnowledgeFact {
  id: string;
  category: string;
  subcategory?: string;
  title: string;
  content: string;
  sourceType: string;
  confidence: number;
  isVerified: boolean;
  usageCount: number;
  createdAt: string;
}

interface CrossProjectInsight {
  id: string;
  insightType: string;
  title: string;
  description: string;
  sourceProjects: string[];
  impactLevel: string;
  confidence: number;
  recommendations: string[];
}

interface KnowledgeCategory {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
}

interface KnowledgeHubPanelProps {
  organizationId: string;
  onClose?: () => void;
  compact?: boolean;
}

// ==========================================
// CATEGORY CONFIG
// ==========================================

const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  company: { icon: <Building size={16} />, color: 'blue', label: 'Company' },
  market: { icon: <TrendingUp size={16} />, color: 'green', label: 'Market' },
  technical: { icon: <Code size={16} />, color: 'purple', label: 'Technical' },
  process: { icon: <GitBranch size={16} />, color: 'amber', label: 'Process' },
  stakeholder: { icon: <Users size={16} />, color: 'pink', label: 'Stakeholders' },
  competitor: { icon: <Target size={16} />, color: 'red', label: 'Competitors' },
  custom: { icon: <Lightbulb size={16} />, color: 'slate', label: 'Custom' },
};

const INSIGHT_TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pattern: { icon: <GitBranch size={16} />, color: 'blue', label: 'Pattern' },
  risk: { icon: <AlertTriangle size={16} />, color: 'red', label: 'Risk' },
  opportunity: { icon: <Lightbulb size={16} />, color: 'green', label: 'Opportunity' },
  lesson: { icon: <BookOpen size={16} />, color: 'purple', label: 'Lesson' },
};

// ==========================================
// COMPONENT
// ==========================================

export const KnowledgeHubPanel: React.FC<KnowledgeHubPanelProps> = ({
  organizationId,
  onClose,
  compact = false,
}) => {
  const { t } = useTranslation();
  
  // State
  const [activeTab, setActiveTab] = useState<'facts' | 'insights'>('facts');
  const [facts, setFacts] = useState<KnowledgeFact[]>([]);
  const [insights, setInsights] = useState<CrossProjectInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedFacts, setExpandedFacts] = useState<Set<string>>(new Set());
  
  // Add/Edit state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFact, setEditingFact] = useState<KnowledgeFact | null>(null);
  const [newFact, setNewFact] = useState({
    category: 'company',
    title: '',
    content: '',
  });

  // ==========================================
  // DATA FETCHING
  // ==========================================

  useEffect(() => {
    loadData();
  }, [organizationId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch facts
      const factsRes = await fetch(`/api/knowledge-hub/${organizationId}/facts`, { headers });
      if (factsRes.ok) {
        const factsData = await factsRes.json();
        setFacts(factsData.facts || []);
      }

      // Fetch insights
      const insightsRes = await fetch(`/api/knowledge-hub/${organizationId}/insights`, { headers });
      if (insightsRes.ok) {
        const insightsData = await insightsRes.json();
        setInsights(insightsData.insights || []);
      }
    } catch (error) {
      console.error('Failed to load knowledge hub data:', error);
      toast.error(t('knowledgeHub.loadError', 'Nie udało się załadować danych'));
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleAddFact = async () => {
    if (!newFact.title || !newFact.content) {
      toast.error(t('knowledgeHub.fillRequired', 'Wypełnij wymagane pola'));
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/knowledge-hub/${organizationId}/facts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newFact),
      });

      if (res.ok) {
        toast.success(t('knowledgeHub.factAdded', 'Dodano nowy fakt'));
        setShowAddForm(false);
        setNewFact({ category: 'company', title: '', content: '' });
        loadData();
      } else {
        throw new Error('Failed to add fact');
      }
    } catch (error) {
      toast.error(t('knowledgeHub.addError', 'Nie udało się dodać faktu'));
    }
  };

  const handleVerifyFact = async (factId: string, verified: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/knowledge-hub/facts/${factId}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ verified }),
      });

      if (res.ok) {
        toast.success(verified 
          ? t('knowledgeHub.verified', 'Fakt zweryfikowany') 
          : t('knowledgeHub.unverified', 'Usunięto weryfikację')
        );
        loadData();
      }
    } catch (error) {
      toast.error(t('knowledgeHub.verifyError', 'Błąd weryfikacji'));
    }
  };

  const handleDeleteFact = async (factId: string) => {
    if (!confirm(t('knowledgeHub.confirmDelete', 'Czy na pewno chcesz usunąć ten fakt?'))) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/knowledge-hub/facts/${factId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast.success(t('knowledgeHub.deleted', 'Fakt usunięty'));
        loadData();
      }
    } catch (error) {
      toast.error(t('knowledgeHub.deleteError', 'Nie udało się usunąć faktu'));
    }
  };

  const toggleFactExpanded = (factId: string) => {
    setExpandedFacts(prev => {
      const next = new Set(prev);
      if (next.has(factId)) {
        next.delete(factId);
      } else {
        next.add(factId);
      }
      return next;
    });
  };

  // ==========================================
  // FILTERING
  // ==========================================

  const filteredFacts = facts.filter(fact => {
    const matchesSearch = !searchQuery || 
      fact.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fact.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || fact.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const factsByCategory = filteredFacts.reduce((acc, fact) => {
    if (!acc[fact.category]) acc[fact.category] = [];
    acc[fact.category].push(fact);
    return acc;
  }, {} as Record<string, KnowledgeFact[]>);

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 ${compact ? '' : 'shadow-xl'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('knowledgeHub.title', 'Knowledge Hub')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('knowledgeHub.subtitle', 'Wiedza organizacji dla AI')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800"
            title={t('common.refresh', 'Odśwież')}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-navy-700">
        <button
          onClick={() => setActiveTab('facts')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'facts'
              ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
          }`}
        >
          {t('knowledgeHub.facts', 'Fakty')} ({facts.length})
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'insights'
              ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
          }`}
        >
          {t('knowledgeHub.insights', 'Wnioski')} ({insights.length})
        </button>
      </div>

      {/* Search & Filter */}
      <div className="p-4 space-y-3 border-b border-slate-200 dark:border-navy-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('knowledgeHub.search', 'Szukaj...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        {activeTab === 'facts' && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                !selectedCategory
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
              }`}
            >
              {t('common.all', 'Wszystkie')}
            </button>
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  selectedCategory === key
                    ? `bg-${config.color}-100 dark:bg-${config.color}-900/30 text-${config.color}-700 dark:text-${config.color}-300`
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
                }`}
              >
                {config.icon}
                {config.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : activeTab === 'facts' ? (
          <div className="p-4 space-y-4">
            {/* Add Button */}
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 border border-dashed border-primary-300 dark:border-primary-700 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
            >
              <Plus size={18} />
              {t('knowledgeHub.addFact', 'Dodaj nowy fakt')}
            </button>

            {/* Add Form */}
            {showAddForm && (
              <div className="p-4 bg-slate-50 dark:bg-navy-800 rounded-lg border border-slate-200 dark:border-navy-600 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {t('knowledgeHub.category', 'Kategoria')}
                  </label>
                  <select
                    value={newFact.category}
                    onChange={(e) => setNewFact({ ...newFact, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg"
                  >
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {t('knowledgeHub.factTitle', 'Tytuł')}
                  </label>
                  <input
                    type="text"
                    value={newFact.title}
                    onChange={(e) => setNewFact({ ...newFact, title: e.target.value })}
                    placeholder={t('knowledgeHub.titlePlaceholder', 'np. Główna siedziba firmy')}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {t('knowledgeHub.factContent', 'Treść')}
                  </label>
                  <textarea
                    value={newFact.content}
                    onChange={(e) => setNewFact({ ...newFact, content: e.target.value })}
                    placeholder={t('knowledgeHub.contentPlaceholder', 'Szczegółowy opis faktu...')}
                    rows={3}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg"
                  >
                    {t('common.cancel', 'Anuluj')}
                  </button>
                  <button
                    onClick={handleAddFact}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
                  >
                    {t('common.add', 'Dodaj')}
                  </button>
                </div>
              </div>
            )}

            {/* Facts List */}
            {Object.entries(factsByCategory).length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t('knowledgeHub.noFacts', 'Brak faktów do wyświetlenia')}</p>
              </div>
            ) : (
              Object.entries(factsByCategory).map(([category, categoryFacts]) => {
                const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.custom;
                return (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      <span className={`text-${config.color}-500`}>{config.icon}</span>
                      {config.label} ({categoryFacts.length})
                    </div>
                    
                    {categoryFacts.map((fact) => (
                      <div
                        key={fact.id}
                        className="p-3 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg"
                      >
                        <div className="flex items-start justify-between">
                          <button
                            onClick={() => toggleFactExpanded(fact.id)}
                            className="flex items-start gap-2 text-left flex-1"
                          >
                            {expandedFacts.has(fact.id) ? (
                              <ChevronDown size={16} className="mt-0.5 text-slate-400 flex-shrink-0" />
                            ) : (
                              <ChevronRight size={16} className="mt-0.5 text-slate-400 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-900 dark:text-white">
                                  {fact.title}
                                </span>
                                {fact.isVerified && (
                                  <Shield size={14} className="text-green-500" title="Zweryfikowany" />
                                )}
                              </div>
                              {!expandedFacts.has(fact.id) && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  {fact.content}
                                </p>
                              )}
                            </div>
                          </button>
                          
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={() => handleVerifyFact(fact.id, !fact.isVerified)}
                              className={`p-1.5 rounded transition-colors ${
                                fact.isVerified
                                  ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                                  : 'text-slate-400 hover:text-green-500 hover:bg-slate-100 dark:hover:bg-navy-700'
                              }`}
                              title={fact.isVerified ? 'Usuń weryfikację' : 'Zweryfikuj'}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteFact(fact.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-navy-700 rounded transition-colors"
                              title="Usuń"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        
                        {expandedFacts.has(fact.id) && (
                          <div className="mt-3 pl-6 space-y-2">
                            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                              {fact.content}
                            </p>
                            <div className="flex items-center gap-4 text-[10px] text-slate-400">
                              <span>Źródło: {fact.sourceType}</span>
                              <span>Pewność: {Math.round(fact.confidence * 100)}%</span>
                              <span>Użycia: {fact.usageCount}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Insights Tab */
          <div className="p-4 space-y-3">
            {insights.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t('knowledgeHub.noInsights', 'Brak wniosków do wyświetlenia')}</p>
                <p className="text-xs mt-1">
                  {t('knowledgeHub.insightsHint', 'Wnioski są generowane automatycznie z danych projektów')}
                </p>
              </div>
            ) : (
              insights.map((insight) => {
                const config = INSIGHT_TYPE_CONFIG[insight.insightType] || INSIGHT_TYPE_CONFIG.pattern;
                return (
                  <div
                    key={insight.id}
                    className={`p-4 rounded-lg border-l-4 bg-slate-50 dark:bg-navy-800 border-${config.color}-500`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded bg-${config.color}-100 dark:bg-${config.color}-900/30 text-${config.color}-600 dark:text-${config.color}-400`}>
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium text-${config.color}-600 dark:text-${config.color}-400 uppercase`}>
                            {config.label}
                          </span>
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded bg-${
                            insight.impactLevel === 'high' ? 'red' : 
                            insight.impactLevel === 'medium' ? 'amber' : 'slate'
                          }-100 dark:bg-${
                            insight.impactLevel === 'high' ? 'red' : 
                            insight.impactLevel === 'medium' ? 'amber' : 'slate'
                          }-900/30 text-${
                            insight.impactLevel === 'high' ? 'red' : 
                            insight.impactLevel === 'medium' ? 'amber' : 'slate'
                          }-600 dark:text-${
                            insight.impactLevel === 'high' ? 'red' : 
                            insight.impactLevel === 'medium' ? 'amber' : 'slate'
                          }-400`}>
                            {insight.impactLevel.toUpperCase()}
                          </span>
                        </div>
                        <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                          {insight.title}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {insight.description}
                        </p>
                        
                        {insight.recommendations && insight.recommendations.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-navy-600">
                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">
                              Rekomendacje:
                            </span>
                            <ul className="mt-1 space-y-0.5">
                              {insight.recommendations.slice(0, 3).map((rec, idx) => (
                                <li key={idx} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1">
                                  <span className="text-slate-400">•</span>
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeHubPanel;
