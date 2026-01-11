/**
 * ArtifactViewer - Displays artifact content based on type
 * Routes to appropriate renderer for code, markdown, HTML, diagrams, etc.
 */

import React from 'react';

import { Artifact } from '../../../types';

// Lazy load DiagramRenderer to avoid bundling mermaidjs (2MB+) in initial chunks
const DiagramRenderer = React.lazy(() =>
  import('./renderers/DiagramRenderer').then((m) => ({ default: m.DiagramRenderer }))
);

// Lazy load ReactFlowDiagramRenderer for node-based diagrams
const ReactFlowDiagramRenderer = React.lazy(() =>
  import('./renderers/ReactFlowDiagramRenderer').then((m) => ({
    default: m.ReactFlowDiagramRenderer,
  }))
);

import { Loader2 } from 'lucide-react';

import { CodeRenderer } from './renderers/CodeRenderer';
import { HTMLPreview } from './renderers/HTMLPreview';
import { MarkdownRenderer } from './renderers/MarkdownRenderer';
import { PMODocumentRenderer } from './renderers/PMODocumentRenderer';
import { TableRenderer } from './renderers/TableRenderer';

interface ArtifactViewerProps {
  artifact: Artifact;
  className?: string;
}

export const ArtifactViewer: React.FC<ArtifactViewerProps> = ({ artifact, className = '' }) => {
  const renderContent = () => {
    switch (artifact.type) {
      case 'code':
        return (
          <CodeRenderer content={artifact.content} language={artifact.language || 'plaintext'} />
        );

      case 'markdown':
        return <MarkdownRenderer content={artifact.content} />;

      case 'html':
        return <HTMLPreview content={artifact.content} />;

      case 'diagram':
        // Check if this is a React Flow diagram (has diagramData) or Mermaid (content string)
        if (artifact.diagramData && artifact.diagramData.nodes) {
          return (
            <React.Suspense
              fallback={
                <div className="flex h-64 items-center justify-center text-slate-400 dark:text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm">Loading diagram...</span>
                  </div>
                </div>
              }
            >
              <ReactFlowDiagramRenderer diagramData={artifact.diagramData} />
            </React.Suspense>
          );
        }
        // Fallback to Mermaid for text-based diagrams
        return (
          <React.Suspense
            fallback={
              <div className="flex h-64 items-center justify-center text-slate-400 dark:text-slate-500">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm">Loading diagram engine...</span>
                </div>
              </div>
            }
          >
            <DiagramRenderer content={artifact.content} />
          </React.Suspense>
        );

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

  return <div className={`h-full overflow-auto ${className}`}>{renderContent()}</div>;
};

export default ArtifactViewer;
