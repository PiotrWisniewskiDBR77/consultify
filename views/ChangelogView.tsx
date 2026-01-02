/**
 * Changelog View
 * 
 * Full changelog/release notes history page.
 * Route: /changelog
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Sparkles,
    Tag,
    Calendar,
    CheckCircle,
    Wrench,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    Filter,
    ArrowLeft,
    Rss
} from 'lucide-react';
import { RELEASE_NOTES, ReleaseNote } from '../config/releaseNotes';
import DynamicIcon from '../components/shared/DynamicIcon';

interface ChangelogViewProps {
    onBack?: () => void;
}

type ReleaseType = 'all' | 'major' | 'minor' | 'patch';

export const ChangelogView: React.FC<ChangelogViewProps> = ({ onBack }) => {
    const { i18n } = useTranslation();
    const lang = i18n.language === 'pl' ? 'pl' : 'en';

    const [filter, setFilter] = useState<ReleaseType>('all');
    const [expandedVersions, setExpandedVersions] = useState<Set<string>>(
        new Set([RELEASE_NOTES[0]?.version])
    );

    // Filter releases
    const filteredReleases = filter === 'all'
        ? RELEASE_NOTES
        : RELEASE_NOTES.filter(r => r.type === filter);

    // Toggle expansion
    const toggleVersion = (version: string) => {
        const newExpanded = new Set(expandedVersions);
        if (newExpanded.has(version)) {
            newExpanded.delete(version);
        } else {
            newExpanded.add(version);
        }
        setExpandedVersions(newExpanded);
    };

    // Type badge config
    const typeBadge = {
        major: { color: 'bg-purple-500', label: { en: 'Major', pl: 'Główna' } },
        minor: { color: 'bg-blue-500', label: { en: 'Minor', pl: 'Mniejsza' } },
        patch: { color: 'bg-green-500', label: { en: 'Patch', pl: 'Poprawka' } }
    };

    // Text
    const t = {
        title: { en: 'Changelog', pl: 'Historia Zmian' },
        subtitle: { en: 'Track all updates and improvements to TechnoLex', pl: 'Śledź wszystkie aktualizacje i ulepszenia TechnoLex' },
        all: { en: 'All', pl: 'Wszystkie' },
        major: { en: 'Major', pl: 'Główne' },
        minor: { en: 'Minor', pl: 'Mniejsze' },
        patch: { en: 'Patches', pl: 'Poprawki' },
        features: { en: 'New Features', pl: 'Nowe Funkcje' },
        improvements: { en: 'Improvements', pl: 'Ulepszenia' },
        fixes: { en: 'Bug Fixes', pl: 'Poprawki Błędów' },
        breaking: { en: 'Breaking Changes', pl: 'Zmiany Przełomowe' },
        rss: { en: 'RSS Feed', pl: 'Kanał RSS' }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <div className="max-w-4xl mx-auto px-4 py-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {onBack && (
                                <button
                                    onClick={onBack}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                                >
                                    <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
                                </button>
                            )}
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                    <Tag size={32} className="text-purple-500" />
                                    {t.title[lang]}
                                </h1>
                                <p className="text-slate-600 dark:text-slate-400 mt-1">
                                    {t.subtitle[lang]}
                                </p>
                            </div>
                        </div>
                        <button
                            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                            title={t.rss[lang]}
                        >
                            <Rss size={16} />
                            RSS
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8">
                {/* Filters */}
                <div className="flex items-center gap-2 mb-8">
                    <Filter size={18} className="text-slate-400" />
                    {(['all', 'major', 'minor', 'patch'] as ReleaseType[]).map(type => (
                        <button
                            key={type}
                            onClick={() => setFilter(type)}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filter === type
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                        >
                            {t[type][lang]}
                        </button>
                    ))}
                </div>

                {/* Timeline */}
                <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

                    {/* Releases */}
                    <div className="space-y-6">
                        {filteredReleases.map((release, index) => {
                            const isExpanded = expandedVersions.has(release.version);
                            const badge = typeBadge[release.type];

                            return (
                                <motion.div
                                    key={release.version}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="relative pl-16"
                                >
                                    {/* Timeline dot */}
                                    <div className={`absolute left-4 w-5 h-5 rounded-full ${badge.color} border-4 border-slate-50 dark:border-slate-900`} />

                                    {/* Release card */}
                                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
                                        {/* Header */}
                                        <button
                                            onClick={() => toggleVersion(release.version)}
                                            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                        >
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className={`px-2 py-0.5 ${badge.color} text-white text-xs font-medium rounded`}>
                                                        v{release.version}
                                                    </span>
                                                    <span className="text-sm text-slate-500 flex items-center gap-1">
                                                        <Calendar size={14} />
                                                        {new Date(release.date).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-US', {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        })}
                                                    </span>
                                                </div>
                                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                                    {release.title[lang]}
                                                </h3>
                                                {release.summary && (
                                                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                                                        {release.summary[lang]}
                                                    </p>
                                                )}
                                            </div>
                                            {isExpanded ? (
                                                <ChevronUp size={20} className="text-slate-400 flex-shrink-0" />
                                            ) : (
                                                <ChevronDown size={20} className="text-slate-400 flex-shrink-0" />
                                            )}
                                        </button>

                                        {/* Content */}
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="px-6 pb-6 space-y-6"
                                            >
                                                {/* Features */}
                                                {release.features.length > 0 && (
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                            <Sparkles size={16} className="text-purple-500" />
                                                            {t.features[lang]}
                                                        </h4>
                                                        <div className="space-y-3">
                                                            {release.features.map((feature, i) => (
                                                                <div key={i} className="flex items-start gap-3">
                                                                    {feature.icon && (
                                                                        <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                                                                            <DynamicIcon name={feature.icon} size={16} className="text-purple-600 dark:text-purple-400" />
                                                                        </div>
                                                                    )}
                                                                    <div>
                                                                        <h5 className="font-medium text-slate-900 dark:text-white">
                                                                            {feature.title[lang]}
                                                                        </h5>
                                                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                                                            {feature.description[lang]}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Improvements */}
                                                {release.improvements.length > 0 && (
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                            <Wrench size={16} className="text-blue-500" />
                                                            {t.improvements[lang]}
                                                        </h4>
                                                        <ul className="space-y-2">
                                                            {release.improvements.map((item, i) => (
                                                                <li key={i} className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                                                                    <CheckCircle size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                                                                    {item[lang]}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Fixes */}
                                                {release.fixes.length > 0 && (
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                            <CheckCircle size={16} className="text-green-500" />
                                                            {t.fixes[lang]}
                                                        </h4>
                                                        <ul className="space-y-2">
                                                            {release.fixes.map((item, i) => (
                                                                <li key={i} className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                                                                    <span className="text-green-500">•</span>
                                                                    {item[lang]}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Breaking Changes */}
                                                {release.breaking && release.breaking.length > 0 && (
                                                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                                                        <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                            <AlertTriangle size={16} />
                                                            {t.breaking[lang]}
                                                        </h4>
                                                        <ul className="space-y-2">
                                                            {release.breaking.map((item, i) => (
                                                                <li key={i} className="flex items-start gap-2 text-red-700 dark:text-red-300">
                                                                    <span>•</span>
                                                                    {item[lang]}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ChangelogView;



