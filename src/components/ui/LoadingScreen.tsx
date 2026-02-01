import { Loader2 } from 'lucide-react';
import React from 'react';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => (
  <div
    className="flex flex-col items-center justify-center min-h-screen bg-navy-950 text-white gap-4"
    role="status"
    aria-label={message || 'Loading'}
  >
    <Loader2 className="animate-spin text-blue-500" size={48} />
    {message && <p className="text-slate-400 font-medium animate-pulse">{message}</p>}
  </div>
);
