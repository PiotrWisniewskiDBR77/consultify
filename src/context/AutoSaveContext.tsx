import React, { createContext, useContext, useState, ReactNode } from 'react';

type AutoSaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface AutoSaveContextType {
    status: AutoSaveStatus;
    setStatus: (status: AutoSaveStatus) => void;
    lastSaved: Date | null;
    setLastSaved: (date: Date | null) => void;
}

const AutoSaveContext = createContext<AutoSaveContextType | undefined>(undefined);

export const AutoSaveProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [status, setStatus] = useState<AutoSaveStatus>('saved');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    return (
        <AutoSaveContext.Provider value={{ status, setStatus, lastSaved, setLastSaved }}>
            {children}
        </AutoSaveContext.Provider>
    );
};

export const useAutoSave = () => {
    const context = useContext(AutoSaveContext);
    if (context === undefined) {
        throw new Error('useAutoSave must be used within an AutoSaveProvider');
    }
    return context;
};
