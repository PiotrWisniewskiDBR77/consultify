import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Link2, Twitter, Github, Globe, Briefcase, Plus, Trash2,
    Save, Loader2, CheckCircle, ExternalLink
} from 'lucide-react';
import { Api } from '../../services/api';
import { User, ExtendedSocialLinks, CustomSocialLink } from '../../types';

interface SocialLinksSectionProps {
    currentUser: User;
    onUpdate?: () => void;
}

// Predefined social platforms with icons
const SOCIAL_PLATFORMS = [
    { id: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/username', prefix: 'https://linkedin.com/in/' },
    { id: 'twitter', label: 'Twitter / X', placeholder: '@username or handle', prefix: 'https://twitter.com/' },
    { id: 'github', label: 'GitHub', placeholder: 'github.com/username', prefix: 'https://github.com/' },
    { id: 'website', label: 'Personal Website', placeholder: 'https://yourwebsite.com', prefix: '' },
    { id: 'portfolio', label: 'Portfolio', placeholder: 'https://portfolio.com', prefix: '' },
];

export const SocialLinksSection: React.FC<SocialLinksSectionProps> = ({ 
    currentUser, 
    onUpdate 
}) => {
    const { t } = useTranslation();
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    
    const [socialLinks, setSocialLinks] = useState<ExtendedSocialLinks>({
        twitter: '',
        github: '',
        linkedin: '',
        website: '',
        portfolio: '',
        custom: []
    });
    
    const [customLinks, setCustomLinks] = useState<CustomSocialLink[]>([]);
    const [newCustomLink, setNewCustomLink] = useState({ name: '', url: '' });

    // Load data on mount
    useEffect(() => {
        loadSocialLinks();
    }, [currentUser.id]);

    const loadSocialLinks = async () => {
        try {
            const response = await Api.get('/profile/social-links');
            if (response.socialLinks) {
                setSocialLinks({
                    twitter: response.socialLinks.twitter || '',
                    github: response.socialLinks.github || '',
                    linkedin: currentUser.linkedinId || '', // Also check main user object
                    website: response.socialLinks.website || '',
                    portfolio: response.socialLinks.portfolio || '',
                    custom: []
                });
                setCustomLinks(response.socialLinks.custom || []);
            }
        } catch (error) {
            console.error('Failed to load social links:', error);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await Api.put('/profile/social-links', {
                twitter: socialLinks.twitter,
                github: socialLinks.github,
                linkedin: socialLinks.linkedin,
                website: socialLinks.website,
                portfolio: socialLinks.portfolio,
                custom: customLinks
            });
            setSaveStatus('success');
            onUpdate?.();
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            console.error('Failed to save social links:', error);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    const addCustomLink = () => {
        if (newCustomLink.name && newCustomLink.url) {
            setCustomLinks(prev => [...prev, { ...newCustomLink }]);
            setNewCustomLink({ name: '', url: '' });
        }
    };

    const removeCustomLink = (index: number) => {
        setCustomLinks(prev => prev.filter((_, i) => i !== index));
    };

    const updateSocialLink = (platform: string, value: string) => {
        setSocialLinks(prev => ({
            ...prev,
            [platform]: value
        }));
    };

    const getIcon = (platform: string) => {
        switch (platform) {
            case 'twitter': return <Twitter size={16} />;
            case 'github': return <Github size={16} />;
            case 'linkedin': return <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>;
            case 'website': return <Globe size={16} />;
            case 'portfolio': return <Briefcase size={16} />;
            default: return <Link2 size={16} />;
        }
    };

    // Styling classes
    const inputClass = "w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-md text-navy-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all";
    const inputWithIconClass = "w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-md text-navy-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all";
    const labelClass = "text-xs font-medium text-slate-500 dark:text-slate-400";
    const cardClass = "bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg p-6";
    const sectionTitleClass = "text-sm font-bold text-navy-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2";

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                        {t('settings.profile.social.title', 'Social & Links')}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('settings.profile.social.description', 'Connect your social profiles and share your online presence')}
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </button>
            </div>

            {/* Social Platforms */}
            <div className={cardClass}>
                <h4 className={sectionTitleClass}>
                    <Link2 size={16} className="text-purple-500" />
                    {t('settings.profile.social.socialProfiles', 'Social Profiles')}
                </h4>
                
                <div className="space-y-4">
                    {SOCIAL_PLATFORMS.map(platform => (
                        <div key={platform.id} className="space-y-1.5">
                            <label className={labelClass}>{platform.label}</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    {getIcon(platform.id)}
                                </span>
                                <input
                                    value={socialLinks[platform.id as keyof ExtendedSocialLinks] as string || ''}
                                    onChange={e => updateSocialLink(platform.id, e.target.value)}
                                    placeholder={platform.placeholder}
                                    className={inputWithIconClass}
                                />
                                {socialLinks[platform.id as keyof ExtendedSocialLinks] && (
                                    <a
                                        href={platform.prefix + socialLinks[platform.id as keyof ExtendedSocialLinks]}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-500 transition-colors"
                                    >
                                        <ExternalLink size={14} />
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Custom Links */}
            <div className={cardClass}>
                <h4 className={sectionTitleClass}>
                    <Plus size={16} className="text-purple-500" />
                    {t('settings.profile.social.customLinks', 'Custom Links')}
                </h4>
                
                {/* Existing custom links */}
                {customLinks.length > 0 && (
                    <div className="space-y-3 mb-4">
                        {customLinks.map((link, index) => (
                            <div 
                                key={index}
                                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-navy-950/50 rounded-lg"
                            >
                                <Link2 size={16} className="text-slate-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-navy-900 dark:text-white truncate">
                                        {link.name}
                                    </p>
                                    <p className="text-xs text-slate-500 truncate">
                                        {link.url}
                                    </p>
                                </div>
                                <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-400 hover:text-purple-500 transition-colors"
                                >
                                    <ExternalLink size={14} />
                                </a>
                                <button
                                    onClick={() => removeCustomLink(index)}
                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add new custom link */}
                <div className="border border-dashed border-slate-200 dark:border-white/10 rounded-lg p-4">
                    <p className="text-xs text-slate-500 mb-3">
                        {t('settings.profile.social.addCustomLink', 'Add a custom link to your portfolio, blog, or any other website')}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                            value={newCustomLink.name}
                            onChange={e => setNewCustomLink(prev => ({ ...prev, name: e.target.value }))}
                            placeholder={t('settings.profile.social.linkName', 'Link name (e.g. My Blog)')}
                            className={inputClass}
                        />
                        <input
                            value={newCustomLink.url}
                            onChange={e => setNewCustomLink(prev => ({ ...prev, url: e.target.value }))}
                            placeholder="https://..."
                            className={inputClass}
                        />
                    </div>
                    <button
                        onClick={addCustomLink}
                        disabled={!newCustomLink.name || !newCustomLink.url}
                        className="mt-3 flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-navy-950 hover:bg-slate-200 dark:hover:bg-navy-800 text-slate-600 dark:text-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                        <Plus size={16} />
                        {t('settings.profile.social.addLink', 'Add Link')}
                    </button>
                </div>
            </div>

            {/* Success Toast */}
            {saveStatus === 'success' && (
                <div className="fixed bottom-8 right-8 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 z-50">
                    <CheckCircle size={16} />
                    {t('common.saved', 'Saved!')}
                </div>
            )}
        </div>
    );
};

export default SocialLinksSection;




