import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EntryTopBar } from '../Landing/EntryTopBar';
import { EntryFooter } from '../Landing/EntryFooter';

interface LegalPageLayoutProps {
    title: string;
    lastUpdated: string;
    children: React.ReactNode;
}

export const LegalPageLayout: React.FC<LegalPageLayoutProps> = ({
    title,
    lastUpdated,
    children
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const handleBack = () => {
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-white dark:bg-navy-950 flex flex-col">
            {/* Header */}
            <EntryTopBar
                onTrialClick={() => navigate('/trial/start')}
                onDemoClick={() => navigate('/demo')}
                onLoginClick={() => navigate('/login')}
                isLoggedIn={false}
                hasWorkspace={false}
            />

            {/* Main Content */}
            <main className="flex-1 pt-20">
                <div className="max-w-4xl mx-auto px-6 py-16">
                    {/* Back Button */}
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-navy-900 dark:hover:text-white mb-8 transition-colors"
                    >
                        <ArrowLeft size={16} />
                        {t('common.backToHome', 'Back to Home')}
                    </button>

                    {/* Title Section */}
                    <div className="mb-12 pb-8 border-b border-slate-200 dark:border-white/10">
                        <h1 className="text-4xl font-black text-navy-950 dark:text-white mb-4 tracking-tight">
                            {title}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('legal.lastUpdated', 'Last updated')}: {lastUpdated}
                        </p>
                    </div>

                    {/* Content */}
                    <article className="prose prose-slate dark:prose-invert max-w-none
                        prose-headings:font-bold prose-headings:tracking-tight
                        prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:text-navy-900 dark:prose-h2:text-white
                        prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-navy-800 dark:prose-h3:text-slate-200
                        prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-p:leading-relaxed
                        prose-li:text-slate-600 dark:prose-li:text-slate-300
                        prose-a:text-purple-600 dark:prose-a:text-purple-400 prose-a:no-underline hover:prose-a:underline
                        prose-strong:text-navy-900 dark:prose-strong:text-white
                    ">
                        {children}
                    </article>
                </div>
            </main>

            {/* Footer */}
            <EntryFooter />
        </div>
    );
};

export default LegalPageLayout;
