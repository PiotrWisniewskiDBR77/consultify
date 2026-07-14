/**
 * EmailSignaturesSettings - Email signature management
 *
 * Features:
 * - Create multiple signatures
 * - Set default signature
 * - Rich text editing
 * - Preview signature
 *
 * Backend endpoints exist in server/routes/settings.js:
 * - GET /api/settings/signatures
 * - POST /api/settings/signatures
 * - PUT /api/settings/signatures/:id
 * - DELETE /api/settings/signatures/:id
 */

import { Check, Copy, Edit2, FileSignature, Plus, Star, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';
import { EmptyState } from '@/components/ui/composed';

import { useDemoSession } from '../../hooks/useDemoSession';
import { cn } from '../../lib/utils';
import { Api } from '../../services/api';
import { User } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/primitives/Button';
import { Skeleton } from '../ui/skeleton';
import { Textarea } from '../ui/textarea';
import { useToast } from '../ui/use-toast';

interface EmailSignature {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
}

interface EmailSignaturesSettingsProps {
  currentUser: User;
}

export const EmailSignaturesSettings: React.FC<EmailSignaturesSettingsProps> = ({
  currentUser,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isDemo } = useDemoSession();
  const [loading, setLoading] = useState(true);
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSignature, setEditingSignature] = useState<EmailSignature | null>(null);
  const [formData, setFormData] = useState({ name: '', content: '' });
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const normalizeSignatures = (rows: unknown): EmailSignature[] =>
    Array.isArray(rows)
      ? rows
          .map((signature) => ({
            id: String(signature?.id || ''),
            name: String(signature?.name || ''),
            content: String(signature?.content || ''),
            isDefault: Boolean(signature?.isDefault),
            createdAt: String(signature?.createdAt || ''),
          }))
          .filter((signature) => signature.id)
      : [];

  const loadSignatures = useCallback(async (): Promise<EmailSignature[]> => {
    const data = await Api.get('/settings/signatures');
    const nextSignatures = normalizeSignatures(data.signatures);
    setSignatures(nextSignatures);
    return nextSignatures;
  }, []);

  const signatureMatchesForm = (
    signature: EmailSignature | undefined,
    expected: { name: string; content: string }
  ) =>
    !!signature &&
    signature.name === expected.name.trim() &&
    signature.content === expected.content.trim();

  const buildDefaultDemoSignature = useCallback((): EmailSignature => {
    return {
      id: 'demo-1',
      name: t('settings.signatures.defaultDemoName', 'Professional'),
      content: `Best regards,\n${currentUser.firstName || currentUser.displayName || 'User'} ${currentUser.lastName || ''}\n${currentUser.jobTitle || ''}\n${currentUser.email}`,
      isDefault: true,
      createdAt: new Date().toISOString(),
    };
  }, [currentUser, t]);

  // Fetch signatures
  useEffect(() => {
    const fetchSignatures = async () => {
      setLoading(true);
      try {
        setLoadError(null);
        await loadSignatures();
      } catch (error: unknown) {
        if (isDemo) {
          setSignatures([buildDefaultDemoSignature()]);
        } else {
          const message = normalizeApiErrorMessage(error, 'Failed to load signatures');
          setSignatures([]);
          setLoadError(message);
          toast({
            title: t('settings.signatures.error', 'Error'),
            description: message,
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSignatures();
  }, [buildDefaultDemoSignature, currentUser, isDemo, loadSignatures, t, toast]);

  // Handle create/edit signature
  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast({
        title: t('settings.signatures.error', 'Error'),
        description: t('settings.signatures.fillFields', 'Please fill in all fields'),
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      setActionError(null);
      const expected = {
        name: formData.name.trim(),
        content: formData.content.trim(),
      };
      if (editingSignature) {
        // Update existing
        await Api.put(`/settings/signatures/${editingSignature.id}`, expected);
        const refreshed = await loadSignatures();
        if (
          !signatureMatchesForm(
            refreshed.find((item) => item.id === editingSignature.id),
            expected
          )
        ) {
          throw new Error('Email signature update was not confirmed by the server');
        }
        toast({
          title: t('settings.signatures.updated', 'Signature Updated'),
          description: t('settings.signatures.updatedDesc', 'Your signature has been updated'),
        });
      } else {
        // Create new
        await Api.post('/settings/signatures', {
          ...expected,
          isDefault: signatures.length === 0,
        });
        const refreshed = await loadSignatures();
        if (!refreshed.some((signature) => signatureMatchesForm(signature, expected))) {
          throw new Error('Email signature creation was not confirmed by the server');
        }
        toast({
          title: t('settings.signatures.created', 'Signature Created'),
          description: t('settings.signatures.createdDesc', 'Your new signature has been created'),
        });
      }

      setIsDialogOpen(false);
      setEditingSignature(null);
      setFormData({ name: '', content: '' });
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.signatures.saveFailed', 'Failed to save signature')
      );
      setActionError(message);
      toast({
        title: t('settings.signatures.error', 'Error'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle delete signature
  const handleDelete = async (id: string) => {
    try {
      setActionError(null);
      await Api.delete(`/settings/signatures/${id}`);
      const refreshed = await loadSignatures();
      if (refreshed.some((signature) => signature.id === id)) {
        throw new Error('Email signature deletion was not confirmed by the server');
      }

      toast({
        title: t('settings.signatures.deleted', 'Signature Deleted'),
        description: t('settings.signatures.deletedDesc', 'The signature has been removed'),
      });
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to delete signature');
      setActionError(message);
      toast({
        title: t('settings.signatures.error', 'Error'),
        description: message,
        variant: 'destructive',
      });
    }
  };

  // Handle set default
  const handleSetDefault = async (id: string) => {
    try {
      setActionError(null);
      await Api.put(`/settings/signatures/${id}/default`, {});
      const refreshed = await loadSignatures();
      if (!refreshed.some((signature) => signature.id === id && signature.isDefault)) {
        throw new Error('Default email signature was not confirmed by the server');
      }

      toast({
        title: t('settings.signatures.defaultSet', 'Default Updated'),
        description: t('settings.signatures.defaultSetDesc', 'Default signature has been updated'),
      });
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to set default signature');
      setActionError(message);
      toast({
        title: t('settings.signatures.error', 'Error'),
        description: message,
        variant: 'destructive',
      });
    }
  };

  // Copy signature to clipboard
  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: t('settings.signatures.copied', 'Copied'),
        description: t('settings.signatures.copiedDesc', 'Signature copied to clipboard'),
      });
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to copy signature');
      setActionError(message);
      toast({
        title: t('settings.signatures.error', 'Error'),
        description: message,
        variant: 'destructive',
      });
    }
  };

  // Open edit dialog
  const openEditDialog = (signature?: EmailSignature) => {
    if (signature) {
      setEditingSignature(signature);
      setFormData({ name: signature.name, content: signature.content });
    } else {
      setEditingSignature(null);
      setFormData({ name: '', content: '' });
    }
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-48" />
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-c-text">
            {t('settings.signatures.title', 'Email Signatures')}
          </h3>
          <p className="text-sm text-c-text-muted">
            {t('settings.signatures.description', 'Create and manage your email signatures')}
          </p>
        </div>
        <Button onClick={() => openEditDialog()} disabled={!!loadError}>
          <Plus className="w-4 h-4 mr-2" />
          {t('settings.signatures.add', 'Add Signature')}
        </Button>
      </div>

      {loadError && <DegradedState title="Email signatures unavailable" description={loadError} />}

      {actionError && <Banner variant="danger" title={actionError} />}

      {/* Signatures List */}
      {signatures.length === 0 && !loadError ? (
        <Card className="border-dashed">
          <CardContent className="p-0">
            <EmptyState
              icon={<FileSignature />}
              title={t('settings.signatures.empty', 'No signatures yet')}
              action={{
                label: t('settings.signatures.createFirst', 'Create your first signature'),
                onClick: () => openEditDialog(),
                variant: 'secondary',
              }}
            />
          </CardContent>
        </Card>
      ) : !loadError ? (
        <div className="space-y-3">
          {signatures.map((signature) => (
            <Card
              key={signature.id}
              className={cn('transition-all', signature.isDefault && 'ring-2 ring-c-focus')}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{signature.name}</CardTitle>
                    {signature.isDefault && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-c-accent-soft text-c-accent rounded-full">
                        {t('settings.signatures.default', 'Default')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!signature.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(signature.id)}
                        title={t('settings.signatures.setDefault', 'Set as default')}
                      >
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(signature.content)}
                      title={t('settings.signatures.copy', 'Copy')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(signature)}
                      title={t('settings.signatures.edit', 'Edit')}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(signature.id)}
                      className="text-danger-600 hover:text-danger-700 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                      title={t('settings.signatures.delete', 'Delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-sm text-c-text-secondary whitespace-pre-wrap font-sans bg-c-surface-raised p-3 rounded-lg">
                  {signature.content}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSignature
                ? t('settings.signatures.editTitle', 'Edit Signature')
                : t('settings.signatures.createTitle', 'Create Signature')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'settings.signatures.dialogDesc',
                'This signature will be available for use in emails'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('settings.signatures.name', 'Signature Name')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t('settings.signatures.namePlaceholder', 'e.g., Professional, Casual')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">
                {t('settings.signatures.content', 'Signature Content')}
              </Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                placeholder={t('settings.signatures.contentPlaceholder', 'Enter your signature...')}
                rows={6}
              />
            </div>
            {/* Preview */}
            {formData.content && (
              <div className="space-y-2">
                <Label>{t('settings.signatures.preview', 'Preview')}</Label>
                <div className="p-3 bg-c-surface-raised rounded-lg">
                  <pre className="text-sm text-c-text-secondary whitespace-pre-wrap font-sans">
                    {formData.content}
                  </pre>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>{t('common.saving', 'Saving...')}</>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {t('common.save', 'Save')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailSignaturesSettings;
