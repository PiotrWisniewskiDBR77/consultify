import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingScreen = () => (
    <div className="flex items-center justify-center min-h-screen bg-navy-950 text-white">
        <Loader2 className="animate-spin text-blue-500" size={48} />
    </div>
);
