export type DbTargetLabelEnvironment = Record<string, string | undefined>;

export function resolveDbTargetLabel(env: DbTargetLabelEnvironment): string {
  try {
    const normalized = (env.DB_TARGET_LABEL ?? '')
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
