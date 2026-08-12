/**
 * Prompt Test Bench
 *
 * Multi-language testing interface for validating prompt templates
 * across all supported languages.
 */

import {
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Globe,
  Hash,
  Languages,
  Loader2,
  Play,
  RefreshCw,
  TestTube,
  XCircle,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PromptAssistantApi } from '../../../services/api/promptAssistant.api';

interface TestResult {
  language: string;
  success: boolean;
  expectedLanguage: string;
  detectedLanguage: string;
  languageMatch: boolean;
  response?: string;
  tokenCount?: number;
  error?: string;
}

interface TestSummary {
  tested: number;
  passed: number;
  languageAccuracy: number;
}

interface PromptTestBenchProps {
  templateCode?: string;
  onTestComplete?: (results: TestResult[]) => void;
  className?: string;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
];

const SAMPLE_INPUTS = {
  en: 'How can I improve our digital maturity score?',
  pl: 'Jak mogę poprawić nasz wynik dojrzałości cyfrowej?',
  de: 'Wie kann ich unseren digitalen Reifegrad verbessern?',
  es: '¿Cómo puedo mejorar nuestra puntuación de madurez digital?',
  ja: 'デジタル成熟度スコアを向上させるにはどうすればよいですか？',
  ar: 'كيف يمكنني تحسين درجة النضج الرقمي لدينا؟',
};

export const PromptTestBench: React.FC<PromptTestBenchProps> = ({
  templateCode,
  onTestComplete,
  className = '',
}) => {
  const { t } = useTranslation();
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['en', 'pl', 'de']);
  const [sampleInput, setSampleInput] = useState('How can I improve our digital maturity?');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleLanguage = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  };

  const selectAllLanguages = () => {
    setSelectedLanguages(SUPPORTED_LANGUAGES.map((l) => l.code));
  };

  const runTests = async () => {
    if (!templateCode || selectedLanguages.length === 0) return;

    setIsRunning(true);
    setResults([]);
    setSummary(null);

    try {
      const data = await PromptAssistantApi.runTest(templateCode, sampleInput, selectedLanguages);
      const nextResults = (data.data?.results || []) as TestResult[];
      setResults(nextResults);
      setSummary((data.data?.summary || null) as TestSummary | null);

      if (onTestComplete) {
        onTestComplete(nextResults);
      }
    } catch (error) {
      console.error('Test error:', error);
      setResults([
        {
          language: 'error',
          success: false,
          expectedLanguage: '',
          detectedLanguage: '',
          languageMatch: false,
          error: 'Test execution failed',
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const toggleResultExpanded = (language: string) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(language)) {
      newExpanded.delete(language);
    } else {
      newExpanded.add(language);
    }
    setExpandedResults(newExpanded);
  };

  const copyResponse = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getLanguageInfo = (code: string) => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === code) || { code, name: code, flag: '🌐' };
  };

  return (
    <div
      className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 ${className}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-2 mb-1">
          <TestTube className="w-5 h-5 text-primary-500" />
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Multi-Language Test Bench
          </h3>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Test prompt templates across all supported languages
        </p>
      </div>

      {/* Configuration */}
      <div className="p-4 space-y-4 border-b border-slate-200 dark:border-navy-700">
        {/* Template code */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Template Code
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-slate-100 dark:bg-navy-800 rounded-lg text-sm font-mono text-slate-700 dark:text-slate-300">
              {templateCode || 'No template selected'}
            </code>
          </div>
        </div>

        {/* Sample Input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Sample Input
          </label>
          <textarea
            value={sampleInput}
            onChange={(e) => setSampleInput(e.target.value)}
            placeholder="Enter test input..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-slate-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            rows={2}
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(SAMPLE_INPUTS).map(([code, text]) => {
              const lang = getLanguageInfo(code);
              return (
                <button
                  key={code}
                  onClick={() => setSampleInput(text)}
                  className="px-2 py-1 text-xs rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
                >
                  {lang.flag} {lang.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Language Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Test Languages
            </label>
            <button
              onClick={selectAllLanguages}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              Select All
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = selectedLanguages.includes(lang.code);
              return (
                <button
                  key={lang.code}
                  onClick={() => toggleLanguage(lang.code)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border-2 border-primary-500'
                      : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-navy-700 hover:border-primary-300'
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Run Button */}
        <button
          onClick={runTests}
          disabled={!templateCode || selectedLanguages.length === 0 || isRunning}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-medium hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running Tests...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Tests ({selectedLanguages.length} languages)
            </>
          )}
        </button>
      </div>

      {/* Results Summary */}
      {summary && (
        <div className="p-4 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {summary.tested}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Tested</div>
            </div>
            <div className="text-center">
              <div
                className={`text-2xl font-bold ${
                  summary.passed === summary.tested
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {summary.passed}/{summary.tested}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Passed</div>
            </div>
            <div className="text-center">
              <div
                className={`text-2xl font-bold ${
                  summary.languageAccuracy === 1
                    ? 'text-green-600 dark:text-green-400'
                    : summary.languageAccuracy >= 0.8
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-danger-600 dark:text-danger-400'
                }`}
              >
                {Math.round(summary.languageAccuracy * 100)}%
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Language Match</div>
            </div>
          </div>
        </div>
      )}

      {/* Test Results */}
      {results.length > 0 && (
        <div className="p-4 space-y-2">
          <h4 className="font-medium text-slate-900 dark:text-white mb-3">Test Results</h4>
          {results.map((result) => {
            const lang = getLanguageInfo(result.language);
            const isExpanded = expandedResults.has(result.language);

            return (
              <div
                key={result.language}
                className="border border-slate-200 dark:border-navy-700 rounded-lg overflow-hidden"
              >
                {/* Result header */}
                <button
                  onClick={() => toggleResultExpanded(result.language)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {result.success && result.languageMatch ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : result.success ? (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-danger-500" />
                    )}
                    <span className="text-lg">{lang.flag}</span>
                    <span className="font-medium text-slate-900 dark:text-white">{lang.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {result.success && (
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <Globe size={14} />
                        <span>
                          {result.detectedLanguage === result.expectedLanguage
                            ? '✓ Correct'
                            : `Detected: ${result.detectedLanguage}`}
                        </span>
                      </div>
                    )}
                    {result.tokenCount && (
                      <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                        <Hash size={14} />
                        <span>{result.tokenCount}</span>
                      </div>
                    )}
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-slate-600 dark:text-slate-500" />
                    ) : (
                      <ChevronRight size={16} className="text-slate-600 dark:text-slate-500" />
                    )}
                  </div>
                </button>

                {/* Expanded response */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-200 dark:border-navy-700">
                    {result.error ? (
                      <div className="mt-3 p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm">
                        {result.error}
                      </div>
                    ) : result.response ? (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            AI Response
                          </span>
                          <button
                            onClick={() => copyResponse(result.response || '', result.language)}
                            className="p-1 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white"
                          >
                            {copiedId === result.language ? (
                              <Check size={14} />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-navy-800 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                          {result.response}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                        No response captured
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && !isRunning && (
        <div className="p-8 text-center text-slate-600 dark:text-slate-500">
          <TestTube className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Run tests to validate your prompt across languages</p>
        </div>
      )}
    </div>
  );
};

export default PromptTestBench;
