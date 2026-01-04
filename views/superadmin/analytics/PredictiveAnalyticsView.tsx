import {
    Activity,
    AlertTriangle,
    BarChart3,
    Brain,
    CheckCircle2,
    Database,
    DollarSign,
    LineChart,
    Loader2,
    Play,
    Plus,
    RefreshCw,
    Settings,
    Target,
    Trash2,
    TrendingUp,
    Users,
    Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Card } from '../../../components/ui/BaseCard';
import Api from '../../../services/api';

interface PredictiveModel {
    id: string;
    name: string;
    description?: string;
    model_type: string;
    training_data_json?: string;
    model_config_json?: string;
    accuracy_score?: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface Prediction {
    id: string;
    model_id: string;
    prediction_type: string;
    input_data_json: string;
    prediction_result_json: string;
    confidence_score?: number;
    created_at: string;
}

const MODEL_TYPES = [
    { id: 'churn', label: 'Churn Prediction', icon: Users, description: 'Predict customer churn risk' },
    { id: 'revenue', label: 'Revenue Forecast', icon: DollarSign, description: 'Forecast future revenue' },
    { id: 'growth', label: 'Growth Prediction', icon: TrendingUp, description: 'Predict user growth' },
    { id: 'engagement', label: 'Engagement Score', icon: Activity, description: 'Predict user engagement' },
    { id: 'custom', label: 'Custom Model', icon: Brain, description: 'Train custom ML model' },
];

const PredictiveAnalyticsView: React.FC = () => {
    const [models, setModels] = useState<PredictiveModel[]>([]);
    const [selectedModel, setSelectedModel] = useState<PredictiveModel | null>(null);
    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTraining, setIsTraining] = useState(false);
    const [isPredicting, setIsPredicting] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPredictModal, setShowPredictModal] = useState(false);
    const [predictionResult, setPredictionResult] = useState<any>(null);

    const [newModel, setNewModel] = useState({
        name: '',
        description: '',
        modelType: 'churn',
        trainingData: {},
        modelConfig: {},
    });

    const [predictionInput, setPredictionInput] = useState('{}');

    useEffect(() => {
        fetchModels();
    }, []);

    const fetchModels = async () => {
        setIsLoading(true);
        try {
            const data = await Api.getPredictiveModels();
            setModels(data || []);
        } catch (error) {
            console.error('Failed to fetch models:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPredictions = async (modelId: string) => {
        try {
            const data = await Api.getModelPredictions(modelId);
            setPredictions(data || []);
        } catch (error) {
            console.error('Failed to fetch predictions:', error);
        }
    };

    const handleSelectModel = (model: PredictiveModel) => {
        setSelectedModel(model);
        setPredictionResult(null);
        fetchPredictions(model.id);
    };

    const handleCreateModel = async () => {
        if (!newModel.name || !newModel.modelType) return;

        try {
            await Api.createPredictiveModel(newModel);
            setShowCreateModal(false);
            setNewModel({
                name: '',
                description: '',
                modelType: 'churn',
                trainingData: {},
                modelConfig: {},
            });
            fetchModels();
        } catch (error) {
            console.error('Failed to create model:', error);
        }
    };

    const handleDeleteModel = async (modelId: string) => {
        if (!confirm('Are you sure you want to delete this model?')) return;

        try {
            await Api.deletePredictiveModel(modelId);
            if (selectedModel?.id === modelId) {
                setSelectedModel(null);
                setPredictions([]);
            }
            fetchModels();
        } catch (error) {
            console.error('Failed to delete model:', error);
        }
    };

    const handleTrainModel = async () => {
        if (!selectedModel) return;

        setIsTraining(true);
        try {
            const result = await Api.trainPredictiveModel(selectedModel.id);
            fetchModels();
            if (result.accuracyScore !== undefined) {
                setSelectedModel({
                    ...selectedModel,
                    accuracy_score: result.accuracyScore,
                });
            }
        } catch (error) {
            console.error('Failed to train model:', error);
        } finally {
            setIsTraining(false);
        }
    };

    const handleMakePrediction = async () => {
        if (!selectedModel) return;

        setIsPredicting(true);
        try {
            let inputData = {};
            try {
                inputData = JSON.parse(predictionInput);
            } catch {
                inputData = {};
            }

            const result = await Api.makePrediction(selectedModel.id, inputData);
            setPredictionResult(result);
            setShowPredictModal(false);
            fetchPredictions(selectedModel.id);
        } catch (error) {
            console.error('Failed to make prediction:', error);
        } finally {
            setIsPredicting(false);
        }
    };

    const getModelTypeInfo = (type: string) => {
        return MODEL_TYPES.find((mt) => mt.id === type) || MODEL_TYPES[4];
    };

    const getAccuracyColor = (score?: number) => {
        if (!score) return 'gray';
        if (score >= 0.9) return 'green';
        if (score >= 0.7) return 'yellow';
        return 'red';
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Predictive Analytics</h2>
                    <p className="text-gray-400 mt-1">ML-powered predictions and forecasting</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Model
                </button>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Models List */}
                <div className="col-span-4">
                    <Card className="bg-gray-800 p-4">
                        <h3 className="text-lg font-semibold text-white mb-4">ML Models ({models.length})</h3>
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                            {models.length === 0 ? (
                                <div className="text-center py-8">
                                    <Brain className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-500 text-sm">No models yet</p>
                                    <button
                                        onClick={() => setShowCreateModal(true)}
                                        className="text-blue-400 hover:text-blue-300 text-sm mt-2"
                                    >
                                        Create your first model
                                    </button>
                                </div>
                            ) : (
                                models.map((model) => {
                                    const typeInfo = getModelTypeInfo(model.model_type);
                                    const TypeIcon = typeInfo.icon;
                                    const accuracyColor = getAccuracyColor(model.accuracy_score);

                                    return (
                                        <div
                                            key={model.id}
                                            onClick={() => handleSelectModel(model)}
                                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                                                selectedModel?.id === model.id
                                                    ? 'bg-blue-600/20 border border-blue-500'
                                                    : 'bg-gray-700/50 hover:bg-gray-700'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-purple-500/20 rounded-lg">
                                                    <TypeIcon className="w-4 h-4 text-purple-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-medium truncate">
                                                            {model.name}
                                                        </span>
                                                        {model.is_active && (
                                                            <span className="w-2 h-2 bg-green-400 rounded-full" />
                                                        )}
                                                    </div>
                                                    <p className="text-gray-400 text-xs mt-1">{typeInfo.label}</p>
                                                    {model.accuracy_score !== undefined && (
                                                        <div className="flex items-center gap-1 mt-2">
                                                            <Target className="w-3 h-3 text-gray-400" />
                                                            <span className={`text-xs text-${accuracyColor}-400`}>
                                                                {(model.accuracy_score * 100).toFixed(1)}% accuracy
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </Card>
                </div>

                {/* Model Details */}
                <div className="col-span-8">
                    {selectedModel ? (
                        <div className="space-y-4">
                            {/* Model Header */}
                            <Card className="bg-gray-800 p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{selectedModel.name}</h3>
                                        {selectedModel.description && (
                                            <p className="text-gray-400 text-sm mt-1">{selectedModel.description}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleTrainModel}
                                            disabled={isTraining}
                                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                                        >
                                            {isTraining ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Zap className="w-4 h-4" />
                                            )}
                                            Train Model
                                        </button>
                                        <button
                                            onClick={() => setShowPredictModal(true)}
                                            disabled={!selectedModel.accuracy_score}
                                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                                        >
                                            <Play className="w-4 h-4" />
                                            Predict
                                        </button>
                                        <button
                                            onClick={() => handleDeleteModel(selectedModel.id)}
                                            className="p-2 text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Model Stats */}
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="bg-gray-700/50 rounded-lg p-3">
                                        <span className="text-gray-400 text-xs">Type</span>
                                        <p className="text-white font-medium mt-1">
                                            {getModelTypeInfo(selectedModel.model_type).label}
                                        </p>
                                    </div>
                                    <div className="bg-gray-700/50 rounded-lg p-3">
                                        <span className="text-gray-400 text-xs">Accuracy</span>
                                        <p
                                            className={`font-bold text-lg mt-1 text-${getAccuracyColor(selectedModel.accuracy_score)}-400`}
                                        >
                                            {selectedModel.accuracy_score !== undefined
                                                ? `${(selectedModel.accuracy_score * 100).toFixed(1)}%`
                                                : 'Not trained'}
                                        </p>
                                    </div>
                                    <div className="bg-gray-700/50 rounded-lg p-3">
                                        <span className="text-gray-400 text-xs">Status</span>
                                        <p
                                            className={`font-medium mt-1 ${selectedModel.is_active ? 'text-green-400' : 'text-gray-400'}`}
                                        >
                                            {selectedModel.is_active ? 'Active' : 'Inactive'}
                                        </p>
                                    </div>
                                    <div className="bg-gray-700/50 rounded-lg p-3">
                                        <span className="text-gray-400 text-xs">Last Updated</span>
                                        <p className="text-white text-sm mt-1">
                                            {formatDate(selectedModel.updated_at)}
                                        </p>
                                    </div>
                                </div>
                            </Card>

                            {/* Latest Prediction Result */}
                            {predictionResult && (
                                <Card className="bg-gray-800 p-4">
                                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                                        Latest Prediction
                                    </h4>
                                    <div className="bg-gray-700/50 rounded-lg p-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="text-gray-400 text-xs">Predicted Value</span>
                                                <p className="text-2xl font-bold text-white mt-1">
                                                    {predictionResult.predictedValue || predictionResult.result || '-'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-gray-400 text-xs">Confidence</span>
                                                <p className="text-2xl font-bold text-blue-400 mt-1">
                                                    {predictionResult.confidence
                                                        ? `${(predictionResult.confidence * 100).toFixed(1)}%`
                                                        : '-'}
                                                </p>
                                            </div>
                                        </div>
                                        {predictionResult.factors && (
                                            <div className="mt-4">
                                                <span className="text-gray-400 text-xs">Key Factors</span>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {Object.entries(predictionResult.factors).map(
                                                        ([key, value]: [string, any]) => (
                                                            <span
                                                                key={key}
                                                                className="px-2 py-1 bg-gray-600 rounded text-xs text-white"
                                                            >
                                                                {key}: {String(value)}
                                                            </span>
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            )}

                            {/* Prediction History */}
                            <Card className="bg-gray-800 p-4">
                                <h4 className="text-lg font-semibold text-white mb-4">Prediction History</h4>
                                {predictions.length === 0 ? (
                                    <p className="text-gray-500 text-sm text-center py-4">
                                        No predictions yet. Train the model and make predictions.
                                    </p>
                                ) : (
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                        {predictions.map((pred) => {
                                            let result;
                                            try {
                                                result = JSON.parse(pred.prediction_result_json);
                                            } catch {
                                                result = {};
                                            }

                                            return (
                                                <div
                                                    key={pred.id}
                                                    className="flex items-center justify-between p-2 bg-gray-700/30 rounded-lg"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <BarChart3 className="w-4 h-4 text-purple-400" />
                                                        <div>
                                                            <span className="text-white text-sm">
                                                                {result.predictedValue || 'Prediction'}
                                                            </span>
                                                            <p className="text-gray-400 text-xs">
                                                                {formatDate(pred.created_at)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {pred.confidence_score !== undefined && (
                                                        <span className="text-xs text-blue-400">
                                                            {(pred.confidence_score * 100).toFixed(1)}% confidence
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </Card>
                        </div>
                    ) : (
                        <Card className="bg-gray-800 p-8">
                            <div className="flex flex-col items-center justify-center h-64">
                                <Brain className="w-16 h-16 text-gray-600 mb-4" />
                                <h3 className="text-xl font-semibold text-white mb-2">Select a Model</h3>
                                <p className="text-gray-400 text-center">
                                    Choose a model from the list or create a new one
                                </p>
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {/* Create Model Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg">
                        <h3 className="text-xl font-bold text-white mb-4">Create New Model</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Model Name</label>
                                <input
                                    type="text"
                                    value={newModel.name}
                                    onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    placeholder="Customer Churn Predictor"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                                <textarea
                                    value={newModel.description}
                                    onChange={(e) => setNewModel({ ...newModel, description: e.target.value })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    rows={2}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Model Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {MODEL_TYPES.map((mt) => (
                                        <button
                                            key={mt.id}
                                            onClick={() => setNewModel({ ...newModel, modelType: mt.id })}
                                            className={`p-3 rounded-lg text-left transition-colors ${
                                                newModel.modelType === mt.id
                                                    ? 'bg-purple-600/20 border border-purple-500'
                                                    : 'bg-gray-700 hover:bg-gray-600'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <mt.icon className="w-4 h-4 text-purple-400" />
                                                <span className="text-sm font-medium text-white">{mt.label}</span>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">{mt.description}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateModel}
                                disabled={!newModel.name}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                Create Model
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Predict Modal */}
            {showPredictModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold text-white mb-4">Make Prediction</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Input Data (JSON)
                                </label>
                                <textarea
                                    value={predictionInput}
                                    onChange={(e) => setPredictionInput(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white font-mono text-sm"
                                    rows={6}
                                    placeholder='{"feature1": "value1", "feature2": 123}'
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowPredictModal(false)}
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleMakePrediction}
                                disabled={isPredicting}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isPredicting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Run Prediction'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PredictiveAnalyticsView;


