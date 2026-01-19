/**
 * PersonaSelector - Dropdown to select AI personas in chat
 * Shows available personas with quick access to favorites
 *
 * @version 1.0.0
 */

import {
  Bot,
  Check,
  ChevronDown,
  Heart,
  Plus,
  Search,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../../store/useAppStore';

export interface Persona {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  category?: string;
  rating?: number;
  usage_count?: number;
  is_favorited?: boolean;
  is_verified?: boolean;
  is_featured?: boolean;
}

interface PersonaSelectorProps {
  selectedPersona?: Persona | null;
  onSelect: (persona: Persona | null) => void;
  onOpenBuilder?: () => void;
  onOpenMarketplace?: () => void;
}

// Default system persona
const DEFAULT_PERSONA: Persona = {
  id: 'default',
  name: 'Consultify AI',
  description: 'Domyślny asystent AI',
  category: 'system',
  is_verified: true,
};

export const PersonaSelector: React.FC<PersonaSelectorProps> = ({
  selectedPersona,
  onSelect,
  onOpenBuilder,
  onOpenMarketplace,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [favorites, setFavorites] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Load personas
  useEffect(() => {
    if (isOpen) {
      loadPersonas();
      searchRef.current?.focus();
    }
  }, [isOpen]);

  const loadPersonas = async () => {
    setIsLoading(true);
    try {
      // In production, fetch from API
      // const response = await fetch('/api/personas');
      // const data = await response.json();

      // Mock data for now
      const mockPersonas: Persona[] = [
        {
          id: 'persona_business_analyst',
          name: 'Business Analyst',
          description: 'Expert in business analysis and strategic planning',
          category: 'business',
          rating: 4.8,
          is_verified: true,
          is_featured: true,
        },
        {
          id: 'persona_code_reviewer',
          name: 'Code Reviewer',
          description: 'Expert code review for best practices',
          category: 'technical',
          rating: 4.9,
          is_verified: true,
          is_featured: true,
        },
        {
          id: 'persona_creative_writer',
          name: 'Creative Writer',
          description: 'Marketing copy and storytelling',
          category: 'creative',
          rating: 4.7,
          is_verified: true,
        },
        {
          id: 'persona_project_coach',
          name: 'Project Management Coach',
          description: 'PMO expert for project planning',
          category: 'business',
          rating: 4.6,
          is_verified: true,
        },
      ];

      setPersonas(mockPersonas);
      setFavorites(mockPersonas.filter((p) => p.is_favorited));
    } catch (error) {
      console.error('Failed to load personas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = useCallback(
    (persona: Persona | null) => {
      onSelect(persona);
      setIsOpen(false);
    },
    [onSelect]
  );

  const filteredPersonas = personas.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const currentPersona = selectedPersona || DEFAULT_PERSONA;

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
      >
        {currentPersona.avatar_url ? (
          <img
            src={currentPersona.avatar_url}
            alt={currentPersona.name}
            className="w-5 h-5 rounded-full"
          />
        ) : (
          <Bot size={16} className="text-primary-500" />
        )}
        <span className="max-w-[120px] truncate">{currentPersona.name}</span>
        {currentPersona.is_verified && (
          <Sparkles size={12} className="text-primary-500" />
        )}
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 z-50 w-80 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2 duration-150">
          {/* Search */}
          <div className="p-2 border-b border-slate-200 dark:border-navy-700">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('personas.search', 'Search personas...')}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-navy-900 border-0 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {/* Default Option */}
            <button
              onClick={() => handleSelect(null)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
                !selectedPersona ? 'bg-primary-50 dark:bg-primary-900/20' : ''
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <Bot size={16} className="text-primary-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {DEFAULT_PERSONA.name}
                  </span>
                  <Sparkles size={12} className="text-primary-500" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {DEFAULT_PERSONA.description}
                </p>
              </div>
              {!selectedPersona && <Check size={16} className="text-primary-500 shrink-0" />}
            </button>

            {/* Favorites Section */}
            {favorites.length > 0 && !search && (
              <>
                <div className="px-3 py-1.5 bg-slate-50 dark:bg-navy-800/50">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('personas.favorites', 'Favorites')}
                  </span>
                </div>
                {favorites.map((persona) => (
                  <PersonaOption
                    key={persona.id}
                    persona={persona}
                    isSelected={selectedPersona?.id === persona.id}
                    onSelect={handleSelect}
                  />
                ))}
              </>
            )}

            {/* All Personas */}
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-navy-800/50">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {search
                  ? t('personas.results', 'Results')
                  : t('personas.featured', 'Featured')}
              </span>
            </div>

            {isLoading ? (
              <div className="px-3 py-4 text-center">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : filteredPersonas.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                {t('personas.noResults', 'No personas found')}
              </div>
            ) : (
              filteredPersonas.map((persona) => (
                <PersonaOption
                  key={persona.id}
                  persona={persona}
                  isSelected={selectedPersona?.id === persona.id}
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-200 dark:border-navy-700 p-2 flex gap-2">
            {onOpenBuilder && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenBuilder();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              >
                <Plus size={14} />
                {t('personas.create', 'Create')}
              </button>
            )}
            {onOpenMarketplace && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenMarketplace();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
              >
                <Users size={14} />
                {t('personas.marketplace', 'Marketplace')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Persona Option Component
interface PersonaOptionProps {
  persona: Persona;
  isSelected: boolean;
  onSelect: (persona: Persona) => void;
}

const PersonaOption: React.FC<PersonaOptionProps> = ({ persona, isSelected, onSelect }) => {
  return (
    <button
      onClick={() => onSelect(persona)}
      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
        isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''
      }`}
    >
      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-navy-700 flex items-center justify-center shrink-0">
        {persona.avatar_url ? (
          <img src={persona.avatar_url} alt={persona.name} className="w-8 h-8 rounded-full" />
        ) : (
          <Bot size={16} className="text-slate-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
            {persona.name}
          </span>
          {persona.is_verified && <Sparkles size={12} className="text-primary-500 shrink-0" />}
          {persona.is_featured && <Star size={12} className="text-amber-500 shrink-0" />}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{persona.description}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {persona.rating && (
          <span className="text-xs text-slate-400">{persona.rating.toFixed(1)}</span>
        )}
        {persona.is_favorited && <Heart size={14} className="text-red-500 fill-red-500" />}
        {isSelected && <Check size={16} className="text-primary-500" />}
      </div>
    </button>
  );
};

export default PersonaSelector;
