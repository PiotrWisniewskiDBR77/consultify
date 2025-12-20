import React, { useState, useEffect } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';

/**
 * CRIT-04: Location Filter Component
 * Allows filtering tasks/initiatives by location
 */

interface Location {
    id: string;
    name: string;
    country?: string;
}

interface LocationFilterProps {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    organizationId?: string;
}

export const LocationFilter: React.FC<LocationFilterProps> = ({
    selectedIds,
    onChange,
    organizationId
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [locations, setLocations] = useState<Location[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchLocations();
    }, [organizationId]);

    const fetchLocations = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/locations', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setLocations(data || []);
            } else {
                // Fallback - create mock locations if endpoint doesn't exist
                setLocations([
                    { id: 'all', name: 'All Locations' },
                    { id: 'hq', name: 'Headquarters' },
                    { id: 'remote', name: 'Remote' }
                ]);
            }
        } catch (err) {
            // Fallback data
            setLocations([
                { id: 'all', name: 'All Locations' }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleLocation = (id: string) => {
        if (id === 'all') {
            onChange([]);
            return;
        }

        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter(i => i !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    const displayText = selectedIds.length === 0
        ? 'All Locations'
        : selectedIds.length === 1
            ? locations.find(l => l.id === selectedIds[0])?.name || 'Selected'
            : `${selectedIds.length} locations`;

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 transition-colors border border-slate-200 dark:border-white/10"
            >
                <MapPin size={16} />
                {displayText}
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full mt-1 left-0 z-20 w-56 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg shadow-lg py-1">
                        {isLoading ? (
                            <div className="px-3 py-2 text-sm text-slate-500">Loading...</div>
                        ) : (
                            <>
                                <button
                                    onClick={() => toggleLocation('all')}
                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 ${selectedIds.length === 0 ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-600 dark:text-slate-300'
                                        }`}
                                >
                                    <div className={`w-4 h-4 rounded border ${selectedIds.length === 0 ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
                                        {selectedIds.length === 0 && <span className="text-white text-xs flex items-center justify-center h-full">✓</span>}
                                    </div>
                                    All Locations
                                </button>
                                {locations.filter(l => l.id !== 'all').map(loc => (
                                    <button
                                        key={loc.id}
                                        onClick={() => toggleLocation(loc.id)}
                                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 ${selectedIds.includes(loc.id) ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-600 dark:text-slate-300'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 rounded border ${selectedIds.includes(loc.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
                                            {selectedIds.includes(loc.id) && <span className="text-white text-xs flex items-center justify-center h-full">✓</span>}
                                        </div>
                                        {loc.name}
                                        {loc.country && <span className="text-slate-400 dark:text-slate-500 text-xs ml-1">({loc.country})</span>}
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default LocationFilter;
