export const LIBRARY_FOLDERS = [
  'Drafts',
  'Review',
  'Approved',
  'Templates',
  'Published',
  'Archived',
] as const;
export type LibraryFolder = (typeof LIBRARY_FOLDERS)[number];

export const LIBRARY_FOLDER_TRANSITION_EVENTS = [
  'save_draft',
  'submit_for_review',
  'approve',
  'save_as_template',
  'publish',
  'archive',
] as const;
export type LibraryFolderTransitionEvent = (typeof LIBRARY_FOLDER_TRANSITION_EVENTS)[number];

export function placeArtifactInFolder(
  reviewState: string,
  _everExported: boolean,
  isTemplate: boolean
): LibraryFolder {
  if (isTemplate) return 'Templates';
  if (reviewState === 'approved') return 'Approved';
  if (reviewState === 'ready_for_review') return 'Review';
  if (reviewState === 'published') return 'Published';
  if (reviewState === 'archived') return 'Archived';
  return 'Drafts';
}

export function assertLibraryFolderPlacement(
  reviewState: string,
  everExported: boolean,
  isTemplate: boolean,
  storedFolder: unknown
): asserts storedFolder is LibraryFolder {
  if (!LIBRARY_FOLDERS.includes(storedFolder as any)) {
    throw new Error(`Invalid library folder: ${String(storedFolder)}`);
  }
  const derived = placeArtifactInFolder(reviewState, everExported, isTemplate);
  if (storedFolder !== derived) {
    throw new Error(`Stored folder '${String(storedFolder)}' does not match derived '${derived}'`);
  }
}

export function assertFolderTransitionSound(
  prior: LibraryFolder,
  next: LibraryFolder,
  event: LibraryFolderTransitionEvent
): void {
  if (prior === next) return;
  const allowed = new Set<string>([
    'Drafts->Review:submit_for_review',
    'Review->Approved:approve',
    'Drafts->Templates:save_as_template',
    'Approved->Published:publish',
    'Published->Archived:archive',
    'Drafts->Archived:archive',
  ]);
  const key = `${prior}->${next}:${event}`;
  if (!allowed.has(key)) {
    throw new Error(`Invalid folder transition: ${key}`);
  }
}
