import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Building2, Target, TrendingUp, Shield, Globe, Users, Briefcase,
    Save, RefreshCw, ChevronDown, ChevronUp, CheckCircle, AlertCircle,
    Loader2, Sparkles, BarChart3, Cpu, Lock
} from 'lucide-react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { User } from '../../types';

interface OrganizationProfileFormProps {
    currentUser: User;
    organizationId?: string;
}

interface OrganizationProfile {
    industry: string;
    industry_code: string;
    industry_subsector: string;
    company_size: 'STARTUP' | 'SMB' | 'MID_MARKET' | 'ENTERPRISE';
    employee_count: number;
    annual_revenue: number;
    founding_year: number;
    headquarters_country: string;
    strategic_priorities: string[];
    competitive_position: 'LEADER' | 'CHALLENGER' | 'FOLLOWER' | 'NICHE';
    growth_stage: 'STARTUP' | 'SCALE_UP' | 'MATURE' | 'TURNAROUND';
    mission_statement: string;
    vision_statement: string;
    digital_maturity_overall: number;
    technology_stack: string[];
    digital_budget_percent: number;
    cloud_adoption_level: 'NONE' | 'EXPLORING' | 'PARTIAL' | 'CLOUD_FIRST' | 'CLOUD_NATIVE';
    primary_markets: string[];
    customer_segments: string[];
    key_competitors: string[];
    market_share_estimate: number;
    regulatory_environment: string[];
    risk_appetite: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
    budget_constraints: string;
    timeline_constraints: string;
    preferred_language: string;
    communication_style: 'FORMAL' | 'PROFESSIONAL' | 'CASUAL';
    industry_jargon_level: 'LOW' | 'MEDIUM' | 'HIGH';
}

const INDUSTRIES = [
    'Technology', 'Financial Services', 'Healthcare', 'Industrial',
    'Consumer', 'Energy', 'Telecommunications', 'Real Estate',
    'Transportation', 'Education', 'Government', 'Other'
];

const COMPANY_SIZES = [
    { value: 'STARTUP', label: 'Startup (<50)', range: '< 50' },
    { value: 'SMB', label: 'SMB (50-250)', range: '50-250' },
    { value: 'MID_MARKET', label: 'Mid-Market (250-1000)', range: '250-1000' },
    { value: 'ENTERPRISE', label: 'Enterprise (1000+)', range: '1000+' }
];

const COMPETITIVE_POSITIONS = [
    { value: 'LEADER', label: 'Market Leader', description: 'Dominant position, setting industry standards' },
    { value: 'CHALLENGER', label: 'Challenger', description: 'Growing, actively competing for leadership' },
    { value: 'FOLLOWER', label: 'Follower', description: 'Stable position, following market trends' },
    { value: 'NICHE', label: 'Niche Player', description: 'Specialized focus on specific segments' }
];

const GROWTH_STAGES = [
    { value: 'STARTUP', label: 'Startup', description: 'Early stage, product-market fit focus' },
    { value: 'SCALE_UP', label: 'Scale-up', description: 'Rapid growth, scaling operations' },
    { value: 'MATURE', label: 'Mature', description: 'Established, optimizing efficiency' },
    { value: 'TURNAROUND', label: 'Turnaround', description: 'Restructuring or transformation' }
];

const CLOUD_LEVELS = [
    { value: 'NONE', label: 'None' },
    { value: 'EXPLORING', label: 'Exploring' },
    { value: 'PARTIAL', label: 'Partial' },
    { value: 'CLOUD_FIRST', label: 'Cloud-First' },
    { value: 'CLOUD_NATIVE', label: 'Cloud-Native' }
];

const RISK_APPETITES = [
    { value: 'CONSERVATIVE', label: 'Conservative', description: 'Low risk tolerance' },
    { value: 'MODERATE', label: 'Moderate', description: 'Balanced approach' },
    { value: 'AGGRESSIVE', label: 'Aggressive', description: 'High risk tolerance for growth' }
];

const REGULATIONS = [
    'GDPR', 'HIPAA', 'SOX', 'PCI-DSS', 'ISO 27001', 'SOC 2',
    'CCPA', 'DORA', 'NIS2', 'FISMA', 'FedRAMP'
];

export const OrganizationProfileForm: React.FC<OrganizationProfileFormProps> = ({
    currentUser,
    organizationId
}) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [completeness, setCompleteness] = useState(0);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        industry: true,
        company: false,
        strategic: false,
        digital: false,
        market: false,
        constraints: false,
        ai: false
    });
    
    const [profile, setProfile] = useState<Partial<OrganizationProfile>>({
        industry: '',
        company_size: 'MID_MARKET',
        competitive_position: 'CHALLENGER',
        growth_stage: 'MATURE',
        risk_appetite: 'MODERATE',
        cloud_adoption_level: 'PARTIAL',
        communication_style: 'PROFESSIONAL',
        industry_jargon_level: 'MEDIUM',
        preferred_language: 'pl',
        strategic_priorities: [],
        technology_stack: [],
        primary_markets: [],
        customer_segments: [],
        key_competitors: [],
        regulatory_environment: []
    });

    const effectiveOrgId = organizationId || currentUser.organizationId;

    useEffect(() => {
        if (effectiveOrgId) {
            fetchProfile();
        }
    }, [effectiveOrgId]);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const response = await Api.get(`/organization-profiles/${effectiveOrgId}`);
            if (response.exists && response.profile) {
                setProfile(response.profile);
            }
            setCompleteness(response.completeness || 0);
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!effectiveOrgId) return;
        
        try {
            setSaving(true);
            const response = await Api.put(`/organization-profiles/${effectiveOrgId}`, profile);
            setCompleteness(response.completeness || 0);
            toast.success('Profile saved successfully');
        } catch (error: any) {
            toast.error(error.message || 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    const handleAnalyze = async () => {
        if (!effectiveOrgId) return;
        
        try {
            setAnalyzing(true);
            const response = await Api.post(`/organization-profiles/${effectiveOrgId}/analyze`, {
                analysisType: 'strategic_positioning'
            });
            toast.success('Analysis complete');
            // Could open a modal with results
            console.log('Analysis:', response.analysis);
        } catch (error: any) {
            toast.error(error.message || 'Analysis failed');
        } finally {
            setAnalyzing(false);
        }
    };

    const updateField = (field: keyof OrganizationProfile, value: any) => {
        setProfile(prev => ({ ...prev, [field]: value }));
    };

    const updateArrayField = (field: keyof OrganizationProfile, value: string) => {
        const current = (profile[field] as string[]) || [];
        if (current.includes(value)) {
            updateField(field, current.filter(v => v !== value));
        } else {
            updateField(field, [...current, value]);
        }
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const renderSectionHeader = (
        id: string,
        title: string,
        icon: React.ReactNode,
        completionPct?: number
    ) => (
        <button
            onClick={() => toggleSection(id)}
            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-950/50 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-950 transition-colors"
        >
            <div className="flex items-center gap-3">
                <div className="text-purple-500">{icon}</div>
                <span className="font-semibold text-navy-900 dark:text-white">{title}</span>
                {completionPct !== undefined && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                        completionPct >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        completionPct >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                        {completionPct}%
                    </span>
                )}
            </div>
            {expandedSections[id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="animate-spin text-purple-500" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
                        <Building2 className="text-purple-500" />
                        Strategic Profile
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Define your organization context for AI-powered strategic insights
                    </p>
                </div>
                
                {/* Completeness Indicator */}
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-sm text-slate-500 dark:text-slate-400">Profile Completeness</div>
                        <div className="text-2xl font-bold text-navy-900 dark:text-white">{completeness}%</div>
                    </div>
                    <div className="w-16 h-16 relative">
                        <svg className="w-16 h-16 transform -rotate-90">
                            <circle
                                cx="32" cy="32" r="28"
                                className="stroke-slate-200 dark:stroke-slate-700"
                                strokeWidth="4" fill="none"
                            />
                            <circle
                                cx="32" cy="32" r="28"
                                className="stroke-purple-500"
                                strokeWidth="4" fill="none"
                                strokeDasharray={`${completeness * 1.76} 176`}
                                strokeLinecap="round"
                            />
                        </svg>
                        {completeness >= 80 && (
                            <CheckCircle className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-green-500" size={24} />
                        )}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Save Profile
                </button>
                <button
                    onClick={handleAnalyze}
                    disabled={analyzing || completeness < 30}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-navy-900 dark:text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                    {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    AI Analysis
                </button>
                <button
                    onClick={fetchProfile}
                    className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {/* Sections */}
            <div className="space-y-4">
                {/* Industry Context */}
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                    {renderSectionHeader('industry', 'Industry Context', <Briefcase size={20} />)}
                    {expandedSections.industry && (
                        <div className="p-6 space-y-4 border-t border-slate-200 dark:border-white/10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Industry *
                                    </label>
                                    <select
                                        value={profile.industry || ''}
                                        onChange={(e) => updateField('industry', e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    >
                                        <option value="">Select Industry</option>
                                        {INDUSTRIES.map(ind => (
                                            <option key={ind} value={ind}>{ind}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Industry Subsector
                                    </label>
                                    <input
                                        type="text"
                                        value={profile.industry_subsector || ''}
                                        onChange={(e) => updateField('industry_subsector', e.target.value)}
                                        placeholder="e.g., SaaS, Fintech, E-commerce"
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Industry Code (NAICS/GICS)
                                </label>
                                <input
                                    type="text"
                                    value={profile.industry_code || ''}
                                    onChange={(e) => updateField('industry_code', e.target.value)}
                                    placeholder="e.g., 5112, 5221"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Company Info */}
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                    {renderSectionHeader('company', 'Company Information', <Building2 size={20} />)}
                    {expandedSections.company && (
                        <div className="p-6 space-y-4 border-t border-slate-200 dark:border-white/10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Company Size *
                                    </label>
                                    <select
                                        value={profile.company_size || 'MID_MARKET'}
                                        onChange={(e) => updateField('company_size', e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    >
                                        {COMPANY_SIZES.map(size => (
                                            <option key={size.value} value={size.value}>{size.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Employee Count
                                    </label>
                                    <input
                                        type="number"
                                        value={profile.employee_count || ''}
                                        onChange={(e) => updateField('employee_count', parseInt(e.target.value) || null)}
                                        placeholder="e.g., 500"
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Annual Revenue (USD)
                                    </label>
                                    <input
                                        type="number"
                                        value={profile.annual_revenue || ''}
                                        onChange={(e) => updateField('annual_revenue', parseFloat(e.target.value) || null)}
                                        placeholder="e.g., 50000000"
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Founding Year
                                    </label>
                                    <input
                                        type="number"
                                        value={profile.founding_year || ''}
                                        onChange={(e) => updateField('founding_year', parseInt(e.target.value) || null)}
                                        placeholder="e.g., 2010"
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Headquarters Country
                                </label>
                                <input
                                    type="text"
                                    value={profile.headquarters_country || ''}
                                    onChange={(e) => updateField('headquarters_country', e.target.value)}
                                    placeholder="e.g., Poland"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Strategic Context */}
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                    {renderSectionHeader('strategic', 'Strategic Context', <Target size={20} />)}
                    {expandedSections.strategic && (
                        <div className="p-6 space-y-4 border-t border-slate-200 dark:border-white/10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Competitive Position *
                                    </label>
                                    <select
                                        value={profile.competitive_position || 'CHALLENGER'}
                                        onChange={(e) => updateField('competitive_position', e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    >
                                        {COMPETITIVE_POSITIONS.map(pos => (
                                            <option key={pos.value} value={pos.value}>{pos.label}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {COMPETITIVE_POSITIONS.find(p => p.value === profile.competitive_position)?.description}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Growth Stage *
                                    </label>
                                    <select
                                        value={profile.growth_stage || 'MATURE'}
                                        onChange={(e) => updateField('growth_stage', e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    >
                                        {GROWTH_STAGES.map(stage => (
                                            <option key={stage.value} value={stage.value}>{stage.label}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {GROWTH_STAGES.find(s => s.value === profile.growth_stage)?.description}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Strategic Priorities (comma-separated)
                                </label>
                                <input
                                    type="text"
                                    value={(profile.strategic_priorities || []).join(', ')}
                                    onChange={(e) => updateField('strategic_priorities', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                    placeholder="e.g., Digital transformation, Customer experience, Cost optimization"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Mission Statement
                                </label>
                                <textarea
                                    value={profile.mission_statement || ''}
                                    onChange={(e) => updateField('mission_statement', e.target.value)}
                                    rows={2}
                                    placeholder="What is your organization's mission?"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Digital Context */}
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                    {renderSectionHeader('digital', 'Digital & Technology', <Cpu size={20} />)}
                    {expandedSections.digital && (
                        <div className="p-6 space-y-4 border-t border-slate-200 dark:border-white/10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Digital Maturity Self-Assessment (1-7)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="7"
                                        step="0.1"
                                        value={profile.digital_maturity_overall || ''}
                                        onChange={(e) => updateField('digital_maturity_overall', parseFloat(e.target.value) || null)}
                                        placeholder="e.g., 4.5"
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Cloud Adoption Level
                                    </label>
                                    <select
                                        value={profile.cloud_adoption_level || 'PARTIAL'}
                                        onChange={(e) => updateField('cloud_adoption_level', e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    >
                                        {CLOUD_LEVELS.map(level => (
                                            <option key={level.value} value={level.value}>{level.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Digital Budget (% of total IT spend)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={profile.digital_budget_percent || ''}
                                    onChange={(e) => updateField('digital_budget_percent', parseFloat(e.target.value) || null)}
                                    placeholder="e.g., 25"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Technology Stack (comma-separated)
                                </label>
                                <input
                                    type="text"
                                    value={(profile.technology_stack || []).join(', ')}
                                    onChange={(e) => updateField('technology_stack', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                    placeholder="e.g., AWS, React, Python, Kubernetes"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Market Context */}
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                    {renderSectionHeader('market', 'Market & Competition', <TrendingUp size={20} />)}
                    {expandedSections.market && (
                        <div className="p-6 space-y-4 border-t border-slate-200 dark:border-white/10">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Primary Markets (comma-separated)
                                </label>
                                <input
                                    type="text"
                                    value={(profile.primary_markets || []).join(', ')}
                                    onChange={(e) => updateField('primary_markets', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                    placeholder="e.g., Poland, DACH, CEE"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Customer Segments (comma-separated)
                                </label>
                                <input
                                    type="text"
                                    value={(profile.customer_segments || []).join(', ')}
                                    onChange={(e) => updateField('customer_segments', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                    placeholder="e.g., B2B, Enterprise, SMB"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Key Competitors (comma-separated)
                                </label>
                                <input
                                    type="text"
                                    value={(profile.key_competitors || []).join(', ')}
                                    onChange={(e) => updateField('key_competitors', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                    placeholder="e.g., Competitor A, Competitor B"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Estimated Market Share (%)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={profile.market_share_estimate || ''}
                                    onChange={(e) => updateField('market_share_estimate', parseFloat(e.target.value) || null)}
                                    placeholder="e.g., 15"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Constraints */}
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                    {renderSectionHeader('constraints', 'Constraints & Risk', <Shield size={20} />)}
                    {expandedSections.constraints && (
                        <div className="p-6 space-y-4 border-t border-slate-200 dark:border-white/10">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Regulatory Environment
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {REGULATIONS.map(reg => (
                                        <button
                                            key={reg}
                                            onClick={() => updateArrayField('regulatory_environment', reg)}
                                            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                                                (profile.regulatory_environment || []).includes(reg)
                                                    ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-500/30 dark:text-purple-300'
                                                    : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-navy-950 dark:border-white/10 dark:text-slate-400 hover:border-purple-300'
                                            }`}
                                        >
                                            {reg}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Risk Appetite
                                </label>
                                <div className="flex gap-3">
                                    {RISK_APPETITES.map(risk => (
                                        <button
                                            key={risk.value}
                                            onClick={() => updateField('risk_appetite', risk.value)}
                                            className={`flex-1 p-3 rounded-lg border text-center transition-colors ${
                                                profile.risk_appetite === risk.value
                                                    ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-500/30 dark:text-purple-300'
                                                    : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-navy-950 dark:border-white/10 dark:text-slate-400 hover:border-purple-300'
                                            }`}
                                        >
                                            <div className="font-medium">{risk.label}</div>
                                            <div className="text-xs mt-1 opacity-70">{risk.description}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Budget Constraints
                                </label>
                                <textarea
                                    value={profile.budget_constraints || ''}
                                    onChange={(e) => updateField('budget_constraints', e.target.value)}
                                    rows={2}
                                    placeholder="Describe any budget limitations or constraints..."
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Timeline Constraints
                                </label>
                                <textarea
                                    value={profile.timeline_constraints || ''}
                                    onChange={(e) => updateField('timeline_constraints', e.target.value)}
                                    rows={2}
                                    placeholder="Describe any timeline pressures or deadlines..."
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Save Button (Bottom) */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Save Strategic Profile
                </button>
            </div>
        </div>
    );
};

export default OrganizationProfileForm;


