/**
 * DemoModeBanner Component
 *
 * Displays a prominent banner when demo mode is active.
 * Shows demo organization info and provides quick exit action.
 */
import React, { useState } from 'react';
import {
  X,
  Building2,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Eye,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useDemo } from '../../hooks/useDemo';
import { useAppStore } from '../../store/useAppStore';

interface DemoModeBannerProps {
  className?: string;
}

export const DemoModeBanner: React.FC<DemoModeBannerProps> = ({ className = '' }) => {
  const { currentUser } = useAppStore();
  const { isDemoMode, demoOrganization, demoStats, demoHints, isDemoLoading, exitDemoMode } =
    useDemo();

  const [isExpanded, setIsExpanded] = useState(false);

  // Don't show demo banner for SuperAdmin - they have access to all orgs including demo
  const isSuperAdmin = currentUser?.role?.toUpperCase() === 'SUPERADMIN';

  if (!isDemoMode || isSuperAdmin) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className={`bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg ${className}`}
      >
        {/* Main Banner Row */}
        <div className="px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Left: Demo indicator */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1">
                <FlaskConical className="w-4 h-4" />
                <span className="text-sm font-semibold">TRYB DEMO</span>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span className="font-medium">{demoOrganization?.name || 'Acme Digital Corp'}</span>
              </div>

              {/* Stats badges */}
              {demoStats && (
                <div className="hidden md:flex items-center gap-2 text-xs">
                  <span className="bg-white/15 rounded px-2 py-0.5">
                    {demoStats.projects} projektów
                  </span>
                  <span className="bg-white/15 rounded px-2 py-0.5">
                    {demoStats.initiatives} inicjatyw
                  </span>
                </div>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* Expand/collapse button */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="hidden sm:flex items-center gap-1 text-xs bg-white/15 hover:bg-white/25 rounded px-2 py-1 transition-colors"
              >
                <Lightbulb className="w-3 h-3" />
                <span>Wskazówki</span>
                {isExpanded ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              {/* Exit demo button */}
              <button
                onClick={exitDemoMode}
                disabled={isDemoLoading}
                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isDemoLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Zakończ demo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Expanded hints section */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 py-3 bg-black/20 border-t border-white/10">
                <div className="max-w-7xl mx-auto">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Warning */}
                    <div className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-300 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-yellow-300">Tryb tylko do odczytu</p>
                        <p className="text-white/70 text-xs">Zmiany nie są zapisywane</p>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex items-start gap-2 text-sm">
                      <Eye className="w-4 h-4 mt-0.5 text-blue-300 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-blue-300">Eksploruj funkcje</p>
                        <p className="text-white/70 text-xs">Przeglądaj wszystkie moduły</p>
                      </div>
                    </div>

                    {/* Hints */}
                    <div className="flex items-start gap-2 text-sm">
                      <Lightbulb className="w-4 h-4 mt-0.5 text-green-300 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-green-300">Wskazówka</p>
                        <p className="text-white/70 text-xs">
                          {demoHints?.[0] || 'Kliknij na inicjatywy, aby zobaczyć szczegóły'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default DemoModeBanner;
