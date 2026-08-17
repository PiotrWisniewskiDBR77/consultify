import {
  AlertTriangle,
  Check,
  FileCheck2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/primitives';
import {
  type GovernedClaim,
  type GovernedSnapshotVersion,
  type PinnedGovernedSnapshot,
  organizationGovernedContextApi,
} from '@/services/organizationGovernedContextApi';

interface GovernedContextWorkspaceProps {
  isAdmin: boolean;
}

function renderValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export const GovernedContextWorkspace: React.FC<GovernedContextWorkspaceProps> = ({ isAdmin }) => {
  const { t } = useTranslation();
  const [claims, setClaims] = useState<GovernedClaim[]>([]);
  const [versions, setVersions] = useState<GovernedSnapshotVersion[]>([]);
  const [selected, setSelected] = useState<PinnedGovernedSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
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
    } catch {
      setError(
        t(
          'organization.governance.loadError',
          'Governed context could not be loaded. Your existing data was not changed.'
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

  const ingest = async (file: File) => {
    if (uploadInFlight.current) return;
    uploadInFlight.current = true;
    setBusyKey('upload');
    setUploadError(null);
    setNotice(null);
    setUploadFile(file);
    try {
      const result = await organizationGovernedContextApi.ingestDocument(file);
      if (!result.success || !result.docId) throw new Error('Incomplete ingest receipt');
      await load();
      setNotice(
        t(
          'organization.governance.uploaded',
          'The document was ingested and its pending governed claim was loaded.'
        )
      );
      setUploadFile(null);
    } catch {
      setUploadError(
        t(
          'organization.governance.uploadError',
          'The document could not be ingested. No governed claim was accepted.'
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
    } catch {
      setError(t('organization.governance.decisionError', 'The claim could not be reviewed.'));
    } finally {
      setBusyKey(null);
    }
  };

  const publish = async () => {
    setBusyKey('publish');
    setError(null);
    try {
      const version = await organizationGovernedContextApi.publish();
      setNotice(
        t('organization.governance.published', {
          version: version.version,
          defaultValue: 'Immutable version {{version}} was published.',
        })
      );
      await load();
      setSelected(await organizationGovernedContextApi.getVersion(version.version));
    } catch {
      setError(t('organization.governance.publishError', 'The snapshot could not be published.'));
    } finally {
      setBusyKey(null);
    }
  };

  const reopen = async (version: GovernedSnapshotVersion) => {
    setBusyKey(`version:${version.version}`);
    setError(null);
    try {
      setSelected(await organizationGovernedContextApi.getVersion(version.version));
    } catch {
      setError(t('organization.governance.reopenError', 'That snapshot version could not be opened.'));
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
      <section className="rounded-2xl border border-red-300 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30" role="alert">
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
                {busyKey === 'publish' ? <Loader2 className="animate-spin" size={16} /> : <FileCheck2 size={16} />}
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
        {notice && <p className="mt-4 text-sm text-c-success" role="status">{notice}</p>}
        {uploadError && (
          <div className="mt-4" role="alert">
            <p className="text-sm text-c-danger">{uploadError}</p>
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              disabled={!uploadFile || busyKey !== null}
              onClick={() => uploadFile && void ingest(uploadFile)}
            >
              <RefreshCw size={15} /> {t('common.retry', 'Retry')}
            </Button>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-c-danger" role="alert">{error}</p>}
      </header>

      <section className="rounded-2xl border border-c-border bg-c-surface p-5" aria-labelledby="governed-claims-title">
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
            {t('organization.governance.emptyClaims', 'No sourced claims are waiting in this organization.')}
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
                      {claim.sourceType} · {Math.round(claim.confidence * 100)}% · {claim.visibilityScope}
                    </p>
                  </div>
                  <span className="rounded-full bg-c-surface-raised px-2.5 py-1 text-xs font-medium text-c-text-secondary">
                    {claim.reviewState}
                  </span>
                </div>
                {isAdmin && claim.reviewState === 'pending' && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => void decide(claim, 'approve')} disabled={busyKey !== null}>
                      <Check size={15} /> {t('common.approve', 'Approve')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void decide(claim, 'reject')} disabled={busyKey !== null}>
                      <X size={15} /> {t('common.reject', 'Reject')}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-c-border bg-c-surface p-5" aria-labelledby="governed-versions-title">
        <h3 id="governed-versions-title" className="font-semibold text-c-text">
          {t('organization.governance.versions', 'Published versions')} ({versions.length})
        </h3>
        {versions.length === 0 ? (
          <p className="mt-4 text-sm text-c-text-secondary">
            {t('organization.governance.emptyVersions', 'No immutable context version has been published yet.')}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-c-border-subtle">
            {versions.map((version) => (
              <li key={version.snapshotId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-c-text">Version {version.version}</p>
                  <p className="font-mono text-xs text-c-text-muted">{version.contentHash}</p>
                  <p className="text-xs text-c-text-secondary">{version.claimCount} claims</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void reopen(version)} disabled={busyKey !== null}>
                  {busyKey === `version:${version.version}` && <Loader2 className="animate-spin" size={14} />}
                  {t('organization.governance.reopen', 'Open exact version')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <section className="rounded-2xl border border-c-info/40 bg-c-info/5 p-5" aria-label={`Version ${selected.version}`}>
          <h3 className="font-semibold text-c-text">Version {selected.version}</h3>
          <p className="mt-1 break-all font-mono text-xs text-c-text-secondary">{selected.contentHash}</p>
          {selected.sourceRefs.some((ref) => ref.dangling) && (
            <div className="mt-4 flex gap-2 rounded-xl border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" role="alert">
              <AlertTriangle className="shrink-0" size={18} />
              {t(
                'organization.governance.staleSources',
                'This immutable version cites a source that was deleted or changed after publication.'
              )}
            </div>
          )}
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-c-text-muted">Claims</dt><dd className="text-c-text">{selected.claimCount}</dd></div>
            <div><dt className="text-c-text-muted">Sources</dt><dd className="text-c-text">{selected.sourceRefs.length}</dd></div>
          </dl>
        </section>
      )}
    </div>
  );
};

export default GovernedContextWorkspace;
