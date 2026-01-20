/**
 * InterviewView - v2.0 ClickUp-like Redesign
 * 
 * Full page view for the Interview module.
 * 5 Categories: Strategy, Operations, Digital, People, Finance
 * First step in Discovery process - collects organization context.
 * 
 * ONLY FACTS - no recommendations, action plans, or analysis.
 * 
 * @see PROMPT 8 in wdrozenia/PROMPTY_DLA_AGENTOW.md
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Brain,
  ChevronRight,
  History,
  Loader2,
  Plus,
  Sparkles,
} from 'lucide-react';

import { InterviewWorkspace } from '@/components/Interview';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

// Types
interface InterviewSession {
  id: string;
  organizationId: string;
  projectId?: string;
  name: string;
  ownerId: string;
  status: string;
  totalQuestions: number;
  answeredQuestions: number;
  startedAt: string;
  completedAt?: string;
  lastActivityAt?: string;
}

type ViewMode = 'workspace' | 'history';

export const InterviewView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { currentProjectId, currentOrganization } = useAppStore();

  // Get session ID from URL if provided
  const sessionIdFromUrl = searchParams.get('sessionId');

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('workspace');
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [currentSession, setCurrentSession] = useState<InterviewSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load sessions
  useEffect(() => {
    const loadSessions = async () => {
      setIsLoading(true);
      try {
        const sessionsRes = await Api.get('/interview/sessions');
        const sessionsList = Array.isArray(sessionsRes) ? sessionsRes : [];
        setSessions(sessionsList as InterviewSession[]);
      } catch (error) {
        console.error('[InterviewView] Failed to load sessions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSessions();
  }, []);

  // Handle session completion
  const handleSessionComplete = useCallback((sessionId: string) => {
    toast.success(isPolish ? 'Wywiad zakończony! Kontekst zapisany.' : 'Interview completed! Context saved.');
    
    // Refresh sessions list
    Api.get('/interview/sessions').then((res) => {
      setSessions(Array.isArray(res) ? res : []);
    });
  }, [isPolish]);

  // Handle session change
  const handleSessionChange = useCallback((session: InterviewSession) => {
    setCurrentSession(session);
  }, []);

  // Start new session
  const handleNewSession = useCallback(async () => {
    try {
      const newSession = await Api.post('/interview/sessions', {
        projectId: currentProjectId,
        name: `Interview ${new Date().toLocaleDateString()}`,
      });
      
      setSessions((prev) => [newSession as InterviewSession, ...prev]);
      setCurrentSession(newSession as InterviewSession);
      setViewMode('workspace');
      toast.success(isPolish ? 'Nowa sesja wywiadu rozpoczęta!' : 'New interview session started!');
    } catch (error) {
      console.error('[InterviewView] Failed to create session:', error);
      toast.error(isPolish ? 'Nie udało się utworzyć sesji' : 'Failed to create session');
    }
  }, [currentProjectId, isPolish]);

  // View session from history
  const handleViewSession = useCallback((session: InterviewSession) => {
    setCurrentSession(session);
    setViewMode('workspace');
  }, []);

  // Export to Tools
  const handleExportToTools = useCallback(() => {
    navigate('/discovery-tools');
  }, [navigate]);

  // Export to Assessment
  const handleExportToAssessment = useCallback(() => {
    navigate('/assessment');
  }, [navigate]);

  // Render loading
  if (isLoading && !sessionIdFromUrl) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950">
        <div className="text-center">
          <Loader2 className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">
            {isPolish ? 'Ładowanie...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Brain className="text-purple-600 dark:text-purple-400" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-navy-900 dark:text-white">
                  {isPolish ? 'Discovery Interview' : 'Discovery Interview'}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {currentOrganization?.name || (isPolish ? 'Zbieranie kontekstu organizacji' : 'Organization Context Collection')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center bg-slate-100 dark:bg-navy-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('workspace')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'workspace'
                      ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Sparkles size={16} />
                  {isPolish ? 'Wywiad' : 'Interview'}
                </button>
                <button
                  onClick={() => setViewMode('history')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'history'
                      ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <History size={16} />
                  {isPolish ? 'Historia' : 'History'}
                  {sessions.length > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 rounded-full">
                      {sessions.length}
                    </span>
                  )}
                </button>
              </div>

              {/* New Session Button */}
              <button
                onClick={handleNewSession}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors font-medium text-sm"
              >
                <Plus size={16} />
                {isPolish ? 'Nowa sesja' : 'New Session'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'workspace' && (
          <InterviewWorkspace
            sessionId={sessionIdFromUrl || undefined}
            projectId={currentProjectId || undefined}
            onComplete={handleSessionComplete}
            onSessionChange={handleSessionChange}
          />
        )}

        {viewMode === 'history' && (
          <div className="h-full overflow-y-auto p-6">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center mb-4">
                  <History className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {isPolish ? 'Brak sesji wywiadów' : 'No interview sessions yet'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-4">
                  {isPolish 
                    ? 'Rozpocznij pierwszy wywiad, aby zebrać kontekst organizacji dla lepszych analiz transformacji.'
                    : 'Start your first interview to collect organizational context for better transformation insights.'
                  }
                </p>
                <button
                  onClick={handleNewSession}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  <Sparkles size={16} />
                  {isPolish ? 'Rozpocznij wywiad' : 'Start Interview'}
                </button>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-4">
                <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4">
                  {isPolish ? 'Historia wywiadów' : 'Interview History'}
                </h2>
                
                {sessions.map((session) => {
                  const progress = session.totalQuestions > 0
                    ? Math.round((session.answeredQuestions / session.totalQuestions) * 100)
                    : 0;

                  return (
                    <div
                      key={session.id}
                      onClick={() => handleViewSession(session)}
                      className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`
                            w-10 h-10 rounded-lg flex items-center justify-center
                            ${session.status === 'completed'
                              ? 'bg-emerald-100 dark:bg-emerald-900/30'
                              : session.status === 'active'
                                ? 'bg-purple-100 dark:bg-purple-900/30'
                                : 'bg-slate-100 dark:bg-slate-800'
                            }
                          `}>
                            <Brain
                              size={20}
                              className={
                                session.status === 'completed'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : session.status === 'active'
                                    ? 'text-purple-600 dark:text-purple-400'
                                    : 'text-slate-400 dark:text-slate-500'
                              }
                            />
                          </div>
                          <div>
                            <h4 className="font-medium text-navy-900 dark:text-white">
                              {session.name || 'Discovery Interview'}
                            </h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {isPolish ? 'Rozpoczęto' : 'Started'} {new Date(session.startedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`
                              px-2.5 py-1 text-xs font-medium rounded-full
                              ${session.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : session.status === 'active'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }
                            `}
                          >
                            {session.status === 'completed' 
                              ? (isPolish ? 'Zakończony' : 'Completed')
                              : session.status === 'active'
                                ? (isPolish ? 'W trakcie' : 'In Progress')
                                : session.status
                            }
                          </span>
                          <ChevronRight size={18} className="text-slate-400" />
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-4 flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                          {session.answeredQuestions}/{session.totalQuestions} {isPolish ? 'pytań' : 'questions'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewView;
