/**
 * VoiceImageInput — Voice dictation and image/screenshot → table rows.
 *
 * Features:
 * - Voice: Web Speech API for real-time dictation → AI parses into rows
 * - Image: Paste screenshot or drop image → AI OCR extracts data → rows
 * - Drag & drop zone for images
 */
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Square,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import type { TableNode } from './tableTypes';

interface VoiceImageInputProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  onAddRows: (rows: TableNode[]) => void;
}

type InputMode = 'voice' | 'image';

interface ParsedIdea {
  label: string;
  description?: string;
  category?: string;
  selected: boolean;
}

export const VoiceImageInput: React.FC<VoiceImageInputProps> = ({
  open,
  onClose,
  ideaId,
  onAddRows,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [mode, setMode] = useState<InputMode>('voice');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedIdeas, setParsedIdeas] = useState<ParsedIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Voice Recording ──────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setTranscript(
        t(
          'ideas.table.voiceImageInput.browserNoSpeechSupport',
          'Browser does not support speech recognition.'
        )
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = isPl ? 'pl-PL' : 'en-US';

    recognition.onresult = (event: any) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isPl, t]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  // ── Image handling ───────────────────────────────────────────────────────
  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) handleImageFile(file);
          e.preventDefault();
          return;
        }
      }
    },
    [handleImageFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleImageFile(file);
    },
    [handleImageFile]
  );

  // ── AI Parse ─────────────────────────────────────────────────────────────
  const handleParse = useCallback(async () => {
    const content =
      mode === 'voice' ? transcript : imagePreview ? 'Image uploaded for OCR analysis' : '';
    if (!content) return;

    setLoading(true);
    setParsedIdeas([]);
    try {
      const { Api } = await import('@/services/api');
      const prompt =
        mode === 'voice'
          ? `Parse this dictated text into separate ideas/items. Each idea should have a label and optional description. Text: "${transcript}". Return JSON: [{ "label": "...", "description": "...", "category": "..." }]`
          : `This is a description of an uploaded whiteboard/screenshot image. Extract all visible ideas, notes, and items from it. Return JSON: [{ "label": "...", "description": "...", "category": "..." }]`;

      const result = await Api.getIdeaAISuggestions(ideaId, {
        context: {
          title: mode === 'voice' ? 'Voice Input Parse' : 'Image OCR Parse',
          seedText: content,
          currentNodes: [],
          currentEdges: [],
          activeTool: 'table',
        },
        mode: 'on_demand',
        prompt,
        language: i18n.language,
      });

      const text = (result?.suggestions || []).map((s: any) => s.text || s.detail || '').join('');
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          setParsedIdeas(
            parsed.map((item: any) => ({
              label: item.label || item.title || '',
              description: item.description || '',
              category: item.category || '',
              selected: true,
            }))
          );
        }
      }

      if (parsedIdeas.length === 0) {
        const lines = transcript.split(/[.\n;]+/).filter((l) => l.trim().length > 3);
        setParsedIdeas(
          lines.map((line) => ({
            label: line.trim(),
            selected: true,
          }))
        );
      }
    } catch {
      const lines = transcript.split(/[.\n;]+/).filter((l) => l.trim().length > 3);
      setParsedIdeas(
        lines.map((line) => ({
          label: line.trim(),
          selected: true,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [i18n.language, ideaId, imagePreview, mode, parsedIdeas.length, transcript]);

  const handleAddSelected = useCallback(() => {
    const selected = parsedIdeas.filter((p) => p.selected);
    const newRows: TableNode[] = selected.map((idea, idx) => ({
      id: `node-${Date.now()}-${idx}`,
      type: 'idea',
      data: {
        label: idea.label,
        description: idea.description || '',
        category: idea.category || '',
        source: mode === 'voice' ? 'voice_input' : 'image_input',
      },
      position: { x: 0, y: 0 },
    }));
    onAddRows(newRows);
    onClose();
  }, [mode, onAddRows, onClose, parsedIdeas]);

  const toggleIdea = useCallback((idx: number) => {
    setParsedIdeas((prev) => prev.map((p, i) => (i === idx ? { ...p, selected: !p.selected } : p)));
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-image-input-heading"
        tabIndex={-1}
        className="w-[480px] max-w-[90vw] max-h-[80vh] rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl overflow-hidden flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
        onPaste={handlePaste}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-c-border-subtle">
          {mode === 'voice' ? (
            <Mic size={16} className="text-c-text-secondary" />
          ) : (
            <Camera size={16} className="text-c-text-secondary" />
          )}
          <span id="voice-image-input-heading" className="text-sm font-bold text-c-text">
            {mode === 'voice'
              ? t('ideas.table.voiceImageInput.voiceInputTitle', 'Voice Input')
              : t('ideas.table.voiceImageInput.imageToIdeasTitle', 'Image → Ideas')}
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-0.5 rounded-lg border border-c-border-subtle overflow-hidden">
            <button
              onClick={() => setMode('voice')}
              className={`px-2 py-1 text-[10px] font-bold transition-colors ${mode === 'voice' ? 'bg-c-surface-raised text-c-text' : 'text-c-text-secondary'}`}
            >
              <Mic size={10} className="inline mr-0.5" />
              {t('ideas.table.voiceImageInput.voice', 'Voice')}
            </button>
            <button
              onClick={() => setMode('image')}
              className={`px-2 py-1 text-[10px] font-bold transition-colors ${mode === 'image' ? 'bg-c-surface-raised text-c-text' : 'text-c-text-secondary'}`}
            >
              <ImageIcon size={10} className="inline mr-0.5" />
              {t('ideas.table.voiceImageInput.image', 'Image')}
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
          >
            <X size={14} className="text-c-text-secondary" />
          </button>
        </div>

        {/* Input area */}
        <div className="px-5 py-4 border-b border-c-border-subtle">
          {mode === 'voice' ? (
            <div className="text-center">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center transition-all ${
                  isRecording
                    ? 'bg-danger-500 text-c-surface animate-pulse shadow-lg shadow-danger-500/30'
                    : 'bg-c-surface-raised text-c-text hover:bg-c-surface-raised/80'
                }`}
              >
                {isRecording ? <Square size={20} /> : <Mic size={24} />}
              </button>
              <p className="text-[10px] text-c-text-secondary mt-2">
                {isRecording
                  ? t(
                      'ideas.table.voiceImageInput.recordingClickToStop',
                      'Recording… click to stop'
                    )
                  : t(
                      'ideas.table.voiceImageInput.clickToStartDictating',
                      'Click to start dictating'
                    )}
              </p>
              {transcript && (
                <div className="mt-3 p-3 rounded-xl bg-c-surface-raised text-left">
                  <p className="text-[11px] text-c-text whitespace-pre-wrap">{transcript}</p>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                isDragOver ? 'border-c-focus bg-c-surface-raised' : 'border-c-border-subtle'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt={t('myWorkTable.voiceImageInput.previewAlt', 'Preview')}
                    className="max-h-40 mx-auto rounded-lg"
                  />
                  <button
                    onClick={() => setImagePreview(null)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={24} className="text-c-text-secondary mx-auto mb-2" />
                  <p className="text-[11px] text-c-text-muted">
                    {t(
                      'ideas.table.voiceImageInput.dropImageOrPaste',
                      'Drop image, paste screenshot (Ctrl+V) or'
                    )}
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold text-c-text bg-c-surface-raised hover:bg-c-surface-raised/80 transition-colors"
                  >
                    <ImageIcon size={10} />
                    {t('ideas.table.voiceImageInput.chooseFile', 'Choose file')}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleImageFile(e.target.files[0]);
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Parse button */}
        <div className="px-5 py-3 border-b border-c-border-subtle flex items-center gap-2">
          <button
            onClick={handleParse}
            disabled={loading || (mode === 'voice' ? !transcript : !imagePreview)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-c-text text-c-surface hover:bg-c-text/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
            {loading
              ? t('ideas.table.voiceImageInput.analyzing', 'Analyzing…')
              : t('ideas.table.voiceImageInput.parseIdeas', 'Parse ideas')}
          </button>
        </div>

        {/* Parsed ideas */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {parsedIdeas.length === 0 ? (
            <p className="text-xs text-c-text-secondary text-center py-4">
              {t(
                'ideas.table.voiceImageInput.recordOrUploadThenParse',
                'Record voice or upload image, then click "Parse"'
              )}
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted mb-2">
                {parsedIdeas.filter((p) => p.selected).length}/{parsedIdeas.length}{' '}
                {t('ideas.table.voiceImageInput.selected', 'selected')}
              </p>
              {parsedIdeas.map((idea, idx) => (
                <label
                  key={idx}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-c-surface-raised cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={idea.selected}
                    onChange={() => toggleIdea(idx)}
                    className="w-3.5 h-3.5 rounded border-c-border-subtle text-c-focus-solid focus:ring-c-focus"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-medium text-c-text block truncate">
                      {idea.label}
                    </span>
                    {idea.description && (
                      <span className="text-[9px] text-c-text-secondary block truncate">
                        {idea.description}
                      </span>
                    )}
                  </div>
                  {idea.category && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-c-surface-raised text-c-text-secondary flex-shrink-0">
                      {idea.category}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {parsedIdeas.length > 0 && (
          <div className="px-5 py-3 border-t border-c-border-subtle flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-c-text-muted hover:bg-c-surface-raised transition-colors"
            >
              {t('ideas.table.cancel', 'Cancel')}
            </button>
            <div className="flex-1" />
            <button
              onClick={handleAddSelected}
              disabled={parsedIdeas.filter((p) => p.selected).length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-c-text text-c-surface hover:bg-c-text/90 transition-colors disabled:opacity-50"
            >
              <Plus size={12} />
              {t('ideas.table.voiceImageInput.addNIdeas', 'Add {{count}} ideas', {
                count: parsedIdeas.filter((p) => p.selected).length,
              })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceImageInput;
