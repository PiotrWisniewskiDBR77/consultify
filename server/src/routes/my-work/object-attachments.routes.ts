import { type Response, Router } from 'express';
import multer from 'multer';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import {
  addObjectAttachment,
  deleteObjectAttachment,
  getObjectAttachment,
  listObjectAttachments,
  ObjectAttachmentError,
  parseObjectType,
} from '../../services/objectAttachmentService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireTables, requireUser } from './_helpers.js';
import { mapAppErrorResponse } from '../../middleware/appErrorMapper.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

function sendError(res: Response, error: unknown): void {
  if (error instanceof ObjectAttachmentError) {
    res.status(error.status).json({ ...mapAppErrorResponse(error, undefined, 'error'), code: error.code });
    return;
  }
  throw error;
}

router.post(
  '/object-attachments/:objectType/:objectId',
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity || !(await requireTables(res, ['tasks', 'decisions', 'initiatives', 'object_attachments']))) return;
    try {
      if (!req.file) {
        throw new ObjectAttachmentError(400, 'OBJECT_ATTACHMENT_FILE_REQUIRED', 'File required');
      }
      const attachment = await addObjectAttachment(
        {
          objectType: parseObjectType(req.params.objectType),
          objectId: String(req.params.objectId || '').trim(),
          organizationId: identity.orgId,
          userId: identity.userId,
        },
        req.file
      );
      res.status(201).json({ data: attachment });
    } catch (error) {
      sendError(res, error);
    }
  })
);

router.get(
  '/object-attachments/:objectType/:objectId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity || !(await requireTables(res, ['tasks', 'decisions', 'initiatives', 'object_attachments']))) return;
    try {
      const data = await listObjectAttachments({
        objectType: parseObjectType(req.params.objectType),
        objectId: String(req.params.objectId || '').trim(),
        organizationId: identity.orgId,
        userId: identity.userId,
      });
      res.json({ data });
    } catch (error) {
      sendError(res, error);
    }
  })
);

router.get(
  '/object-attachments/:objectType/:objectId/:attachmentId/download',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity || !(await requireTables(res, ['tasks', 'decisions', 'initiatives', 'object_attachments']))) return;
    try {
      const { attachment, object } = await getObjectAttachment({
        objectType: parseObjectType(req.params.objectType),
        objectId: String(req.params.objectId || '').trim(),
        attachmentId: String(req.params.attachmentId || '').trim(),
        organizationId: identity.orgId,
        userId: identity.userId,
      });
      res.setHeader('Content-Type', attachment.mimeType || object.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`);
      if (object.size !== undefined) res.setHeader('Content-Length', String(object.size));
      object.stream.pipe(res);
    } catch (error) {
      sendError(res, error);
    }
  })
);

router.delete(
  '/object-attachments/:objectType/:objectId/:attachmentId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity || !(await requireTables(res, ['tasks', 'decisions', 'initiatives', 'object_attachments']))) return;
    try {
      await deleteObjectAttachment({
        objectType: parseObjectType(req.params.objectType),
        objectId: String(req.params.objectId || '').trim(),
        attachmentId: String(req.params.attachmentId || '').trim(),
        organizationId: identity.orgId,
        userId: identity.userId,
      });
      res.status(204).send();
    } catch (error) {
      sendError(res, error);
    }
  })
);

export default router;
