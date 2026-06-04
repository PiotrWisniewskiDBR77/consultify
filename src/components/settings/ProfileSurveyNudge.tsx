import {
  Award,
  Building,
  Calendar,
  ChevronRight,
  MapPin,
  Sparkles,
  Tag,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { User } from '../../types';

const DEPARTMENT_OPTIONS = [
  'Sprzedaż',
  'Marketing',
  'Logistyka',
  'Produkcja i Jakość',
  'HR i Finanse',
  'B+R',
  'Zarząd',
  'IT',
  'Inne',
];

const SENIORITY_OPTIONS = [
  'Specjalista',
  'Starszy Specjalista',
  'Team Leader',
  'Kierownik',
  'Dyrektor',
  'Zarząd / C-level',
];

const TENURE_OPTIONS = [
  { value: '<1', label: 'Poniżej roku' },
  { value: '1-3', label: '1–3 lata' },
  { value: '3-5', label: '3–5 lat' },
  { value: '5-10', label: '5–10 lat' },
  { value: '10+', label: 'Ponad 10 lat' },
];

const EXPERTISE_POOL = [
  'ERP',
  'CRM',
  'Lean',
  'Six Sigma',
  'ISO',
  'AI / ML',
  'Automatyzacja',
  'Power BI',
  'Excel',
  'SAP',
  'Zarządzanie projektami',
  'Agile',
  'Supply Chain',
  'Analiza danych',
  'BPM',
  'RPA',
  'IoT',
  'Marketing Automation',
  'CAD/CAM',
  'HR Tech',
];

interface ProfileSurveyNudgeProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

type Step = 'department' | 'seniority' | 'tenure' | 'expertise' | 'done';
const STEPS: Step[] = ['department', 'seniority', 'tenure', 'expertise'];

const MIN_LOGINS_BEFORE_NUDGE = 2;
const DISMISS_COOLDOWN_HOURS = 48;
const MAX_DISMISS_COUNT = 3;

function shouldShowNudge(user: User): boolean {
  if (user.profileSurveyCompletedAt) return false;
  if ((user.profileSurveyDismissedCount || 0) >= MAX_DISMISS_COUNT) return false;

  if (user.department && user.seniorityLevel && user.tenureYears) return false;

  if (user.profileSurveyLastDismissedAt) {
    const lastDismissed = new Date(user.profileSurveyLastDismissedAt).getTime();
    const hoursSince = (Date.now() - lastDismissed) / (1000 * 60 * 60);
    if (hoursSince < DISMISS_COOLDOWN_HOURS) return false;
  }

  return true;
}

export const ProfileSurveyNudge: React.FC<ProfileSurveyNudgeProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>('department');
  const [animating, setAnimating] = useState(false);

  const [department, setDepartment] = useState(currentUser.department || '');
  const [seniority, setSeniority] = useState(currentUser.seniorityLevel || '');
  const [tenure, setTenure] = useState(currentUser.tenureYears || '');
  const [expertise, setExpertise] = useState<string[]>(currentUser.expertiseTags || []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (shouldShowNudge(currentUser)) {
        setVisible(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [currentUser]);

  const stepIndex = STEPS.indexOf(step);
  const progress = step === 'done' ? 100 : ((stepIndex + 1) / STEPS.length) * 100;

  const canProceed = useMemo(() => {
    switch (step) {
      case 'department':
        return !!department;
      case 'seniority':
        return !!seniority;
      case 'tenure':
        return !!tenure;
      case 'expertise':
        return true;
      default:
        return false;
    }
  }, [step, department, seniority, tenure]);

  const handleNext = useCallback(() => {
    if (step === 'done') return;
    setAnimating(true);
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setTimeout(() => {
        setStep(STEPS[nextIndex]);
        setAnimating(false);
      }, 200);
    } else {
      handleSubmit();
    }
  }, [step, stepIndex]);

  const handleSubmit = async () => {
    try {
      const updates: Partial<User> = {
        department,
        seniorityLevel: seniority,
        tenureYears: tenure,
        expertiseTags: expertise,
        profileSurveyCompletedAt: new Date().toISOString(),
      };
      await Api.updateUser(currentUser.id, updates as any);
      onUpdateUser(updates);
      setStep('done');
      setTimeout(() => setVisible(false), 2500);
    } catch {
      setStep('done');
      setTimeout(() => setVisible(false), 2000);
    }
  };

  const handleDismiss = async () => {
    try {
      const newCount = (currentUser.profileSurveyDismissedCount || 0) + 1;
      await Api.updateUser(currentUser.id, { profileSurveyDismissedCount: newCount } as any);
      onUpdateUser({
        profileSurveyDismissedCount: newCount,
        profileSurveyLastDismissedAt: new Date().toISOString(),
      });
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleDismiss} />
      <div className="relative w-full max-w-lg bg-white dark:bg-navy-900 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Progress bar */}
        <div className="h-1 bg-slate-100 dark:bg-navy-800">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-crimson-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-600 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors z-10"
        >
          <X size={18} />
        </button>

        <div className="p-8">
          {step === 'done' ? (
            <div className="text-center py-8 animate-in fade-in duration-300">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center">
                <Sparkles size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-2">Gotowe!</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Dzięki za uzupełnienie profilu. Teraz dopasujemy pytania do Twojego obszaru.
              </p>
            </div>
          ) : (
            <div
              className={`transition-opacity duration-200 ${animating ? 'opacity-0' : 'opacity-100'}`}
            >
              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                    Krok {stepIndex + 1} z {STEPS.length}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-navy-900 dark:text-white">
                  {step === 'department' && 'W jakim dziale pracujesz?'}
                  {step === 'seniority' && 'Na jakim poziomie jest Twoje stanowisko?'}
                  {step === 'tenure' && 'Jak długo pracujesz w firmie?'}
                  {step === 'expertise' && 'Jakie masz kompetencje?'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {step === 'department' &&
                    'Pomoże nam to dobrać odpowiednie pytania do Twojego obszaru.'}
                  {step === 'seniority' && 'Dopasujemy pytania do perspektywy Twojego stanowiska.'}
                  {step === 'tenure' &&
                    'Twoje doświadczenie w firmie ma znaczenie dla kontekstu odpowiedzi.'}
                  {step === 'expertise' &&
                    'Opcjonalne — wybierz kilka, które najlepiej Cię opisują.'}
                </p>
              </div>

              {/* Step content */}
              <div className="space-y-2 mb-8">
                {step === 'department' && (
                  <div className="grid grid-cols-2 gap-2">
                    {DEPARTMENT_OPTIONS.map((dept) => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => setDepartment(dept)}
                        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-left text-sm font-medium transition-all border ${
                          department === dept
                            ? 'bg-primary-50 dark:bg-primary-500/20 border-primary-400 dark:border-primary-500 text-primary-700 dark:text-primary-300 shadow-sm shadow-primary-500/10'
                            : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:border-primary-300 dark:hover:border-primary-600'
                        }`}
                      >
                        <Building
                          size={16}
                          className={department === dept ? 'text-primary-500' : 'text-slate-600'}
                        />
                        {dept}
                      </button>
                    ))}
                  </div>
                )}

                {step === 'seniority' && (
                  <div className="space-y-2">
                    {SENIORITY_OPTIONS.map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setSeniority(lvl)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-all border ${
                          seniority === lvl
                            ? 'bg-primary-50 dark:bg-primary-500/20 border-primary-400 dark:border-primary-500 text-primary-700 dark:text-primary-300 shadow-sm shadow-primary-500/10'
                            : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:border-primary-300 dark:hover:border-primary-600'
                        }`}
                      >
                        <Award
                          size={16}
                          className={seniority === lvl ? 'text-primary-500' : 'text-slate-600'}
                        />
                        {lvl}
                      </button>
                    ))}
                  </div>
                )}

                {step === 'tenure' && (
                  <div className="grid grid-cols-1 gap-2">
                    {TENURE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTenure(opt.value)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-all border ${
                          tenure === opt.value
                            ? 'bg-primary-50 dark:bg-primary-500/20 border-primary-400 dark:border-primary-500 text-primary-700 dark:text-primary-300 shadow-sm shadow-primary-500/10'
                            : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:border-primary-300 dark:hover:border-primary-600'
                        }`}
                      >
                        <Calendar
                          size={16}
                          className={tenure === opt.value ? 'text-primary-500' : 'text-slate-600'}
                        />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {step === 'expertise' && (
                  <div>
                    {expertise.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-slate-200 dark:border-navy-700">
                        {expertise.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 rounded-full text-xs font-medium"
                          >
                            <Tag size={10} />
                            {tag}
                            <button
                              type="button"
                              onClick={() => setExpertise(expertise.filter((e) => e !== tag))}
                              className="ml-0.5 hover:text-rose-500 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {EXPERTISE_POOL.filter((s) => !expertise.includes(s)).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            if (expertise.length < 10) {
                              setExpertise([...expertise, suggestion]);
                            }
                          }}
                          className="px-2.5 py-1 text-xs rounded-full border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        >
                          + {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-xs text-slate-600 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  Uzupełnię później
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceed && step !== 'expertise'}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    canProceed || step === 'expertise'
                      ? 'bg-gradient-to-r from-primary-600 to-crimson-600 text-white shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 hover:scale-[1.02]'
                      : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {stepIndex === STEPS.length - 1 ? 'Zapisz' : 'Dalej'}
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSurveyNudge;
