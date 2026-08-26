import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { getArtifactForUser } from '../v8/artifactRegistryService.js';

export type MeetingAttachmentKind = 'idea' | 'note' | 'material';

type AttachmentRow = {
  id: string;
  organization_id: string;
  meeting_id: string;
  artifact_kind: MeetingAttachmentKind;
  artifact_id: string;
  title_snapshot: string;
  attached_by: string;
  created_at: string;
};

export type MeetingAttachment = {
  id: string;
  artifactKind: MeetingAttachmentKind;
  artifactId: string;
  accessible: boolean;
  title: string | null;
  href: string | null;
  attachedBy: string;
  createdAt: string;
};

async function resolveAttachment(input: {
  row: AttachmentRow;
  userId: string;
  roleKey?: string | null;
}): Promise<MeetingAttachment> {
  const { row } = input;
  let accessible = false;
  let title: string | null = null;
  let href: string | null = null;
  if (row.artifact_kind === 'material') {
    const artifact = await getArtifactForUser({
      organizationId: row.organization_id,
      artifactId: row.artifact_id,
      userId: input.userId,
      roleKey: input.roleKey,
    });
    if (artifact) {
      accessible = true;
      title = artifact.resolvedTitle || artifact.titleSnapshot || row.title_snapshot;
      href = artifact.originRecordId
        ? `/document-studio/${artifact.originRecordId}`
        : `/materials/${artifact.artifactId}`;
    }
  } else if (row.artifact_kind === 'idea') {
    const idea = await dbGet<{ id: string; title: string }>(
      `SELECT id, title FROM ideas WHERE id = ? AND organization_id = ? LIMIT 1`,
      [row.artifact_id, row.organization_id],
      { fallback: false }
    );
    if (idea) {
      accessible = true;
      title = idea.title;
      href = `/ideas/${idea.id}`;
    }
  } else {
    const note = await dbGet<{ id: string; meeting_id: string; summary: string }>(
      `SELECT id, meeting_id, summary FROM meeting_notes WHERE id = ? AND organization_id = ? LIMIT 1`,
      [row.artifact_id, row.organization_id],
      { fallback: false }
    );
    if (note) {
      accessible = true;
      title = note.summary || row.title_snapshot;
      href = `/meetings/${note.meeting_id}`;
    }
  }
  return {
    id: row.id,
    artifactKind: row.artifact_kind,
    artifactId: row.artifact_id,
    accessible,
    title: accessible ? title : null,
    href: accessible ? href : null,
    attachedBy: row.attached_by,
    createdAt: row.created_at,
  };
}

export async function listMeetingAttachments(input: {
  organizationId: string;
  meetingId: string;
  userId: string;
  roleKey?: string | null;
}): Promise<MeetingAttachment[]> {
  const rows = await dbAll<AttachmentRow>(
    `SELECT * FROM meeting_attachments WHERE organization_id = ? AND meeting_id = ? ORDER BY created_at, id`,
    [input.organizationId, input.meetingId],
    { fallback: false }
  );
  return Promise.all(
    rows.map((row) => resolveAttachment({ row, userId: input.userId, roleKey: input.roleKey }))
  );
}

export async function addMeetingAttachment(input: {
  organizationId: string;
  meetingId: string;
  artifactKind: MeetingAttachmentKind;
  artifactId: string;
  userId: string;
  roleKey?: string | null;
}): Promise<MeetingAttachment> {
  if (!['idea', 'note', 'material'].includes(input.artifactKind))
    throw new Error('INVALID_ARTIFACT_KIND');
  const probe: AttachmentRow = {
    id: '',
    organization_id: input.organizationId,
    meeting_id: input.meetingId,
    artifact_kind: input.artifactKind,
    artifact_id: input.artifactId,
    title_snapshot: '',
    attached_by: input.userId,
    created_at: '',
  };
  const resolved = await resolveAttachment({
    row: probe,
    userId: input.userId,
    roleKey: input.roleKey,
  });
  if (!resolved.accessible || !resolved.title) throw new Error('ARTIFACT_NOT_ACCESSIBLE');
  const id = `meeting-attachment-${uuidv4()}`;
  const now = new Date().toISOString();
  try {
    await dbRun(
      `INSERT INTO meeting_attachments (id, organization_id, meeting_id, artifact_kind, artifact_id, title_snapshot, attached_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.organizationId,
        input.meetingId,
        input.artifactKind,
        input.artifactId,
        resolved.title,
        input.userId,
        now,
      ],
      { fallback: false }
    );
  } catch (error) {
    if (
      String((error as Error).message)
        .toLowerCase()
        .includes('unique')
    )
      throw new Error('ATTACHMENT_DUPLICATE');
    throw error;
  }
  return { ...resolved, id, attachedBy: input.userId, createdAt: now };
}

export async function deleteMeetingAttachment(input: {
  organizationId: string;
  meetingId: string;
  attachmentId: string;
}): Promise<boolean> {
  const existing = await dbGet<{ id: string }>(
    `SELECT id FROM meeting_attachments WHERE id = ? AND organization_id = ? AND meeting_id = ? LIMIT 1`,
    [input.attachmentId, input.organizationId, input.meetingId],
    { fallback: false }
  );
  if (!existing) return false;
  await dbRun(
    `DELETE FROM meeting_attachments WHERE id = ? AND organization_id = ? AND meeting_id = ?`,
    [input.attachmentId, input.organizationId, input.meetingId],
    { fallback: false }
  );
  return true;
}
