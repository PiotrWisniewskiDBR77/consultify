import React from 'react';

export const EntryFooter: React.FC = () => {
    const sections = [
        {
            title: 'Product',
            links: [
                { label: 'Demo', href: '/demo' },
                { label: 'Trial', href: '#' },
                { label: 'Log in', href: '#' }
            ]
        },
        {
            title: 'Company',
            links: [
                { label: 'About', href: '#' },
                { label: 'Contact', href: '#' }
            ]
        },
        {
            title: 'Legal',
            links: [
                { label: 'Privacy', href: '#' },
                { label: 'Terms', href: '#' }
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
                            Empowering organizations to navigate digital transformation with AI-driven strategy and human-led governance.
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
                        © 2025 Consultinity. Powered by DBR77 Robotics.
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
