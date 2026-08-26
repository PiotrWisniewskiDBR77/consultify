/**
 * Hook for managing assessment level attachments
 * Provides upload, delete, and fetch functionality for evidence files
 */

import { useCallback, useState } from 'react';

// Helper to get auth token from localStorage
const getAuthToken = () => localStorage.getItem('token');

export interface LevelAttachment {
  id: string;
  attachmentType: 'EVIDENCE' | 'SCREENSHOT' | 'DOCUMENT' | 'REPORT' | 'OTHER';
  fileName: string;
  fileSize: number;
  mimeType: string;
  description?: string;
  aiAnalysis?: {
    summary?: string;
    keyFindings?: string[];
  };
  aiSuggestedScore?: number;
  aiConfidence?: number;
  createdAt: string;
}

export interface LevelAttachmentsResponse {
  axisId: string;
  levelNumber: number;
  areaId: string | null;
  attachments: LevelAttachment[];
  count: number;
}

interface UseAssessmentAttachmentsOptions {
  assessmentId: string;
}

export function useAssessmentAttachments({ assessmentId }: UseAssessmentAttachmentsOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Upload a file attachment for a specific level
   */
  const uploadAttachment = useCallback(
    async (
      file: File,
      axisId: string,
      levelNumber: number,
      options?: {
        areaId?: string;
        attachmentType?: LevelAttachment['attachmentType'];
        description?: string;
      }
    ): Promise<LevelAttachment | null> => {
      const token = getAuthToken();
      if (!token || !assessmentId) {
        setError('Missing authentication or assessment ID');
        return null;
      }

      setIsUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('assessmentId', assessmentId);
        formData.append('axisId', axisId);
        formData.append('levelNumber', levelNumber.toString());

        if (options?.areaId) {
          formData.append('areaId', options.areaId);
        }
        if (options?.attachmentType) {
          formData.append('attachmentType', options.attachmentType);
        }
        if (options?.description) {
          formData.append('description', options.description);
        }

        const response = await fetch('/api/assessment-level-attachments', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to upload file');
        }

        const data = await response.json();
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        console.error('[useAssessmentAttachments] Upload error:', err);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [assessmentId]
  );

  /**
   * Get attachments for a specific level
   */
  const getAttachments = useCallback(
    async (
      axisId: string,
      levelNumber: number,
      areaId?: string
    ): Promise<LevelAttachmentsResponse | null> => {
      const token = getAuthToken();
      if (!token || !assessmentId) {
        return null;
      }

      try {
        let url = `/api/assessment-level-attachments/level/${assessmentId}/${axisId}/${levelNumber}`;
        if (areaId) {
          url += `?areaId=${encodeURIComponent(areaId)}`;
        }

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch attachments');
        }

        return await response.json();
      } catch (err) {
        console.error('[useAssessmentAttachments] Fetch error:', err);
        return null;
      }
    },
    [assessmentId]
  );

  // 2026-08-26 assessment cleanup: removed dead `getAllAttachments` — it
  // fetched `GET /api/assessment-level-attachments/${assessmentId}` (bare),
  // a path the mounted router (server/src/routes/assessment/
  // assessment-level-attachments.routes.ts) never defines — only
  // `/level/:assessmentId/:axisId/:levelNumber`, `/download/:attachmentId`,
  // `/:attachmentId/description`, `/:attachmentId` exist. Confirmed zero
  // callers anywhere in src/ (its only consumer, LevelAttachments.tsx, uses
  // `getAttachments` instead) — nothing to repoint, so removed rather than
  // inventing a new backend route for an unused function.

  /**
   * Delete an attachment
   */
  const deleteAttachment = useCallback(async (attachmentId: string): Promise<boolean> => {
    const token = getAuthToken();
    if (!token) {
      setError('Not authenticated');
      return false;
    }

    setIsDeleting(attachmentId);
    setError(null);

    try {
      const response = await fetch(`/api/assessment-level-attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete attachment');
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      setError(message);
      console.error('[useAssessmentAttachments] Delete error:', err);
      return false;
    } finally {
      setIsDeleting(null);
    }
  }, []);

  /**
   * Update attachment description
   */
  const updateDescription = useCallback(
    async (attachmentId: string, description: string): Promise<boolean> => {
      const token = getAuthToken();
      if (!token) {
        return false;
      }

      try {
        const response = await fetch(
          `/api/assessment-level-attachments/${attachmentId}/description`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ description }),
          }
        );

        return response.ok;
      } catch (err) {
        console.error('[useAssessmentAttachments] Update description error:', err);
        return false;
      }
    },
    []
  );

  /**
   * Get download URL for an attachment
   */
  const getDownloadUrl = useCallback((attachmentId: string): string => {
    return `/api/assessment-level-attachments/download/${attachmentId}`;
  }, []);

  return {
    uploadAttachment,
    getAttachments,
    deleteAttachment,
    updateDescription,
    getDownloadUrl,
    isUploading,
    isDeleting,
    error,
  };
}

export default useAssessmentAttachments;
