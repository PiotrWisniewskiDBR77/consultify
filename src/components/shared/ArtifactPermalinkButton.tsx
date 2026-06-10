import { Link2 } from 'lucide-react';
import React from 'react';
import toast from 'react-hot-toast';

import { ArtifactType, buildArtifactCode, buildArtifactPermalink } from '@/utils/artifactLinks';

interface ArtifactPermalinkButtonProps {
  artifactType: ArtifactType;
  artifactId: string;
  isPolish?: boolean;
  size?: number;
  className?: string;
}

export const ArtifactPermalinkButton: React.FC<ArtifactPermalinkButtonProps> = ({
  artifactType,
  artifactId,
  isPolish = false,
  size = 13,
  className = '',
}) => {
  const code = buildArtifactCode(artifactType, artifactId);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildArtifactPermalink(artifactType, artifactId));
      toast.success(isPolish ? 'Permalink skopiowany' : 'Permalink copied');
    } catch {
      toast.error(isPolish ? 'Nie udało się skopiować linku' : 'Failed to copy link');
    }
  };

  return (
    <div className="relative inline-flex items-center group">
      <button
        onClick={() => void handleCopy()}
        className={`p-1.5 rounded-md text-slate-600 hover:text-primary-400 hover:bg-primary-500/10 transition-colors ${className}`}
        title={isPolish ? 'Kopiuj permalink' : 'Copy permalink'}
      >
        <Link2 size={size} />
      </button>
      <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200/70 dark:border-navy-700/70 bg-white/95 dark:bg-navy-900/95 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {isPolish ? 'Kopiuj permalink' : 'Copy permalink'} • {code}
      </div>
    </div>
  );
};

export default ArtifactPermalinkButton;
