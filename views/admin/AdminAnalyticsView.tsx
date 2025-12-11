
import React, { useState, useEffect } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import {
    Cpu, Zap, AlertTriangle, TrendingUp, DollarSign, Activity,
    MessageSquare, Lightbulb, Target, CheckCircle, Clock
} from 'lucide-react';
import { Api } from '../../services/api';

export const AdminAnalyticsView: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [ideas, setIdeas] = useState<any[]>([]);
    const [observations, setObservations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'kpis' | 'ideas' | 'observations'>('kpis');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [statsData, ideasData, obsData] = await Promise.all([
                Api.getAIDeepReports(),
                Api.getAIIdeas(),
                Api.getAIObservations()
            ]);
            setStats(statsData);
            setIdeas(ideasData);
            setObservations(obsData);
        } catch (error) {
            console.error("Failed to load AI analytics", error);
        } finally {
            setLoading(false);
        }
    };

    const handleVoteIdea = async (id: string, status: string) => {
        try {
            await Api.updateAIIdea(id, { status });
            loadData();
        } catch (e) {
            console.error("Failed to update idea", e);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">AI Strategic Center</h1>
                <div className="flex space-x-2">
                    <button
                        onClick={() => setActiveTab('kpis')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'kpis' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                        Performance & KPIs
                    </button>
                    <button
                        onClick={() => setActiveTab('ideas')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'ideas' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                        Strategic Ideas
                    </button>
                    <button
                        onClick={() => setActiveTab('observations')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'observations' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                        Observations
                    </button>
                </div>
            </div>

            {activeTab === 'kpis' && (
                <div className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Success Rate</p>
                                    <p className="text-2xl font-bold text-green-600">{(stats?.successRate * 100).toFixed(1)}%</p>
                                </div>
                                <div className="p-3 bg-green-50 rounded-full">
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Avg Response Time</p>
                                    <p className="text-2xl font-bold text-indigo-600">1.2s</p>
                                </div>
                                <div className="p-3 bg-indigo-50 rounded-full">
                                    <Clock className="w-6 h-6 text-indigo-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Total Tokens</p>
                                    <p className="text-2xl font-bold text-purple-600">{stats?.totalTokens?.toLocaleString() || '1.2M'}</p>
                                </div>
                                <div className="p-3 bg-purple-50 rounded-full">
                                    <Cpu className="w-6 h-6 text-purple-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Est. Cost</p>
                                    <p className="text-2xl font-bold text-amber-600">${stats?.estimatedCost?.toFixed(2) || '0.00'}</p>
                                </div>
                                <div className="p-3 bg-amber-50 rounded-full">
                                    <DollarSign className="w-6 h-6 text-amber-600" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-semibold mb-4 text-gray-800">Failure Modes Analysis</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats?.topFailureModes || []}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="reason" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#EF4444" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-semibold mb-4 text-gray-800">Token Usage Trend</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={stats?.usageTrend || []}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" />
                                        <YAxis />
                                        <Tooltip />
                                        <Line type="monotone" dataKey="tokens" stroke="#6366f1" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'ideas' && (
                <div className="space-y-6">
                    <div className="flex justify-between">
                        <h2 className="text-lg font-semibold text-gray-800">Strategic Ideas Board</h2>
                        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors flex items-center">
                            <Lightbulb className="w-4 h-4 mr-2" />
                            Submit New Idea
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {ideas.map((idea) => (
                            <div key={idea.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${idea.priority === 'high' ? 'bg-red-100 text-red-700' :
                                        idea.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                                        }`}>
                                        {idea.priority?.toUpperCase()}
                                    </div>
                                    <span className="text-xs text-gray-400">{new Date(idea.createdAt).toLocaleDateString()}</span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">{idea.title}</h3>
                                <p className="text-gray-600 text-sm mb-4 line-clamp-3">{idea.description}</p>
                                <div className="flex justify-between items-center pt-4 border-t border-gray-50">
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => handleVoteIdea(idea.id, 'approved')}
                                            className="p-1 hover:bg-green-50 rounded text-green-600" title="Approve">
                                            <CheckCircle className="w-5 h-5" />
                                        </button>
                                        <button className="p-1 hover:bg-red-50 rounded text-red-600" title="Reject">
                                            <AlertTriangle className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <span className={`text-xs font-medium px-2 py-1 rounded ${idea.status === 'new' ? 'bg-blue-50 text-blue-600' :
                                        idea.status === 'approved' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {idea.status?.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {ideas.length === 0 && (
                            <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <Lightbulb className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                <p>No strategic ideas yet. Start by creating one!</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'observations' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-800">System Observations Log</h2>
                        <p className="text-sm text-gray-500">Automated insights and anomalies detected by the AI Monitor</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {observations.map((obs) => (
                            <div key={obs.id} className="p-6 hover:bg-gray-50 transition-colors">
                                <div className="flex items-start">
                                    <div className={`mt-1 p-2 rounded-lg mr-4 ${obs.category === 'anomaly' ? 'bg-red-100 text-red-600' :
                                        obs.category === 'insight' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {obs.category === 'anomaly' ? <AlertTriangle className="w-5 h-5" /> :
                                            obs.category === 'insight' ? <Lightbulb className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between mb-1">
                                            <span className="font-semibold text-gray-900">Observation #{obs.id.substring(0, 8)}</span>
                                            <span className="text-xs text-gray-500">{new Date(obs.created_at).toLocaleString()}</span>
                                        </div>
                                        <p className="text-gray-600 text-sm">{obs.content}</p>
                                        <div className="mt-2 flex items-center space-x-4">
                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Confidence: {(obs.confidence_score * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {observations.length === 0 && (
                            <div className="p-12 text-center text-gray-500">
                                <Activity className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                <p>No observations recorded yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminAnalyticsView;
