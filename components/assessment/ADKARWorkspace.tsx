/**
 * ADKAR Change Readiness Assessment Workspace
 * 5-dimension change management assessment
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, CheckCircle, AlertTriangle } from 'lucide-react';
import { ADKAR_QUESTIONNAIRE, ADKAR_QUESTIONS, ADKARDimension, ADKARQuestion } from '../../data/adkarQuestionnaire';
import axios from 'axios';

interface ADKARWorkspaceProps {
    projectId?: string;
    organizationId: string;
}

export const ADKARWorkspace: React.FC<ADKARWorkspaceProps> = ({
    projectId,
    organizationId
}) => {
    const { t } = useTranslation();
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [responses, setResponses] = useState<Record<string, number>>({});
    const [results, setResults] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleResponse = (value: number) => {
        const questionId = ADKAR_QUESTIONS[currentQuestion].id;
        setResponses({ ...responses, [questionId]: value });

        if (currentQuestion < ADKAR_QUESTIONS.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const response = await axios.post('/api/adkar', {
                organizationId,
                projectId,
                responses
            });
            setResults(response.data);
        } catch (error) {
            console.error('Error submitting ADKAR assessment:', error);
            alert('Failed to submit assessment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const progress = ((currentQuestion + 1) / ADKAR_QUESTIONS.length) * 100;

    if (results) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                    ADKAR Assessment Results
                </h2>

                {/* Overall Score */}
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-xl p-8 mb-6">
                    <div className="text-center">
                        <div className="text-6xl font-bold">{results.overall_score.toFixed(1)}</div>
                        <div className="text-xl mt-2">Overall Change Readiness</div>
                        <div className="text-sm text-blue-100 mt-1">Scale: 1 (Low) - 5 (High)</div>
                    </div>
                </div>

                {/* Dimension Breakdown */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                    <h3 className="text-xl font-semibold mb-4">Dimension Breakdown</h3>
                    <div className="space-y-4">
                        {ADKAR_QUESTIONNAIRE.map((dim: ADKARDimension) => {
                            const score = results[`${dim.id}_score`];
                            const percentage = (score / 5) * 100;

                            return (
                                <div key={dim.id}>
                                    <div className="flex justify-between mb-1">
                                        <span className="font-medium">{dim.name}</span>
                                        <span className="text-gray-600">{score.toFixed(1)}/5</span>
                                    </div>
                                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${score >= 3.5 ? 'bg-green-500' : score >= 2.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Recommendations */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                    <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp className="w-6 h-6" />
                        AI Recommendations
                    </h3>
                    <div className="space-y-3">
                        {results.recommendations.map((rec: any, index: number) => (
                            <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold capitalize">{rec.dimension}</span>
                                    <span className={`px-2 py-1 text-xs rounded ${rec.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {rec.priority} Priority
                                    </span>
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{rec.recommendation}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const currentQ = ADKAR_QUESTIONS[currentQuestion];
    const currentDimension = ADKAR_QUESTIONNAIRE.find((d: ADKARDimension) => d.id === currentQ.dimension);

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-2">ADKAR Change Readiness Assessment</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
                Assess organizational readiness for change across 5 critical dimensions
            </p>

            {/* Progress Bar */}
            <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                    <span>Question {currentQuestion + 1} of {ADKAR_QUESTIONS.length}</span>
                    <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Current Dimension */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
                <div className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">
                    {currentDimension?.name}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                    {currentDimension?.description}
                </div>
            </div>

            {/* Question */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-6">
                <h3 className="text-xl font-medium mb-6">{currentQ.text}</h3>

                {/* Rating Scale */}
                <div className="space-y-3">
                    {[
                        { value: 1, label: 'Strongly Disagree', color: 'red' },
                        { value: 2, label: 'Disagree', color: 'orange' },
                        { value: 3, label: 'Neutral', color: 'yellow' },
                        { value: 4, label: 'Agree', color: 'blue' },
                        { value: 5, label: 'Strongly Agree', color: 'green' }
                    ].map(option => (
                        <button
                            key={option.value}
                            onClick={() => handleResponse(option.value)}
                            className={`w-full p-4 rounded-lg border-2 transition-all hover:scale-105 ${responses[currentQ.id] === option.value
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{option.label}</span>
                                <span className="text-2xl">{option.value}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
                <button
                    onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                    disabled={currentQuestion === 0}
                    className="px-6 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
                >
                    Back
                </button>

                {currentQuestion === ADKAR_QUESTIONS.length - 1 ? (
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || Object.keys(responses).length < ADKAR_QUESTIONS.length}
                        className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Submitting...' : 'Complete Assessment'}
                    </button>
                ) : (
                    <button
                        onClick={() => setCurrentQuestion(currentQuestion + 1)}
                        disabled={!responses[currentQ.id]}
                        className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                    >
                        Next
                    </button>
                )}
            </div>
        </div>
    );
};
