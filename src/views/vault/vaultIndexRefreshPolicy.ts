import { indexStatusTone } from './vaultDocuments';

/** Poll only explicit non-terminal statuses; unknown states fail closed. */
export const shouldAutoRefreshVaultIndex = (statuses: string[]): boolean =>
  statuses.some((status) => indexStatusTone(status) === 'warning');
