import React from 'react';
import { useTranslation } from 'react-i18next';

export const EntryFooter: React.FC = () => {
    const { t } = useTranslation();

    const sections = [
        {
            title: t('landing.footer.product.title'),
            links: [
                { label: t('landing.footer.product.demo'), href: '/demo' },
                { label: t('landing.footer.product.trial'), href: '#' },
                { label: t('landing.footer.product.login'), href: '#' }
            ]
        },
        {
            title: t('landing.footer.company.title'),
            links: [
                { label: t('landing.footer.company.about'), href: '#' },
                { label: t('landing.footer.company.contact'), href: '#' }
            ]
        },
        {
            title: t('landing.footer.legal.title'),
            links: [
                { label: t('landing.footer.legal.privacy'), href: '#' },
                { label: t('landing.footer.legal.terms'), href: '#' }
            ]
        }
    ];

    return (
        <footer className="bg-white dark:bg-navy-950 border-t border-slate-200 dark:border-white/5 py-20 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12">
                    <div className="col-span-2 space-y-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-black text-sm tracking-tighter">CT</span>
                            </div>
                            <span className="text-lg font-bold tracking-tight text-navy-950 dark:text-white uppercase font-sans">
                                Consultinity
                            </span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed max-w-xs">
                            {t('landing.footer.tagline')}
                        </p>
                    </div>

                    {sections.map((section, idx) => (
                        <div key={idx} className="space-y-4">
                            <h4 className="text-xs font-bold text-navy-950 dark:text-white uppercase tracking-widest">{section.title}</h4>
                            <ul className="space-y-2">
                                {section.links.map((link, lIdx) => (
                                    <li key={lIdx}>
                                        <a href={link.href} className="text-sm text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="mt-20 pt-8 border-t border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                        {t('landing.footer.copyright')}
                    </p>
                    <div className="flex gap-6">
                        {['LinkedIn', 'Twitter', 'YouTube'].map(social => (
                            <a key={social} href="#" className="text-[10px] font-bold text-slate-400 hover:text-navy-950 dark:hover:text-white uppercase tracking-widest transition-colors">
                                {social}
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
};
