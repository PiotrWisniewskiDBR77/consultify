import { promises as dns } from 'dns';

export type DomainVerificationStatus =
  | 'verified'
  | 'token_mismatch'
  | 'no_record'
  | 'domain_not_found'
  | 'timeout'
  | 'dns_error';

export interface DomainVerificationOutcome {
  status: DomainVerificationStatus;
  checkedNames: string[];
  foundRecordCount: number;
  checkedAt: string;
  detail?: string;
}

type Resolver = typeof dns.resolveTxt;

const resolveWithTimeout = async (
  name: string,
  timeoutMs: number,
  resolveTxt: Resolver
): Promise<string[][] | 'TIMEOUT'> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      resolveTxt(name),
      new Promise<'TIMEOUT'>((resolve) => {
        timer = setTimeout(() => resolve('TIMEOUT'), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const errorCode = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';

export async function verifyDomainTxt(
  domain: string,
  token: string,
  options: { timeoutMs?: number; resolveTxt?: Resolver } = {}
): Promise<DomainVerificationOutcome> {
  const normalizedDomain = domain.trim().toLowerCase();
  const checkedNames = [`_consultify-verification.${normalizedDomain}`, normalizedDomain];
  const expected = `consultify-domain-verification=${token.trim()}`;
  const checkedAt = new Date().toISOString();
  const deadline = Date.now() + (options.timeoutMs ?? 5_000);
  const resolveTxt = options.resolveTxt ?? dns.resolveTxt;
  const values: string[] = [];
  let sawMissingDomain = false;
  let sawNoRecord = false;
  let lastError: string | undefined;

  for (const name of checkedNames) {
    const remaining = deadline - Date.now();
    if (remaining <= 0)
      return { status: 'timeout', checkedNames, foundRecordCount: values.length, checkedAt };
    try {
      const records = await resolveWithTimeout(name, remaining, resolveTxt);
      if (records === 'TIMEOUT')
        return { status: 'timeout', checkedNames, foundRecordCount: values.length, checkedAt };
      values.push(...records.map((chunks) => chunks.join('').trim()));
    } catch (error) {
      const code = errorCode(error);
      if (code === 'ENOTFOUND' || code === 'NXDOMAIN') sawMissingDomain = true;
      else if (code === 'ENODATA' || code === 'ENOENT') sawNoRecord = true;
      else lastError = code || 'resolver_error';
    }
  }

  if (values.some((value) => value === expected))
    return { status: 'verified', checkedNames, foundRecordCount: values.length, checkedAt };
  if (values.length)
    return { status: 'token_mismatch', checkedNames, foundRecordCount: values.length, checkedAt };
  if (lastError)
    return {
      status: 'dns_error',
      checkedNames,
      foundRecordCount: 0,
      checkedAt,
      detail: lastError,
    };
  return {
    status: sawNoRecord ? 'no_record' : sawMissingDomain ? 'domain_not_found' : 'no_record',
    checkedNames,
    foundRecordCount: 0,
    checkedAt,
  };
}
