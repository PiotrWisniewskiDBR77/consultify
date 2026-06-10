import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import DynamicIcon from '../components/shared/DynamicIcon';
import TeresaMark from '../components/shared/TeresaMark';
import { getLocalizedText, getOverviewCards, HELP_SYSTEM_OVERVIEW } from '../config/helpExperience';
import { ROUTES } from '../routes/routeConfig';
import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';
export const AppIntroView: React.FC = () => {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';
  const navigate = useNavigate();
  const setChatKickoffMessage = useAppStore((s) => s.setChatKickoffMessage);
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const overviewCards = getOverviewCards(lang);

  React.useEffect(() => {
    setCurrentView(AppView.APP_INTRO);
  }, [setCurrentView]);

  const openAi = () => {
    setChatKickoffMessage(
      lang === 'pl'
        ? 'Pomóż mi zrozumieć, jak działa Consultify i od czego najlepiej zacząć pracę.'
        : 'Help me understand how Consultify works and what the best first step is for me.'
    );
    navigate(ROUTES.AI_CHAT);
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-navy-950">
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-8 md:py-10">
        <section className="rounded-3xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 p-6 md:p-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 px-3 py-1 text-xs font-semibold">
              <BookOpen size={14} />
              {lang === 'pl' ? 'Intro aplikacji' : 'App intro'}
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {getLocalizedText(HELP_SYSTEM_OVERVIEW.title, lang)}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
              {getLocalizedText(HELP_SYSTEM_OVERVIEW.summary, lang)}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {getLocalizedText(HELP_SYSTEM_OVERVIEW.intro, lang)}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => navigate(ROUTES.INTERVIEW)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                {lang === 'pl' ? 'Przejdź do Interview' : 'Go to Interview'}
                <ArrowRight size={15} />
              </button>
              <button
                onClick={() => navigate(ROUTES.MY_WORK)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
              >
                {lang === 'pl' ? 'Pokaż mój obszar pracy' : 'Open My Work'}
              </button>
              <button
                onClick={openAi}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-2.5 text-sm font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
              >
                <TeresaMark size={15} />
                {lang === 'pl' ? 'Zapytaj AI od czego zacząć' : 'Ask AI where to begin'}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {lang === 'pl' ? '5 etapów pracy' : '5-step journey'}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {lang === 'pl'
                ? 'To jest główna logika pracy w Consultify. Każdy etap odpowiada innemu rodzajowi decyzji.'
                : 'This is the core work map in Consultify. Each step supports a different kind of decision.'}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {overviewCards.journey.map((card, index) => (
              <div
                key={card.id}
                className="rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30">
                    <DynamicIcon
                      name={card.icon}
                      size={18}
                      className="text-primary-600 dark:text-primary-300"
                    />
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                </div>
                <div className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
                  {card.title}
                </div>
                <div className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {card.description}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {lang === 'pl' ? 'Moduły wspierające' : 'Supporting modules'}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {lang === 'pl'
                ? 'Te moduły wspierają główną podróż, ale mogą też działać niezależnie.'
                : 'These modules support the core journey, but they can also work independently.'}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {overviewCards.support.map((card) => (
              <div
                key={card.id}
                className="rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-navy-800">
                  <DynamicIcon
                    name={card.icon}
                    size={18}
                    className="text-primary-600 dark:text-primary-300"
                  />
                </div>
                <div className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
                  {card.title}
                </div>
                <div className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {card.description}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Sparkles size={16} className="text-primary-500" />
              {lang === 'pl' ? 'Jak działa Help' : 'How Help works'}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {lang === 'pl'
                ? 'Help tłumaczy, po co istnieje bieżący ekran, co tu robisz i co powinno wydarzyć się dalej.'
                : 'Help explains why the current screen exists, what you do here, and what should happen next.'}
            </p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <TeresaMark size={16} className="text-amber-500" />
              {lang === 'pl' ? 'Jak pomaga AI' : 'How AI helps'}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {lang === 'pl'
                ? 'AI nie zastępuje helpa. Pomaga zinterpretować kontekst i przygotować następny krok dokładnie tam, gdzie pracujesz.'
                : 'AI does not replace help. It helps interpret context and prepare the next step exactly where you are working.'}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AppIntroView;
