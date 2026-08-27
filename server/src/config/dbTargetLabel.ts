export type DbTargetLabelEnvironment = Record<string, string | undefined>;

export function resolveDbTargetLabel(env: DbTargetLabelEnvironment): string {
  try {
    const raw = env.DB_TARGET_LABEL ?? '';
    if (raw.includes('://') || raw.includes('@')) return 'unset';

    const normalized = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
      .replace(/-$/g, '');

    return normalized || 'unset';
  } catch {
    return 'unset';
  }
}
