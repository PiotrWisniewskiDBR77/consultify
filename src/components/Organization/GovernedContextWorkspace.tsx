import { AlertTriangle, Check, FileCheck2, Loader2, RefreshCw, ShieldCheck, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/primitives';
import {
  type GovernedClaim,
  type GovernedSnapshotVersion,
  type GovernedSnapshotRef,
  type PinnedGovernedSnapshot,
  type OrganizationSnapshotCandidateReceipt,
  organizationGovernedContextApi,
} from '@/services/organizationGovernedContextApi';

interface GovernedContextWorkspaceProps {
  isAdmin: boolean;
}

const UPLOAD_KEY_PREFIX = 'org-governed-upload:';

function uploadFingerprint(file: File): string {
  return [file.name, file.size, file.type, file.lastModified].join(':');
}

function stableUploadKey(file: File): string {
  const storageKey = `${UPLOAD_KEY_PREFIX}${uploadFingerprint(file)}`;
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;
    const generated =
      globalThis.crypto?.randomUUID?.() ||
      `org-upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(storageKey, generated);
    return generated;
  } catch {
    return (
      globalThis.crypto?.randomUUID?.() ||
      `org-upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    );
  }
}

function renderValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function governedError(error: unknown, fallback: string, t: TFunction): string {
  const candidate = error as { message?: string; status?: number; response?: { status?: number } };
  const status = candidate?.status ?? candidate?.response?.status;
  if (status === 403)
    return t(
      'organization.governance.errors.forbidden',
      'You do not have permission to perform this governed action.'
    );
  if (status === 404)
    return t(
      'organization.governance.errors.notFound',
      'The governed claim or snapshot no longer exists. Refresh and try again.'
    );
  if (status === 409)
    return t(
      'organization.governance.errors.conflict',
      'The governed state changed. Refresh before retrying this action.'
    );
  return candidate?.message ? `${fallback} ${candidate.message}` : fallback;
}

export const GovernedContextWorkspace: React.FC<GovernedContextWorkspaceProps> = ({ isAdmin }) => {
  const { t } = useTranslation();
  const [claims, setClaims] = useState<GovernedClaim[]>([]);
  const [versions, setVersions] = useState<GovernedSnapshotVersion[]>([]);
  const [selected, setSelected] = useState<PinnedGovernedSnapshot | null>(null);
  const [selectedRef, setSelectedRef] = useState<GovernedSnapshotRef | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadIdempotencyKey, setUploadIdempotencyKey] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [candidateReceipt, setCandidateReceipt] =
    useState<OrganizationSnapshotCandidateReceipt | null>(null);
  const uploadInFlight = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextClaims, nextVersions] = await Promise.all([
        organizationGovernedContextApi.listClaims(),
        organizationGovernedContextApi.listVersions(),
      ]);
      setClaims(nextClaims);
      setVersions(nextVersions);
    } catch (caught) {
      setError(
        governedError(
          caught,
          t(
            'organization.governance.loadError',
            'Governed context could not be loaded. Your existing data was not changed.'
          ),
          t
        )
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(
    () => claims.filter((claim) => claim.reviewState === 'pending').length,
    [claims]
  );
  const approvedCount = useMemo(() => claims.filter((claim) => claim.approved).length, [claims]);
  const sources = useMemo(
    () => [...new Map(claims.map((claim) => [claim.itemId, claim])).values()],
    [claims]
  );
  const conflicts = useMemo(() => {
    const byPath = new Map<string, GovernedClaim[]>();
    claims.forEach((claim) =>
      byPath.set(claim.claimPath, [...(byPath.get(claim.claimPath) ?? []), claim])
    );
    return [...byPath.entries()].filter(
      ([, entries]) => new Set(entries.map((entry) => renderValue(entry.value))).size > 1
    );
  }, [claims]);

  const ingest = async (file: File, retainedKey?: string | null) => {
    if (uploadInFlight.current) return;
    uploadInFlight.current = true;
    setBusyKey('upload');
    setUploadError(null);
    setNotice(null);
    setUploadFile(file);
    const idempotencyKey = retainedKey || stableUploadKey(file);
    setUploadIdempotencyKey(idempotencyKey);
    try {
      const result = await organizationGovernedContextApi.ingestDocument(file, idempotencyKey);
      if (!result.success || !result.docId) throw new Error('Incomplete ingest receipt');
      await load();
      setNotice(
        t(
          'organization.governance.uploaded',
          'The document was ingested and its pending governed claim was loaded.'
        )
      );
      setUploadFile(null);
    } catch (caught) {
      setUploadError(
        governedError(
          caught,
          t(
            'organization.governance.uploadError',
            'The document could not be ingested. No governed claim was accepted.'
          ),
          t
        )
      );
    } finally {
      uploadInFlight.current = false;
      setBusyKey(null);
    }
  };

  const decide = async (claim: GovernedClaim, decision: 'approve' | 'reject') => {
    setBusyKey(`${claim.claimId}:${decision}`);
    setError(null);
    try {
      const result = await organizationGovernedContextApi.decide(claim.claimId, decision);
      setNotice(
        result.wonDecision
          ? t('organization.governance.decisionSaved', 'The review decision was saved.')
          : t(
              'organization.governance.decisionConflict',
              'Another reviewer decided this claim first. The current state has been reloaded.'
            )
      );
      await load();
    } catch (caught) {
      setError(
        governedError(
          caught,
          t('organization.governance.decisionError', 'The claim could not be reviewed.'),
          t
        )
      );
    } finally {
      setBusyKey(null);
    }
  };

  const publish = async () => {
    setBusyKey('publish');
    setError(null);
    setNotice(null);
    try {
      const version = await organizationGovernedContextApi.publish();
      await load();
      const reopened = await organizationGovernedContextApi.getVersion(version.version);
      if (
        reopened.snapshotId !== version.snapshotId ||
        reopened.contentHash !== version.contentHash
      ) {
        throw Object.assign(new Error('Published snapshot readback did not match its receipt.'), {
          status: 409,
        });
      }
      setSelected(reopened);
      setSelectedRef({
        snapshotId: reopened.snapshotId,
        version: reopened.version,
        contentHash: reopened.contentHash,
      });
      setNotice(
        t('organization.governance.published', {
          version: version.version,
          defaultValue: 'Immutable version {{version}} was published.',
        })
      );
    } catch (caught) {
      setError(
        governedError(
          caught,
          t('organization.governance.publishError', 'The snapshot could not be published.'),
          t
        )
      );
    } finally {
      setBusyKey(null);
    }
  };

  const reopen = async (version: GovernedSnapshotVersion) => {
    setBusyKey(`version:${version.version}`);
    setError(null);
    try {
      const reopened = await organizationGovernedContextApi.getVersion(version.version);
      setSelected(reopened);
      setSelectedRef({
        snapshotId: reopened.snapshotId,
        version: reopened.version,
        contentHash: reopened.contentHash,
      });
    } catch (caught) {
      setError(
        governedError(
          caught,
          t('organization.governance.reopenError', 'That snapshot version could not be opened.'),
          t
        )
      );
    } finally {
      setBusyKey(null);
    }
  };

  const selectLatest = async () => {
    setBusyKey('latest');
    setError(null);
    try {
      const ref = await organizationGovernedContextApi.resolveLatest();
      const reopened = await organizationGovernedContextApi.getVersion(ref.version);
      if (reopened.snapshotId !== ref.snapshotId || reopened.contentHash !== ref.contentHash) {
        throw Object.assign(
          new Error('Latest snapshot readback did not match its immutable reference.'),
          { status: 409 }
        );
      }
      setSelectedRef(ref);
      setSelected(reopened);
      setNotice(
        t(
          'organization.governance.latestPinned',
          'Latest was resolved now and pinned to this exact immutable snapshot.'
        )
      );
    } catch (caught) {
      setError(
        governedError(
          caught,
          t(
            'organization.governance.latestError',
            'The latest governed snapshot could not be selected.'
          ),
          t
        )
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handoffCandidate = async () => {
    if (!selectedRef) return;
    setBusyKey('candidate');
    setError(null);
    try {
      const result = await organizationGovernedContextApi.handoffCandidate(selectedRef);
      if (
        result.receipt.snapshotId !== selectedRef.snapshotId ||
        result.receipt.snapshotVersion !== selectedRef.version ||
        result.receipt.snapshotContentHash !== selectedRef.contentHash
      )
        throw Object.assign(
          new Error('Candidate receipt did not match the selected source bytes.'),
          { status: 409 }
        );
      setCandidateReceipt(result.receipt);
      setNotice(
        result.created
          ? t(
              'organization.governance.candidateCreated',
              'One canonical Candidate was created from this exact snapshot.'
            )
          : t(
              'organization.governance.candidateReopened',
              'Existing Candidate receipt was reopened.'
            )
      );
    } catch (caught) {
      setError(
        governedError(
          caught,
          t(
            'organization.governance.candidateError',
            'The snapshot could not be handed off to Candidates.'
          ),
          t
        )
      );
    } finally {
      setBusyKey(null);
    }
  };

  if (loading && claims.length === 0 && versions.length === 0) {
    return (
      <section className="rounded-2xl border border-c-border bg-c-surface p-6" aria-busy="true">
        <div className="flex items-center gap-3 text-c-text-secondary">
          <Loader2 className="animate-spin" size={18} />
          {t('organization.governance.loading', 'Loading governed context…')}
        </div>
      </section>
    );
  }

  if (error && claims.length === 0 && versions.length === 0) {
    return (
      <section
        className="rounded-2xl border border-red-300 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30"
        role="alert"
      >
        <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
        <Button className="mt-4" variant="outline" onClick={() => void load()}>
          <RefreshCw size={16} /> {t('common.retry', 'Retry')}
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-6" data-testid="governed-context-workspace">
      <header className="rounded-2xl border border-c-border bg-c-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-c-info" size={20} />
              <h2 className="text-base font-semibold text-c-text">
                {t('organization.governance.title', 'Governed organization context')}
              </h2>
            </div>
            <p className="mt-1 text-sm text-c-text-secondary">
              {t(
                'organization.governance.subtitle',
                'Review sourced claims and publish immutable, reproducible context versions.'
              )}
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex">
                <input
                  className="sr-only"
                  type="file"
                  accept=".txt,.md,.pdf,.doc,.docx,text/plain,text/markdown,application/pdf"
                  disabled={busyKey !== null}
                  aria-label={t('organization.governance.upload', 'Upload source document')}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = '';
                    if (file) void ingest(file);
                  }}
                />
                <span className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-c-border px-4 py-2 text-sm font-medium text-c-text">
                  {busyKey === 'upload' && <Loader2 className="animate-spin" size={16} />}
                  {t('organization.governance.upload', 'Upload source document')}
                </span>
              </label>
              <Button
                onClick={() => void publish()}
                disabled={busyKey !== null || pendingCount > 0 || approvedCount === 0}
                aria-describedby="governed-publish-requirements"
              >
                {busyKey === 'publish' ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <FileCheck2 size={16} />
                )}
                {t('organization.governance.publish', 'Publish approved claims')}
              </Button>
            </div>
          )}
        </div>
        {isAdmin && (pendingCount > 0 || approvedCount === 0) && (
          <p id="governed-publish-requirements" className="mt-3 text-sm text-c-text-secondary">
            {pendingCount > 0
              ? t(
                  'organization.governance.publishPending',
                  'Review every pending claim before publishing a version.'
                )
              : t(
                  'organization.governance.publishEmpty',
                  'At least one approved claim is required before a version can be published.'
                )}
          </p>
        )}
        {!isAdmin && (
          <p className="mt-4 rounded-xl bg-c-surface-raised px-3 py-2 text-sm text-c-text-secondary">
            {t(
              'organization.governance.readOnly',
              'You have read-only access. An organization owner or administrator reviews and publishes claims.'
            )}
          </p>
        )}
        {notice && (
          <p className="mt-4 text-sm text-c-success" role="status">
            {notice}
          </p>
        )}
        {uploadError && (
          <div className="mt-4" role="alert">
            <p className="text-sm text-c-danger">{uploadError}</p>
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              disabled={!uploadFile || busyKey !== null}
              onClick={() => uploadFile && void ingest(uploadFile, uploadIdempotencyKey)}
            >
              <RefreshCw size={15} /> {t('common.retry', 'Retry')}
            </Button>
          </div>
        )}
        {error && (
          <p className="mt-4 text-sm text-c-danger" role="alert">
            {error}
          </p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          className="rounded-2xl border border-c-border bg-c-surface p-5"
          aria-labelledby="governed-sources-title"
        >
          <h3 id="governed-sources-title" className="font-semibold text-c-text">
            {t('organization.governance.sources', 'Sources')} ({sources.length})
          </h3>
          {sources.length === 0 ? (
            <p className="mt-4 text-sm text-c-text-secondary">
              {t('organization.governance.emptySources', 'No visible governed sources.')}
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {sources.map((source) => (
                <li key={source.itemId} className="rounded-xl bg-c-surface-raised p-3 text-sm">
                  <p className="font-medium text-c-text">{source.sourceType}</p>
                  <p className="break-all font-mono text-xs text-c-text-muted">{source.itemId}</p>
                  <p className="mt-1 text-xs text-c-text-secondary">{source.visibilityScope}</p>
                </li>
              ))}
            </ul>
          )}
          {!isAdmin && (
            <p className="mt-3 text-xs text-c-text-muted">
              {t(
                'organization.governance.restrictedSources',
                'Restricted sources and claims are omitted from this view by the server.'
              )}
            </p>
          )}
        </section>

        <section
          className="rounded-2xl border border-c-border bg-c-surface p-5"
          aria-labelledby="governed-conflicts-title"
        >
          <h3 id="governed-conflicts-title" className="font-semibold text-c-text">
            {t('organization.governance.conflicts', 'Conflicts')} ({conflicts.length})
          </h3>
          {conflicts.length === 0 ? (
            <p className="mt-4 text-sm text-c-text-secondary">
              {t('organization.governance.emptyConflicts', 'No conflicting visible claim values.')}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {conflicts.map(([claimPath, entries]) => (
                <li
                  key={claimPath}
                  className="rounded-xl border border-amber-400/50 bg-amber-50 p-3 dark:bg-amber-950/30"
                >
                  <p className="font-medium text-amber-900 dark:text-amber-200">{claimPath}</p>
                  <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                    {t('organization.governance.conflictSummary', {
                      count: entries.length,
                      defaultValue:
                        '{{count}} sourced claims disagree. Review each proposal before publishing.',
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section
        className="rounded-2xl border border-c-border bg-c-surface p-5"
        aria-labelledby="governed-claims-title"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 id="governed-claims-title" className="font-semibold text-c-text">
            {t('organization.governance.claims', 'Claims')} ({claims.length})
          </h3>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} size={15} />
            {t('common.refresh', 'Refresh')}
          </Button>
        </div>
        {claims.length === 0 ? (
          <p className="mt-4 rounded-xl bg-c-surface-raised p-4 text-sm text-c-text-secondary">
            {t(
              'organization.governance.emptyClaims',
              'No sourced claims are waiting in this organization.'
            )}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {claims.map((claim) => (
              <li key={claim.claimId} className="rounded-xl border border-c-border-subtle p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-c-text">{claim.claimPath}</p>
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-c-surface-raised p-3 text-xs text-c-text-secondary">
                      {renderValue(claim.value)}
                    </pre>
                    <p className="mt-2 text-xs text-c-text-muted">
                      {claim.sourceType} · {Math.round(claim.confidence * 100)}% ·{' '}
                      {claim.visibilityScope}
                    </p>
                  </div>
                  <span className="rounded-full bg-c-surface-raised px-2.5 py-1 text-xs font-medium text-c-text-secondary">
                    {claim.reviewState}
                  </span>
                </div>
                {isAdmin && claim.reviewState === 'pending' && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void decide(claim, 'approve')}
                      disabled={busyKey !== null}
                    >
                      <Check size={15} /> {t('common.approve', 'Approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void decide(claim, 'reject')}
                      disabled={busyKey !== null}
                    >
                      <X size={15} /> {t('common.reject', 'Reject')}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-2xl border border-c-border bg-c-surface p-5"
        aria-labelledby="governed-versions-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="governed-versions-title" className="font-semibold text-c-text">
            {t('organization.governance.versions', 'Published versions')} ({versions.length})
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void selectLatest()}
            disabled={busyKey !== null || versions.length === 0}
          >
            {busyKey === 'latest' && <Loader2 className="animate-spin" size={14} />}
            {t('organization.governance.selectLatest', 'Select latest now')}
          </Button>
        </div>
        {versions.length === 0 ? (
          <p className="mt-4 text-sm text-c-text-secondary">
            {t(
              'organization.governance.emptyVersions',
              'No immutable context version has been published yet.'
            )}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-c-border-subtle">
            {versions.map((version) => (
              <li
                key={version.snapshotId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium text-c-text">
                    {t('organization.governance.version', {
                      version: version.version,
                      defaultValue: 'Version {{version}}',
                    })}
                  </p>
                  <p className="break-all font-mono text-xs text-c-text-muted">
                    {version.snapshotId}
                  </p>
                  <p className="font-mono text-xs text-c-text-muted">{version.contentHash}</p>
                  <p className="text-xs text-c-text-secondary">
                    {t('organization.governance.claimCount', {
                      count: version.claimCount,
                      defaultValue: '{{count}} claims',
                    })}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void reopen(version)}
                  disabled={busyKey !== null}
                >
                  {busyKey === `version:${version.version}` && (
                    <Loader2 className="animate-spin" size={14} />
                  )}
                  {t('organization.governance.reopen', 'Open exact version')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <section
          className="rounded-2xl border border-c-info/40 bg-c-info/5 p-5"
          aria-label={t('organization.governance.version', {
            version: selected.version,
            defaultValue: 'Version {{version}}',
          })}
        >
          <h3 className="font-semibold text-c-text">
            {t('organization.governance.version', {
              version: selected.version,
              defaultValue: 'Version {{version}}',
            })}
          </h3>
          <p className="mt-1 break-all font-mono text-xs text-c-text-secondary">
            {selected.snapshotId}
          </p>
          <p className="mt-1 break-all font-mono text-xs text-c-text-secondary">
            {selected.contentHash}
          </p>
          {selectedRef && (
            <p
              className="mt-2 text-xs font-medium text-c-success"
              data-testid="selected-governed-ref"
            >
              {t('organization.governance.pinnedReference', 'Pinned exact reference:')}{' '}
              {selectedRef.snapshotId} · v{selectedRef.version} · {selectedRef.contentHash}
            </p>
          )}
          {isAdmin && selectedRef && (
            <div className="mt-3">
              <Button onClick={() => void handoffCandidate()} disabled={busyKey !== null}>
                {busyKey === 'candidate' && <Loader2 className="animate-spin" size={14} />}
                {t('organization.governance.sendToCandidates', 'Send exact snapshot to Candidates')}
              </Button>
            </div>
          )}
          {candidateReceipt && (
            <p
              className="mt-3 rounded-lg bg-c-surface px-3 py-2 text-xs text-c-success"
              data-testid="organization-candidate-receipt"
            >
              {t('organization.governance.candidate', 'Candidate')} {candidateReceipt.candidateId} ·{' '}
              {t('organization.governance.sourceVersion', 'source v')}
              {candidateReceipt.snapshotVersion} · {candidateReceipt.snapshotContentHash}
            </p>
          )}
          {selected.sourceRefs.some((ref) => ref.dangling) && (
            <div
              className="mt-4 flex gap-2 rounded-xl border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
              role="alert"
            >
              <AlertTriangle className="shrink-0" size={18} />
              {t(
                'organization.governance.staleSources',
                'This immutable version cites a source that was deleted or changed after publication.'
              )}
            </div>
          )}
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-c-text-muted">{t('organization.governance.claims', 'Claims')}</dt>
              <dd className="text-c-text">{selected.claimCount}</dd>
            </div>
            <div>
              <dt className="text-c-text-muted">
                {t('organization.governance.sources', 'Sources')}
              </dt>
              <dd className="text-c-text">{selected.sourceRefs.length}</dd>
            </div>
          </dl>
          {selected.sourceRefs.length > 0 && (
            <ul
              className="mt-4 space-y-2"
              aria-label={t(
                'organization.governance.frozenSourceReferences',
                'Frozen source references'
              )}
            >
              {selected.sourceRefs.map((ref) => (
                <li
                  key={ref.claimId}
                  className="rounded-lg bg-c-surface px-3 py-2 text-xs text-c-text-secondary"
                >
                  <span className="font-medium text-c-text">{ref.sourceType}</span> ·{' '}
                  {ref.sourceDocId || ref.itemId}
                  {ref.fileHash && (
                    <span className="block break-all font-mono">
                      {ref.fileHash} · doc v{ref.docVersion ?? '?'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};

export default GovernedContextWorkspace;
