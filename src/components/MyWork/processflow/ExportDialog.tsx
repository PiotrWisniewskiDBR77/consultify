import { Download, FileJson, FileText, Image, Loader2 } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type ExportFormat = 'json' | 'readback' | 'png';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (format: ExportFormat) => void;
  isExporting: boolean;
  isPl: boolean;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onClose,
  onExport,
  isExporting,
  isPl,
}) => {
  const formats: { id: ExportFormat; icon: React.ReactNode; title: string; desc: string }[] = [
    {
      id: 'json',
      icon: <FileJson size={20} />,
      title: isPl ? 'JSON (Machine Export)' : 'JSON (Machine Export)',
      desc: isPl ? 'Typowany graf do integracji' : 'Typed graph for integration',
    },
    {
      id: 'readback',
      icon: <FileText size={20} />,
      title: isPl ? 'Tekst (Human Readback)' : 'Text (Human Readback)',
      desc: isPl ? 'Czytelna ścieżka procesu' : 'Human-readable process path',
    },
    {
      id: 'png',
      icon: <Image size={20} />,
      title: 'PNG',
      desc: isPl ? 'Zrzut ekranu canvas' : 'Canvas screenshot',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm bg-c-surface border-c-border-subtle">
        <DialogHeader>
          <DialogTitle className="text-c-text">
            {isPl ? 'Eksport procesu' : 'Export process'}
          </DialogTitle>
          <DialogDescription>
            {isPl ? 'Wybierz format eksportu' : 'Choose export format'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {formats.map((f) => (
            <Button
              key={f.id}
              variant="ghost"
              size="lg"
              onClick={() => onExport(f.id)}
              disabled={isExporting}
              className="w-full justify-start gap-3 rounded-xl border border-c-border-subtle bg-c-surface-raised px-4 py-3 hover:bg-c-surface-raised h-auto text-left"
            >
              <div className="text-primary-500 flex-shrink-0">{f.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-c-text">
                  {f.title}
                </div>
                <div className="text-xs text-c-text-muted">{f.desc}</div>
              </div>
              {isExporting ? (
                <Loader2 size={16} className="ml-auto animate-spin text-c-text-secondary flex-shrink-0" />
              ) : (
                <Download size={16} className="ml-auto text-c-text-secondary flex-shrink-0" />
              )}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
