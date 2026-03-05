/**
 * ImportExternalMap — Import mind maps from FreeMind (.mm XML) and
 * XMind (.xmind ZIP with content.json) formats.
 */
import { FileUp, Loader2, Upload, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface ImportedNode {
  id: string;
  label: string;
  children: ImportedNode[];
}

interface ImportExternalMapProps {
  open: boolean;
  onClose: () => void;
  locked: boolean;
  onImport: (nodes: Array<{ label: string; parentLabel?: string; branchKey?: string }>) => void;
}

function parseFreeMindXML(xml: string): ImportedNode | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const root = doc.querySelector('node');
    if (!root) return null;

    let counter = 0;
    function parseNode(el: Element): ImportedNode {
      const label = el.getAttribute('TEXT') || el.getAttribute('text') || `Node ${++counter}`;
      const children: ImportedNode[] = [];
      const childEls = el.querySelectorAll(':scope > node');
      childEls.forEach((child) => children.push(parseNode(child)));
      return { id: `imported-${counter++}`, label, children };
    }

    return parseNode(root);
  } catch {
    return null;
  }
}

async function parseXMindZip(file: File): Promise<ImportedNode | null> {
  try {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(file);
    const contentFile = zip.file('content.json');
    if (!contentFile) {
      const metaFile = zip.file('metadata.json');
      if (!metaFile) return null;
    }

    const contentStr = contentFile ? await contentFile.async('string') : null;
    if (!contentStr) return null;

    const content = JSON.parse(contentStr);
    const sheet = Array.isArray(content) ? content[0] : content;
    const rootTopic = sheet?.rootTopic || sheet?.topic;
    if (!rootTopic) return null;

    let counter = 0;
    function parseTopic(topic: any): ImportedNode {
      const label = topic.title || `Topic ${++counter}`;
      const children: ImportedNode[] = [];
      const attached = topic.children?.attached || topic.children || [];
      if (Array.isArray(attached)) {
        for (const child of attached) children.push(parseTopic(child));
      }
      return { id: `imported-${counter++}`, label, children };
    }

    return parseTopic(rootTopic);
  } catch {
    return null;
  }
}

function flattenTree(root: ImportedNode): Array<{ label: string; parentLabel?: string; branchKey?: string }> {
  const result: Array<{ label: string; parentLabel?: string; branchKey?: string }> = [];

  for (const branch of root.children) {
    result.push({ label: branch.label, branchKey: 'options' });
    for (const idea of branch.children) {
      result.push({ label: idea.label, parentLabel: branch.label });
      for (const sub of idea.children) {
        result.push({ label: sub.label, parentLabel: idea.label });
      }
    }
  }

  return result;
}

export const ImportExternalMap: React.FC<ImportExternalMapProps> = ({ open, onClose, locked, onImport }) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportedNode | null>(null);
  const [fileName, setFileName] = useState('');

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setFileName(file.name);

    try {
      let root: ImportedNode | null = null;

      if (file.name.endsWith('.mm')) {
        const text = await file.text();
        root = parseFreeMindXML(text);
      } else if (file.name.endsWith('.xmind')) {
        root = await parseXMindZip(file);
      } else {
        toast.error(isPl ? 'Nieobsługiwany format. Użyj .mm lub .xmind' : 'Unsupported format. Use .mm or .xmind');
        setLoading(false);
        return;
      }

      if (!root) {
        toast.error(isPl ? 'Nie udało się sparsować pliku' : 'Failed to parse file');
      } else {
        setPreview(root);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  }, [isPl]);

  const handleImport = useCallback(() => {
    if (!preview) return;
    const flat = flattenTree(preview);
    onImport(flat);
    toast.success(isPl ? `Zaimportowano ${flat.length} elementów` : `Imported ${flat.length} items`, { duration: 1500 });
    onClose();
  }, [isPl, onClose, onImport, preview]);

  const renderTree = (node: ImportedNode, depth: number = 0): React.ReactNode => (
    <div key={node.id} style={{ marginLeft: depth * 16 }}>
      <div className={`text-[${depth === 0 ? '12' : '10'}px] ${depth === 0 ? 'font-bold text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-300'} py-0.5`}>
        {depth > 0 && <span className="text-slate-300 mr-1">{'─'.repeat(Math.min(depth, 3))}</span>}
        {node.label}
      </div>
      {node.children.map((child) => renderTree(child, depth + 1))}
    </div>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center gap-2">
            <FileUp size={16} className="text-sky-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              {isPl ? 'Import mapy' : 'Import Mind Map'}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {!preview && !loading && (
            <div className="text-center py-6">
              <Upload size={36} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                {isPl ? 'Importuj mapę z pliku .mm (FreeMind) lub .xmind (XMind).' : 'Import a map from .mm (FreeMind) or .xmind (XMind) file.'}
              </p>
              <input ref={fileRef} type="file" accept=".mm,.xmind" onChange={handleFile} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={locked}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500/15 to-blue-500/10 text-[11px] font-bold text-sky-700 dark:text-sky-300 hover:from-sky-500/25 hover:to-blue-500/15 transition-all disabled:opacity-40"
              >
                <Upload size={14} />
                {isPl ? 'Wybierz plik' : 'Choose file'}
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 size={16} className="animate-spin text-sky-500" />
              <span className="text-[11px] text-slate-500">{isPl ? 'Parsuję...' : 'Parsing...'}</span>
            </div>
          )}

          {preview && (
            <>
              <div className="mb-3 p-2 rounded-xl bg-sky-500/5 border border-sky-500/10">
                <div className="text-[10px] font-bold text-sky-700 dark:text-sky-300">{fileName}</div>
                <div className="text-[9px] text-slate-400">{preview.children.length} {isPl ? 'gałęzi' : 'branches'}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-navy-950/20 border border-slate-200/30 dark:border-navy-700/30 max-h-[250px] overflow-y-auto">
                {renderTree(preview)}
              </div>
            </>
          )}
        </div>

        {preview && (
          <div className="px-5 py-3 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center gap-2">
            <button onClick={() => { setPreview(null); setFileName(''); }} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
              {isPl ? 'Inny plik' : 'Different file'}
            </button>
            <button onClick={handleImport} disabled={locked} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-sky-500/15 to-blue-500/10 text-sky-700 dark:text-sky-300 hover:from-sky-500/25 hover:to-blue-500/15 border border-sky-500/10 transition-all disabled:opacity-40">
              <FileUp size={12} />
              {isPl ? 'Importuj do mapy' : 'Import to map'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportExternalMap;
