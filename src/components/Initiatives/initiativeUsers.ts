export function dedupeInitiativeUsersById<T extends { id?: unknown }>(users: T[]): T[] {
  const seen = new Set<string>();
  return users.filter((user) => {
    const id = String(user?.id || '').trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
