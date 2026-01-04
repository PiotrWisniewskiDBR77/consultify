import {
    Activity,
    BarChart2,
    Check,
    Clock,
    Copy,
    DollarSign,
    Edit,
    Eye,
    Grid,
    Layout,
    Move,
    PieChart,
    Plus,
    Save,
    Settings,
    Share2,
    Trash2,
    TrendingUp,
    Users,
    X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Card } from '../../../components/ui/BaseCard';
import Api from '../../../services/api';

interface Widget {
    id: string;
    type: 'metric' | 'chart' | 'table' | 'list' | 'pie' | 'line';
    title: string;
    dataSource: string;
    config: Record<string, any>;
    position: { x: number; y: number; w: number; h: number };
}

interface Dashboard {
    id: string;
    name: string;
    description?: string;
    layout_json: string;
    widgets_json: string;
    is_shared: boolean;
    created_at: string;
    updated_at: string;
}

const WIDGET_TYPES = [
    { type: 'metric', icon: Activity, label: 'Metric Card', description: 'Single value with trend' },
    { type: 'chart', icon: BarChart2, label: 'Bar Chart', description: 'Compare values across categories' },
    { type: 'pie', icon: PieChart, label: 'Pie Chart', description: 'Show proportions' },
    { type: 'line', icon: TrendingUp, label: 'Line Chart', description: 'Track trends over time' },
    { type: 'table', icon: Grid, label: 'Data Table', description: 'Display tabular data' },
    { type: 'list', icon: Layout, label: 'List View', description: 'Show items in a list' },
];

const DATA_SOURCES = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'sessions', label: 'Sessions', icon: Clock },
    { id: 'organizations', label: 'Organizations', icon: Layout },
    { id: 'incidents', label: 'Security Incidents', icon: Activity },
];

const DashboardBuilderView: React.FC = () => {
    const [dashboards, setDashboards] = useState<Dashboard[]>([]);
    const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
    const [widgets, setWidgets] = useState<Widget[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showWidgetModal, setShowWidgetModal] = useState(false);
    const [newDashboard, setNewDashboard] = useState({ name: '', description: '' });
    const [newWidget, setNewWidget] = useState<Partial<Widget>>({
        type: 'metric',
        title: '',
        dataSource: 'users',
        config: {},
        position: { x: 0, y: 0, w: 2, h: 2 },
    });
    const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<Record<string, any>>({});

    useEffect(() => {
        fetchDashboards();
    }, []);

    const fetchDashboards = async () => {
        setIsLoading(true);
        try {
            const response = await Api.getAnalyticsDashboards();
            setDashboards(response.dashboards || []);
        } catch (error) {
            console.error('Failed to fetch dashboards:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDashboardData = async (dashboardId: string) => {
        try {
            const response = await Api.getAnalyticsDashboardData(dashboardId);
            setPreviewData(response.data || {});
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        }
    };

    const handleSelectDashboard = (dashboard: Dashboard) => {
        setSelectedDashboard(dashboard);
        try {
            const parsedWidgets = JSON.parse(dashboard.widgets_json || '[]');
            setWidgets(parsedWidgets);
        } catch {
            setWidgets([]);
        }
        fetchDashboardData(dashboard.id);
    };

    const handleCreateDashboard = async () => {
        if (!newDashboard.name) return;

        try {
            const response = await Api.createAnalyticsDashboard({
                name: newDashboard.name,
                description: newDashboard.description,
                layout: { columns: 4, rowHeight: 100 },
                widgets: [],
            });

            setDashboards([...dashboards, response.dashboard]);
            setShowCreateModal(false);
            setNewDashboard({ name: '', description: '' });
            handleSelectDashboard(response.dashboard);
        } catch (error) {
            console.error('Failed to create dashboard:', error);
        }
    };

    const handleSaveDashboard = async () => {
        if (!selectedDashboard) return;

        try {
            await Api.updateAnalyticsDashboard(selectedDashboard.id, {
                name: selectedDashboard.name,
                description: selectedDashboard.description,
                layout: JSON.parse(selectedDashboard.layout_json || '{}'),
                widgets: widgets,
            });

            setIsEditing(false);
            fetchDashboards();
        } catch (error) {
            console.error('Failed to save dashboard:', error);
        }
    };

    const handleDeleteDashboard = async (dashboardId: string) => {
        if (!confirm('Are you sure you want to delete this dashboard?')) return;

        try {
            await Api.deleteAnalyticsDashboard(dashboardId);
            setDashboards(dashboards.filter((d) => d.id !== dashboardId));
            if (selectedDashboard?.id === dashboardId) {
                setSelectedDashboard(null);
                setWidgets([]);
            }
        } catch (error) {
            console.error('Failed to delete dashboard:', error);
        }
    };

    const handleShareDashboard = async (dashboardId: string) => {
        try {
            await Api.shareAnalyticsDashboard(dashboardId, []);
            fetchDashboards();
        } catch (error) {
            console.error('Failed to share dashboard:', error);
        }
    };

    const handleAddWidget = () => {
        if (!newWidget.title || !newWidget.type || !newWidget.dataSource) return;

        const widget: Widget = {
            id: `widget-${Date.now()}`,
            type: newWidget.type as Widget['type'],
            title: newWidget.title,
            dataSource: newWidget.dataSource,
            config: newWidget.config || {},
            position: {
                x: (widgets.length % 2) * 2,
                y: Math.floor(widgets.length / 2) * 2,
                w: 2,
                h: 2,
            },
        };

        setWidgets([...widgets, widget]);
        setShowWidgetModal(false);
        setNewWidget({
            type: 'metric',
            title: '',
            dataSource: 'users',
            config: {},
            position: { x: 0, y: 0, w: 2, h: 2 },
        });
    };

    const handleRemoveWidget = (widgetId: string) => {
        setWidgets(widgets.filter((w) => w.id !== widgetId));
    };

    const handleDragStart = (widgetId: string) => {
        setDraggedWidget(widgetId);
    };

    const handleDragEnd = () => {
        setDraggedWidget(null);
    };

    const handleDrop = (targetIndex: number) => {
        if (!draggedWidget) return;

        const draggedIndex = widgets.findIndex((w) => w.id === draggedWidget);
        if (draggedIndex === targetIndex) return;

        const newWidgets = [...widgets];
        const [removed] = newWidgets.splice(draggedIndex, 1);
        newWidgets.splice(targetIndex, 0, removed);

        // Update positions
        newWidgets.forEach((widget, index) => {
            widget.position = {
                ...widget.position,
                x: (index % 2) * 2,
                y: Math.floor(index / 2) * 2,
            };
        });

        setWidgets(newWidgets);
        setDraggedWidget(null);
    };

    const renderWidgetPreview = (widget: Widget) => {
        const Icon = WIDGET_TYPES.find((wt) => wt.type === widget.type)?.icon || Activity;
        const data = previewData[widget.dataSource] || { value: 0, trend: 0 };

        switch (widget.type) {
            case 'metric':
                return (
                    <div className="flex flex-col items-center justify-center h-full">
                        <Icon className="w-8 h-8 text-blue-500 mb-2" />
                        <div className="text-3xl font-bold text-white">{data.value || '—'}</div>
                        <div className={`text-sm ${data.trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {data.trend >= 0 ? '+' : ''}
                            {data.trend || 0}%
                        </div>
                    </div>
                );
            case 'chart':
            case 'pie':
            case 'line':
                return (
                    <div className="flex items-center justify-center h-full">
                        <Icon className="w-16 h-16 text-gray-600" />
                        <span className="ml-2 text-gray-500">Chart Preview</span>
                    </div>
                );
            case 'table':
            case 'list':
                return (
                    <div className="flex items-center justify-center h-full">
                        <Icon className="w-16 h-16 text-gray-600" />
                        <span className="ml-2 text-gray-500">Data Preview</span>
                    </div>
                );
            default:
                return null;
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Dashboard Builder</h2>
                    <p className="text-gray-400 mt-1">Create and customize your analytics dashboards</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Dashboard
                </button>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Dashboard List */}
                <div className="col-span-3">
                    <Card className="bg-gray-800 p-4">
                        <h3 className="text-lg font-semibold text-white mb-4">My Dashboards</h3>
                        <div className="space-y-2">
                            {dashboards.length === 0 ? (
                                <p className="text-gray-500 text-sm">No dashboards yet. Create one to get started.</p>
                            ) : (
                                dashboards.map((dashboard) => (
                                    <div
                                        key={dashboard.id}
                                        onClick={() => handleSelectDashboard(dashboard)}
                                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                                            selectedDashboard?.id === dashboard.id
                                                ? 'bg-blue-600/20 border border-blue-500'
                                                : 'bg-gray-700/50 hover:bg-gray-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Layout className="w-4 h-4 text-blue-400" />
                                                <span className="text-white font-medium truncate">
                                                    {dashboard.name}
                                                </span>
                                            </div>
                                            {dashboard.is_shared && <Share2 className="w-3 h-3 text-green-400" />}
                                        </div>
                                        {dashboard.description && (
                                            <p className="text-gray-400 text-xs mt-1 truncate">
                                                {dashboard.description}
                                            </p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>

                {/* Dashboard Canvas */}
                <div className="col-span-9">
                    {selectedDashboard ? (
                        <Card className="bg-gray-800 p-4">
                            {/* Dashboard Header */}
                            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-700">
                                <div>
                                    <h3 className="text-xl font-bold text-white">{selectedDashboard.name}</h3>
                                    {selectedDashboard.description && (
                                        <p className="text-gray-400 text-sm mt-1">{selectedDashboard.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {isEditing ? (
                                        <>
                                            <button
                                                onClick={() => setShowWidgetModal(true)}
                                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add Widget
                                            </button>
                                            <button
                                                onClick={handleSaveDashboard}
                                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                                            >
                                                <Save className="w-4 h-4" />
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setIsEditing(false)}
                                                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                                            >
                                                <Edit className="w-4 h-4" />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleShareDashboard(selectedDashboard.id)}
                                                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                                            >
                                                <Share2 className="w-4 h-4" />
                                                Share
                                            </button>
                                            <button
                                                onClick={() => handleDeleteDashboard(selectedDashboard.id)}
                                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Widgets Grid */}
                            <div className="grid grid-cols-4 gap-4 min-h-[400px]">
                                {widgets.length === 0 ? (
                                    <div className="col-span-4 flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-600 rounded-lg">
                                        <Grid className="w-12 h-12 text-gray-500 mb-3" />
                                        <p className="text-gray-400">No widgets yet</p>
                                        {isEditing && (
                                            <button
                                                onClick={() => setShowWidgetModal(true)}
                                                className="mt-3 text-blue-400 hover:text-blue-300"
                                            >
                                                Add your first widget
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    widgets.map((widget, index) => (
                                        <div
                                            key={widget.id}
                                            draggable={isEditing}
                                            onDragStart={() => handleDragStart(widget.id)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={() => handleDrop(index)}
                                            className={`col-span-${widget.position.w} bg-gray-700/50 rounded-lg p-4 relative ${
                                                isEditing ? 'cursor-move' : ''
                                            } ${draggedWidget === widget.id ? 'opacity-50' : ''}`}
                                            style={{
                                                gridColumn: `span ${widget.position.w}`,
                                                minHeight: `${widget.position.h * 100}px`,
                                            }}
                                        >
                                            {isEditing && (
                                                <div className="absolute top-2 right-2 flex items-center gap-1">
                                                    <button className="p-1 hover:bg-gray-600 rounded">
                                                        <Move className="w-3 h-3 text-gray-400" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveWidget(widget.id)}
                                                        className="p-1 hover:bg-red-600 rounded"
                                                    >
                                                        <X className="w-3 h-3 text-gray-400" />
                                                    </button>
                                                </div>
                                            )}
                                            <h4 className="text-sm font-medium text-gray-300 mb-2">{widget.title}</h4>
                                            {renderWidgetPreview(widget)}
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    ) : (
                        <Card className="bg-gray-800 p-8">
                            <div className="flex flex-col items-center justify-center h-64">
                                <Layout className="w-16 h-16 text-gray-600 mb-4" />
                                <h3 className="text-xl font-semibold text-white mb-2">Select a Dashboard</h3>
                                <p className="text-gray-400 text-center">
                                    Choose a dashboard from the list or create a new one to get started
                                </p>
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {/* Create Dashboard Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold text-white mb-4">Create New Dashboard</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Dashboard Name</label>
                                <input
                                    type="text"
                                    value={newDashboard.name}
                                    onChange={(e) => setNewDashboard({ ...newDashboard, name: e.target.value })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="My Analytics Dashboard"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Description (Optional)
                                </label>
                                <textarea
                                    value={newDashboard.description}
                                    onChange={(e) => setNewDashboard({ ...newDashboard, description: e.target.value })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Describe your dashboard..."
                                    rows={3}
                                />
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
                                onClick={handleCreateDashboard}
                                disabled={!newDashboard.name}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Widget Modal */}
            {showWidgetModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Add Widget</h3>
                        <div className="grid grid-cols-2 gap-6">
                            {/* Widget Type Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Widget Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {WIDGET_TYPES.map((wt) => (
                                        <button
                                            key={wt.type}
                                            onClick={() =>
                                                setNewWidget({ ...newWidget, type: wt.type as Widget['type'] })
                                            }
                                            className={`p-3 rounded-lg text-left transition-colors ${
                                                newWidget.type === wt.type
                                                    ? 'bg-blue-600/20 border border-blue-500'
                                                    : 'bg-gray-700 hover:bg-gray-600'
                                            }`}
                                        >
                                            <wt.icon className="w-5 h-5 text-blue-400 mb-1" />
                                            <div className="text-sm font-medium text-white">{wt.label}</div>
                                            <div className="text-xs text-gray-400">{wt.description}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Widget Configuration */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Widget Title</label>
                                    <input
                                        type="text"
                                        value={newWidget.title || ''}
                                        onChange={(e) => setNewWidget({ ...newWidget, title: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Widget title"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Data Source</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {DATA_SOURCES.map((ds) => (
                                            <button
                                                key={ds.id}
                                                onClick={() => setNewWidget({ ...newWidget, dataSource: ds.id })}
                                                className={`p-2 rounded-lg flex items-center gap-2 transition-colors ${
                                                    newWidget.dataSource === ds.id
                                                        ? 'bg-blue-600/20 border border-blue-500'
                                                        : 'bg-gray-700 hover:bg-gray-600'
                                                }`}
                                            >
                                                <ds.icon className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm text-white">{ds.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Size</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={newWidget.position?.w || 2}
                                            onChange={(e) =>
                                                setNewWidget({
                                                    ...newWidget,
                                                    position: { ...newWidget.position!, w: parseInt(e.target.value) },
                                                })
                                            }
                                            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                        >
                                            <option value="1">1 col</option>
                                            <option value="2">2 cols</option>
                                            <option value="3">3 cols</option>
                                            <option value="4">4 cols</option>
                                        </select>
                                        <select
                                            value={newWidget.position?.h || 2}
                                            onChange={(e) =>
                                                setNewWidget({
                                                    ...newWidget,
                                                    position: { ...newWidget.position!, h: parseInt(e.target.value) },
                                                })
                                            }
                                            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                        >
                                            <option value="1">1 row</option>
                                            <option value="2">2 rows</option>
                                            <option value="3">3 rows</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowWidgetModal(false)}
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddWidget}
                                disabled={!newWidget.title}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Add Widget
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardBuilderView;

