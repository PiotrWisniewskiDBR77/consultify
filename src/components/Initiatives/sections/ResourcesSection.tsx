/**
 * ResourcesSection - FTE allocation, budget, tools
 */

import { motion } from 'framer-motion';
import { DollarSign, Loader2, Plus, Sparkles, Users, X } from 'lucide-react';
import React, { useState } from 'react';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

interface Resource {
  id: string;
  name: string;
  role: string;
  allocation: number; // percentage
  startDate?: string;
  endDate?: string;
}

export const ResourcesSection: React.FC<InitiativeSectionProps> = ({ sectionType, expanded, onToggle }) => {
  const { initiative, isPolish, isGeneratingAI, handleGenerateAI } = useInitiativeContext();

  const [resources, setResources] = useState<Resource[]>(initiative?.resources || []);
  const [budget, setBudget] = useState(initiative?.budget || '');
  const [tools, setTools] = useState<string[]>(initiative?.tools || []);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newAlloc, setNewAlloc] = useState('50');
  const [newTool, setNewTool] = useState('');

  const totalFTE = resources.reduce((acc, r) => acc + r.allocation, 0) / 100;

  return (
    <CollapsibleSection
      id="resources"
      title={isPolish ? 'Zasoby' : 'Resources'}
      icon={<Users size={18} className="text-teal-500 dark:text-teal-400" />}
      iconBg="bg-gradient-to-br from-teal-500/10 to-green-500/10 dark:from-teal-500/20 dark:to-green-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        <div className="flex items-center gap-2">
          {resources.length > 0 && <span className="text-xs text-slate-400">{totalFTE.toFixed(1)} FTE</span>}
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={(e) => { e.stopPropagation(); setShowAdd(true); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 hover:bg-teal-500/20 text-xs font-medium transition-all">
            <Plus size={14} /><span>{isPolish ? 'Dodaj' : 'Add'}</span>
          </motion.button>
          <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={async (e) => {
              e.stopPropagation();
              const result = await handleGenerateAI('resources');
              if (result?.parsedContent) {
                const data = result.parsedContent;
                if (data.fteAllocation?.length) {
                  setResources((prev) => [...prev, ...data.fteAllocation.map((a: any, i: number) => ({
                    id: `ai-${Date.now()}-${i}`,
                    name: a.role || '',
                    role: a.role || '',
                    allocation: Math.round((a.fte || 0.5) * 100),
                  }))]);
                }
                if (data.budgetEstimate) setBudget(data.budgetEstimate);
                if (data.toolsNeeded?.length) setTools(data.toolsNeeded);
              }
            }}
            disabled={isGeneratingAI === 'resources'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-all disabled:opacity-50">
            {isGeneratingAI === 'resources' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>AI</span>
          </motion.button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Budget */}
        <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/50 dark:border-navy-700/50">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-teal-500" />
            <span className="text-xs font-semibold text-slate-500 uppercase">{isPolish ? 'Budżet' : 'Budget'}</span>
          </div>
          <input type="text" value={budget} onChange={(e) => setBudget(e.target.value)}
            placeholder={isPolish ? 'Np. $50,000' : 'E.g. $50,000'}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-sm" />
        </div>

        {/* Add Resource Form */}
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl border-2 border-teal-300 dark:border-teal-500/50 bg-teal-50/30 dark:bg-teal-500/5 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={isPolish ? 'Imię / Stanowisko' : 'Name / Position'}
                className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm" autoFocus />
              <input type="text" value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder={isPolish ? 'Rola w projekcie' : 'Project role'}
                className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">{isPolish ? 'Alokacja' : 'Allocation'}</span>
              <input type="range" min="10" max="100" step="10" value={newAlloc} onChange={(e) => setNewAlloc(e.target.value)} className="flex-1" />
              <span className="text-sm font-medium text-teal-500 min-w-[40px] text-right">{newAlloc}%</span>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs text-slate-500">{isPolish ? 'Anuluj' : 'Cancel'}</button>
              <button onClick={() => {
                if (newName.trim()) {
                  setResources([...resources, { id: `res-${Date.now()}`, name: newName, role: newRole, allocation: parseInt(newAlloc) }]);
                  setNewName(''); setNewRole(''); setNewAlloc('50'); setShowAdd(false);
                }
              }} disabled={!newName.trim()} className="px-3 py-1.5 text-xs bg-teal-500 text-white rounded-lg disabled:opacity-50">{isPolish ? 'Dodaj' : 'Add'}</button>
            </div>
          </motion.div>
        )}

        {/* Resources List */}
        {resources.length === 0 && !showAdd ? (
          <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
            <Users size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-400">{isPolish ? 'Brak przypisanych zasobów' : 'No resources assigned'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {resources.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50/50 dark:bg-navy-800/50 border border-slate-200/50 dark:border-navy-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center text-xs font-bold text-teal-500">{r.allocation}%</div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{r.name}</p>
                    {r.role && <p className="text-xs text-slate-400">{r.role}</p>}
                  </div>
                </div>
                <button onClick={() => setResources(resources.filter((x) => x.id !== r.id))} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
              </div>
            ))}
            {/* Total FTE */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-navy-700">
              <span className="text-xs font-medium text-slate-500">{isPolish ? 'Łączne FTE' : 'Total FTE'}</span>
              <span className="text-sm font-semibold text-teal-500">{totalFTE.toFixed(1)} FTE</span>
            </div>
          </div>
        )}

        {/* Tools */}
        <div className="pt-3 border-t border-slate-200 dark:border-navy-700">
          <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">{isPolish ? 'Narzędzia i infrastruktura' : 'Tools & Infrastructure'}</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tools.map((tool, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300">
                {tool}
                <button onClick={() => setTools(tools.filter((_, j) => j !== i))} className="hover:text-red-500"><X size={12} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newTool} onChange={(e) => setNewTool(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newTool.trim()) { setTools([...tools, newTool.trim()]); setNewTool(''); } }}
              placeholder={isPolish ? 'Dodaj narzędzie...' : 'Add tool...'}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm" />
            <button onClick={() => { if (newTool.trim()) { setTools([...tools, newTool.trim()]); setNewTool(''); } }} disabled={!newTool.trim()}
              className="px-3 py-2 rounded-lg text-teal-500 border border-teal-200 dark:border-teal-500/30 disabled:opacity-50"><Plus size={16} /></button>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};
