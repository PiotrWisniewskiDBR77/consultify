/**
 * ArtifactViewer - Displays artifact content based on type
 * Routes to appropriate renderer for code, markdown, HTML, diagrams, etc.
 */

import React from 'react';
import { Artifact } from '../../../types';
import { MarkdownRenderer } from './renderers/MarkdownRenderer';
import { CodeRenderer } from './renderers/CodeRenderer';
import { HTMLPreview } from './renderers/HTMLPreview';
import { DiagramRenderer } from './renderers/DiagramRenderer';
import { TableRenderer } from './renderers/TableRenderer';
import { PMODocumentRenderer } from './renderers/PMODocumentRenderer';

interface ArtifactViewerProps {
  artifact: Artifact;
  className?: string;
}

export const ArtifactViewer: React.FC<ArtifactViewerProps> = ({ artifact, className = '' }) => {
  const renderContent = () => {
    switch (artifact.type) {
      case 'code':
        return (
          <CodeRenderer 
            content={artifact.content} 
            language={artifact.language || 'plaintext'} 
          />
        );
      
      case 'markdown':
        return <MarkdownRenderer content={artifact.content} />;
      
      case 'html':
        return <HTMLPreview content={artifact.content} />;
      
      case 'diagram':
        return <DiagramRenderer content={artifact.content} />;
      
      case 'table':
        return <TableRenderer content={artifact.content} />;
      
      case 'pmo-document':
        return (
          <PMODocumentRenderer 
            content={artifact.content} 
            templateType={artifact.metadata?.templateType}
            framework={artifact.metadata?.framework}
          />
        );
      
      default:
        return (
          <div className="p-4 text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-mono text-sm">
            {artifact.content}
          </div>
        );
    }
  };

  return (
    <div className={`h-full overflow-auto ${className}`}>
      {renderContent()}
    </div>
  );
};

export default ArtifactViewer;








