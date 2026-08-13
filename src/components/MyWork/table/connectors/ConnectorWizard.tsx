import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Modal } from '@/components/ui/primitives/Modal';

import { ConnectorIcon, connectorMeta } from './ConnectorIcons';
import type { ConnectorConfig, ConnectorType, FieldMapping } from './useConnectors';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ConnectorWizardProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  tableId: string;
  targetFields: string[];
  onCreated?: () => void;
  /** Injected from useConnectors */
  testConnection: (
    config: Record<string, unknown>,
    type: ConnectorType
  ) => Promise<{ ok: boolean; error?: string; fields?: string[] }>;
  autoMap: (args: { id: string; sourceFields: string[] }) => Promise<{ mappings: FieldMapping[] }>;
  create: (payload: any) => Promise<any>;
  isCreating?: boolean;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

const STEPS_EN = ['Type', 'Configure', 'Map fields', 'Schedule', 'Review'];
const STEPS_PL = ['Typ', 'Konfiguracja', 'Mapowanie', 'Harmonogram', 'Podsumowanie'];

const INTERVALS = [
  { value: '15m', labelEn: 'Every 15 min', labelPl: 'Co 15 min' },
  { value: '30m', labelEn: 'Every 30 min', labelPl: 'Co 30 min' },
  { value: '1h', labelEn: 'Every hour', labelPl: 'Co godzinę' },
  { value: '6h', labelEn: 'Every 6 hours', labelPl: 'Co 6 godzin' },
  { value: '12h', labelEn: 'Every 12 hours', labelPl: 'Co 12 godzin' },
  { value: '24h', labelEn: 'Every 24 hours', labelPl: 'Co 24 godziny' },
  { value: '7d', labelEn: 'Weekly', labelPl: 'Co tydzień' },
] as const;

const TRANSFORMS = [
  { value: '', labelEn: 'None', labelPl: 'Brak' },
  { value: 'trim', labelEn: 'Trim', labelPl: 'Przytnij' },
  { value: 'uppercase', labelEn: 'UPPERCASE', labelPl: 'WIELKIE LITERY' },
  { value: 'lowercase', labelEn: 'lowercase', labelPl: 'małe litery' },
  { value: 'date_format', labelEn: 'Date format', labelPl: 'Format daty' },
] as const;

const CONNECTOR_TYPES: ConnectorType[] = [
  'csv',
  'google_sheets',
  'airtable',
  'postgresql',
  'jira',
  'webhook',
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const ConnectorWizard: React.FC<ConnectorWizardProps> = ({
  open,
  onClose,
  workspaceId,
  tableId,
  targetFields,
  onCreated,
  testConnection,
  autoMap,
  create,
  isCreating,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const steps = isPl ? STEPS_PL : STEPS_EN;

  /* ---- State ---- */
  const [step, setStep] = useState<WizardStep>(1);
  const [connectorType, setConnectorType] = useState<ConnectorType | null>(null);
  const [name, setName] = useState('');
  const [config, setConfig] = useState<ConnectorConfig>({ type: 'csv', name: '' });

  // Step 2 — connection test
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testError, setTestError] = useState('');
  const [sourceFields, setSourceFields] = useState<string[]>([]);

  // Step 3 — field mapping
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [isAutoMapping, setIsAutoMapping] = useState(false);

  // Step 4 — schedule
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [interval, setInterval] = useState('1h');

  // Step 5 — run now
  const [runNow, setRunNow] = useState(true);

  // File upload ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');

  /* ---- Helpers ---- */

  const configPayload = useMemo(() => {
    const c: Record<string, unknown> = {};
    if (!connectorType) return c;
    switch (connectorType) {
      case 'csv':
        c.fileData = config.fileData;
        c.fileName = config.fileName;
        break;
      case 'google_sheets':
        c.spreadsheetId = config.spreadsheetId;
        c.apiKey = config.apiKey;
        c.sheetName = config.sheetName;
        break;
      case 'airtable':
        c.baseId = config.baseId;
        c.apiToken = config.apiToken;
        c.tableName = config.tableName;
        break;
      case 'postgresql':
        c.host = config.host;
        c.port = config.port ?? 5432;
        c.database = config.database;
        c.user = config.user;
        c.password = config.password;
        c.schema = config.schema ?? 'public';
        c.tableOrQuery = config.tableOrQuery;
        break;
      case 'jira':
        c.domain = config.domain;
        c.email = config.email;
        c.apiToken = config.jiraApiToken;
        c.jql = config.jql;
        c.project = config.project;
        break;
      case 'webhook':
        c.credentials = { webhookSecret: config.webhookSecret };
        break;
    }
    return c;
  }, [connectorType, config]);

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return !!connectorType;
      case 2: {
        if (!name.trim()) return false;
        if (connectorType === 'csv') return !!config.fileData;
        if (connectorType === 'google_sheets') return !!(config.spreadsheetId && config.apiKey);
        if (connectorType === 'airtable')
          return !!(config.baseId && config.apiToken && config.tableName);
        if (connectorType === 'postgresql')
          return !!(config.host && config.database && config.user);
        if (connectorType === 'jira')
          return !!(config.domain && config.email && config.jiraApiToken);
        if (connectorType === 'webhook') return true;
        return false;
      }
      case 3:
        return mappings.length > 0 && mappings.some((m) => m.targetField);
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  }, [step, connectorType, name, config, mappings]);

  const handleTestConnection = useCallback(async () => {
    if (!connectorType) return;
    setTestStatus('testing');
    setTestError('');
    try {
      const res = await testConnection(configPayload, connectorType);
      if (res.ok) {
        setTestStatus('success');
        if (res.fields?.length) {
          setSourceFields(res.fields);
          setMappings(
            res.fields.map((f) => ({
              sourceField: f,
              targetField: null,
              inferredType: undefined,
            }))
          );
        }
        toast.success(t('myWorkTable.connectorWizard.connectionSuccessful'));
      } else {
        setTestStatus('failed');
        setTestError(res.error ?? '');
        toast.error(res.error ?? t('myWorkTable.connectorWizard.connectionFailed'));
      }
    } catch {
      setTestStatus('failed');
      setTestError(t('myWorkTable.connectorWizard.unexpectedError'));
    }
  }, [connectorType, configPayload, testConnection, isPl]);

  const handleAutoMap = useCallback(async () => {
    if (!sourceFields.length) return;
    setIsAutoMapping(true);
    try {
      const res = await autoMap({ id: '__preview__', sourceFields });
      if (res.mappings?.length) {
        setMappings(res.mappings);
        toast.success(t('myWorkTable.connectorWizard.fieldsAutoMapped'));
      }
    } catch {
      toast.error(t('myWorkTable.connectorWizard.autoMappingFailed'));
    } finally {
      setIsAutoMapping(false);
    }
  }, [sourceFields, autoMap, isPl]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1] ?? '';
      setConfig((prev) => ({ ...prev, fileData: base64, fileName: file.name }));
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!connectorType) return;
    try {
      await create({
        type: connectorType,
        name: name.trim(),
        tableId,
        config: configPayload,
        fieldMappings: mappings.filter((m) => m.targetField),
        schedule: scheduleEnabled ? { interval } : null,
        runNow,
      });
      toast.success(t('myWorkTable.connectorWizard.connectorCreated'));
      onCreated?.();
      onClose();
    } catch {
      toast.error(t('myWorkTable.connectorWizard.failedToCreateConnector'));
    }
  }, [
    connectorType,
    name,
    tableId,
    configPayload,
    mappings,
    scheduleEnabled,
    interval,
    runNow,
    create,
    onCreated,
    onClose,
    isPl,
  ]);

  const nextStep = () => setStep((s) => Math.min(s + 1, 5) as WizardStep);
  const prevStep = () => setStep((s) => Math.max(s - 1, 1) as WizardStep);

  /* ---- Render helpers ---- */

  const inputCls =
    'w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text placeholder-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus transition-colors';

  const labelCls = 'block text-xs font-medium text-c-text-muted mb-1';

  /* ================================================================ */
  /*  STEP 1 — Choose type                                            */
  /* ================================================================ */
  const renderStep1 = () => (
    <div className="grid grid-cols-2 gap-3">
      {CONNECTOR_TYPES.map((t) => {
        const meta = connectorMeta[t];
        const selected = connectorType === t;
        return (
          <button
            key={t}
            onClick={() => {
              setConnectorType(t);
              setConfig((prev) => ({ ...prev, type: t }));
            }}
            className={`
              flex flex-col items-center gap-2 rounded-xl border-2 p-5 transition-all
              ${
                selected
                  ? 'border-c-border bg-c-surface-raised shadow-sm'
                  : 'border-c-border-subtle hover:border-c-border-subtle bg-c-surface'
              }
            `}
          >
            <ConnectorIcon type={t} size={32} />
            <span className="text-sm font-semibold text-c-text">
              {isPl ? meta.labelPl : meta.labelEn}
            </span>
            <span className="text-xs text-c-text-muted text-center leading-tight">
              {isPl ? meta.descPl : meta.descEn}
            </span>
          </button>
        );
      })}
    </div>
  );

  /* ================================================================ */
  /*  STEP 2 — Configure connection                                   */
  /* ================================================================ */
  const renderStep2 = () => (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className={labelCls}>{t('myWorkTable.connectorWizard.connectorName')}</label>
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('myWorkTable.connectorWizard.eGCustomerImport')}
        />
      </div>

      {/* Type-specific fields */}
      {connectorType === 'csv' && (
        <div>
          <label className={labelCls}>{t('myWorkTable.connectorWizard.csvXlsxFile')}</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.tsv"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`${inputCls} flex items-center gap-2 cursor-pointer text-left`}
          >
            <Upload size={14} className="text-c-text-secondary" />
            <span className={fileName ? 'text-c-text' : 'text-c-text-secondary'}>
              {fileName || t('myWorkTable.connectorWizard.chooseFile')}
            </span>
          </button>
        </div>
      )}

      {connectorType === 'google_sheets' && (
        <>
          <div>
            <label className={labelCls}>{t('myWorkTable.connectorWizard.spreadsheetId', 'Spreadsheet ID')}</label>
            <input
              className={inputCls}
              value={config.spreadsheetId ?? ''}
              onChange={(e) => setConfig((p) => ({ ...p, spreadsheetId: e.target.value }))}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
            />
          </div>
          <div>
            <label className={labelCls}>{t('myWorkTable.connectorWizard.apiKey', 'API Key')}</label>
            <input
              className={inputCls}
              type="password"
              value={config.apiKey ?? ''}
              onChange={(e) => setConfig((p) => ({ ...p, apiKey: e.target.value }))}
              placeholder="AIza..."
            />
          </div>
          <div>
            <label className={labelCls}>{t('myWorkTable.connectorWizard.sheetName')}</label>
            <input
              className={inputCls}
              value={config.sheetName ?? ''}
              onChange={(e) => setConfig((p) => ({ ...p, sheetName: e.target.value }))}
              placeholder="Sheet1"
            />
          </div>
        </>
      )}

      {connectorType === 'airtable' && (
        <>
          <div>
            <label className={labelCls}>{t('myWorkTable.connectorWizard.baseId', 'Base ID')}</label>
            <input
              className={inputCls}
              value={config.baseId ?? ''}
              onChange={(e) => setConfig((p) => ({ ...p, baseId: e.target.value }))}
              placeholder="appXXXXXXXXXXXXXX"
            />
          </div>
          <div>
            <label className={labelCls}>{t('myWorkTable.connectorWizard.apiToken', 'API Token')}</label>
            <input
              className={inputCls}
              type="password"
              value={config.apiToken ?? ''}
              onChange={(e) => setConfig((p) => ({ ...p, apiToken: e.target.value }))}
              placeholder="pat..."
            />
          </div>
          <div>
            <label className={labelCls}>{t('myWorkTable.connectorWizard.tableName')}</label>
            <input
              className={inputCls}
              value={config.tableName ?? ''}
              onChange={(e) => setConfig((p) => ({ ...p, tableName: e.target.value }))}
              placeholder="Tasks"
            />
          </div>
        </>
      )}

      {connectorType === 'postgresql' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>{t('myWorkTable.connectorWizard.host', 'Host')}</label>
              <input
                className={inputCls}
                value={config.host ?? ''}
                onChange={(e) => setConfig((p) => ({ ...p, host: e.target.value }))}
                placeholder="db.example.com"
              />
            </div>
            <div>
              <label className={labelCls}>{t('myWorkTable.connectorWizard.port', 'Port')}</label>
              <input
                className={inputCls}
                type="number"
                value={config.port ?? 5432}
                onChange={(e) => setConfig((p) => ({ ...p, port: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('myWorkTable.connectorWizard.database', 'Database')}</label>
              <input
                className={inputCls}
                value={config.database ?? ''}
                onChange={(e) => setConfig((p) => ({ ...p, database: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>{t('myWorkTable.connectorWizard.schema', 'Schema')}</label>
              <input
                className={inputCls}
                value={config.schema ?? 'public'}
                onChange={(e) => setConfig((p) => ({ ...p, schema: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('myWorkTable.connectorWizard.user')}</label>
              <input
                className={inputCls}
                value={config.user ?? ''}
                onChange={(e) => setConfig((p) => ({ ...p, user: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>{t('myWorkTable.connectorWizard.password')}</label>
              <input
                className={inputCls}
                type="password"
                value={config.password ?? ''}
                onChange={(e) => setConfig((p) => ({ ...p, password: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>{t('myWorkTable.connectorWizard.tableOrSqlQuery')}</label>
            <input
              className={inputCls}
              value={config.tableOrQuery ?? ''}
              onChange={(e) => setConfig((p) => ({ ...p, tableOrQuery: e.target.value }))}
              placeholder="public.users  or  SELECT * FROM users WHERE active"
            />
          </div>
        </>
      )}

      {connectorType === 'jira' && (
        <>
          <div>
            <label className={labelCls}>{t('myWorkTable.connectorWizard.jiraDomain')}</label>
            <input
              className={inputCls}
              value={config.domain ?? ''}
              onChange={(e) => setConfig((p) => ({ ...p, domain: e.target.value }))}
              placeholder="mycompany (for mycompany.atlassian.net)"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('myWorkTable.connectorWizard.email', 'Email')}</label>
              <input
                className={inputCls}
                value={config.email ?? ''}
                onChange={(e) => setConfig((p) => ({ ...p, email: e.target.value }))}
                placeholder="user@company.com"
              />
            </div>
            <div>
              <label className={labelCls}>{t('myWorkTable.connectorWizard.apiToken', 'API Token')}</label>
              <input
                className={inputCls}
                type="password"
                value={config.jiraApiToken ?? ''}
                onChange={(e) => setConfig((p) => ({ ...p, jiraApiToken: e.target.value }))}
                placeholder="ATATT..."
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>{t('myWorkTable.connectorWizard.projectOptional')}</label>
            <input
              className={inputCls}
              value={config.project ?? ''}
              onChange={(e) => setConfig((p) => ({ ...p, project: e.target.value }))}
              placeholder="PROJ"
            />
          </div>
          <div>
            <label className={labelCls}>{t('myWorkTable.connectorWizard.jqlLabel', 'JQL ({{optional}})', { optional: t('myWorkTable.connectorWizard.optional') })}</label>
            <input
              className={inputCls}
              value={config.jql ?? ''}
              onChange={(e) => setConfig((p) => ({ ...p, jql: e.target.value }))}
              placeholder='project = "PROJ" AND status != Done ORDER BY created DESC'
            />
          </div>
        </>
      )}

      {connectorType === 'webhook' && (
        <div>
          <label className={labelCls}>
            {t('myWorkTable.connectorWizard.webhookSecretOptional')}
          </label>
          <input
            className={inputCls}
            type="password"
            value={config.webhookSecret ?? ''}
            onChange={(e) => setConfig((p) => ({ ...p, webhookSecret: e.target.value }))}
            placeholder={t('myWorkTable.connectorWizard.sharedSecretForValidation')}
          />
          <p className="mt-1 text-xs text-c-text-muted">
            {t('myWorkTable.connectorWizard.afterCreatingTheConnectorYou')}
          </p>
        </div>
      )}

      {/* Test connection */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleTestConnection}
          disabled={testStatus === 'testing'}
          className="inline-flex items-center gap-2 rounded-lg bg-c-surface-raised px-4 py-2 text-sm font-medium text-c-text-muted hover:bg-c-surface-raised transition-colors disabled:opacity-50"
        >
          {testStatus === 'testing' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Zap size={14} />
          )}
          {t('myWorkTable.connectorWizard.testConnection')}
        </button>
        {testStatus === 'success' && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-c-success">
            <Check size={14} /> {t('myWorkTable.connectorWizard.connected')}
            {sourceFields.length > 0 &&
              ` (${sourceFields.length} ${t('myWorkTable.connectorWizard.fields')})`}
          </span>
        )}
        {testStatus === 'failed' && <span className="text-xs text-danger-500">{testError}</span>}
      </div>
    </div>
  );

  /* ================================================================ */
  /*  STEP 3 — Map fields                                             */
  /* ================================================================ */
  const updateMapping = (idx: number, patch: Partial<FieldMapping>) => {
    setMappings((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };

  const renderStep3 = () => (
    <div className="space-y-4">
      {/* Auto-map button */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-c-text-muted">
          {sourceFields.length} {t('myWorkTable.connectorWizard.sourceFields')}
        </span>
        <button
          onClick={handleAutoMap}
          disabled={isAutoMapping}
          className="inline-flex items-center gap-1.5 rounded-lg bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text hover:bg-c-surface-raised/80 transition-colors disabled:opacity-50"
        >
          {isAutoMapping ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {t('myWorkTable.connectorWizard.autoMap')}
        </button>
      </div>

      {/* Mapping table */}
      <div className="rounded-xl border border-c-border-subtle overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 bg-c-surface-raised px-3 py-2 text-[11px] font-semibold text-c-text-muted uppercase tracking-wider">
          <div className="col-span-3">{t('myWorkTable.connectorWizard.source')}</div>
          <div className="col-span-1 text-center">{t('myWorkTable.connectorWizard.type')}</div>
          <div className="col-span-1 text-center">→</div>
          <div className="col-span-4">{t('myWorkTable.connectorWizard.target')}</div>
          <div className="col-span-3">{t('myWorkTable.connectorWizard.transform')}</div>
        </div>

        {/* Rows */}
        <div className="max-h-64 overflow-y-auto divide-y divide-c-border-subtle">
          {mappings.map((m, idx) => (
            <div
              key={m.sourceField}
              className="grid grid-cols-12 gap-2 items-center px-3 py-2 text-sm"
            >
              <div className="col-span-3 font-mono text-xs text-c-text-muted truncate">
                {m.sourceField}
              </div>
              <div className="col-span-1 text-center">
                {m.inferredType && (
                  <span className="inline-block rounded bg-c-surface-raised px-1.5 py-0.5 text-[10px] text-c-text-muted">
                    {m.inferredType}
                  </span>
                )}
              </div>
              <div className="col-span-1 text-center text-c-text-secondary">→</div>
              <div className="col-span-4">
                <select
                  className={`${inputCls} py-1.5 text-xs`}
                  value={m.targetField ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__new__') {
                      updateMapping(idx, { targetField: m.sourceField, createNew: true });
                    } else {
                      updateMapping(idx, { targetField: val || null, createNew: false });
                    }
                  }}
                >
                  <option value="">{t('myWorkTable.connectorWizard.skip')}</option>
                  {targetFields.map((tf) => (
                    <option key={tf} value={tf}>
                      {tf}
                    </option>
                  ))}
                  <option value="__new__">
                    + {t('myWorkTable.connectorWizard.createNewField')}
                  </option>
                </select>
              </div>
              <div className="col-span-3">
                <select
                  className={`${inputCls} py-1.5 text-xs`}
                  value={m.transform ?? ''}
                  onChange={(e) =>
                    updateMapping(idx, {
                      transform: (e.target.value || undefined) as FieldMapping['transform'],
                    })
                  }
                >
                  {TRANSFORMS.map((tr) => (
                    <option key={tr.value} value={tr.value}>
                      {isPl ? tr.labelPl : tr.labelEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {mappings.length === 0 && (
        <p className="text-center text-sm text-c-text-muted py-6">
          {t('myWorkTable.connectorWizard.testTheConnectionInThe')}
        </p>
      )}
    </div>
  );

  /* ================================================================ */
  /*  STEP 4 — Schedule                                               */
  /* ================================================================ */
  const nextRunLabel = useMemo(() => {
    if (!scheduleEnabled) return '';
    const found = INTERVALS.find((i) => i.value === interval);
    return found ? (isPl ? found.labelPl : found.labelEn) : '';
  }, [scheduleEnabled, interval, isPl]);

  const renderStep4 = () => (
    <div className="space-y-5">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-c-text">
            {t('myWorkTable.connectorWizard.automaticSync')}
          </p>
          <p className="text-xs text-c-text-muted">
            {t('myWorkTable.connectorWizard.runImportsAutomaticallyOnA')}
          </p>
        </div>
        <button
          onClick={() => setScheduleEnabled((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            scheduleEnabled ? 'bg-c-surface' : 'bg-c-surface-raised'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-c-surface shadow transition-transform ${
              scheduleEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {scheduleEnabled && (
        <>
          <div>
            <label className={labelCls}>{t('myWorkTable.connectorWizard.interval')}</label>
            <div className="relative">
              <select
                className={`${inputCls} appearance-none pr-8`}
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
              >
                {INTERVALS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {isPl ? i.labelPl : i.labelEn}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-c-text-secondary pointer-events-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-c-surface-raised px-3 py-2">
            <Clock size={14} className="text-c-text-secondary" />
            <span className="text-xs text-c-text-secondary">
              {t('myWorkTable.connectorWizard.nextRun')}
              {nextRunLabel}
            </span>
          </div>
        </>
      )}
    </div>
  );

  /* ================================================================ */
  /*  STEP 5 — Review & Create                                        */
  /* ================================================================ */
  const mappedCount = mappings.filter((m) => m.targetField).length;

  const renderStep5 = () => (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          label={t('myWorkTable.connectorWizard.type')}
          value={
            connectorType
              ? isPl
                ? connectorMeta[connectorType].labelPl
                : connectorMeta[connectorType].labelEn
              : '—'
          }
          icon={connectorType ? <ConnectorIcon type={connectorType} size={16} /> : undefined}
        />
        <SummaryCard label={t('myWorkTable.connectorWizard.name')} value={name || '—'} />
        <SummaryCard
          label={t('myWorkTable.connectorWizard.mappedFields')}
          value={`${mappedCount} / ${sourceFields.length}`}
        />
        <SummaryCard
          label={t('myWorkTable.connectorWizard.schedule')}
          value={
            scheduleEnabled
              ? (INTERVALS.find((i) => i.value === interval)?.[isPl ? 'labelPl' : 'labelEn'] ??
                interval)
              : t('myWorkTable.connectorWizard.disabled')
          }
        />
      </div>

      {/* Run now toggle */}
      <label className="flex items-center gap-3 rounded-lg border border-c-border-subtle p-3 cursor-pointer hover:bg-c-surface-raised transition-colors">
        <input
          type="checkbox"
          checked={runNow}
          onChange={(e) => setRunNow(e.target.checked)}
          className="h-4 w-4 rounded border-c-border-subtle text-c-focus-solid focus:ring-c-focus"
        />
        <div>
          <p className="text-sm font-medium text-c-text">
            {t('myWorkTable.connectorWizard.runNow')}
          </p>
          <p className="text-xs text-c-text-muted">
            {t('myWorkTable.connectorWizard.startImportingImmediatelyAfterCreation')}
          </p>
        </div>
      </label>
    </div>
  );

  /* ---- Step renderer ---- */
  const renderCurrentStep = () => {
    switch (step) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
    }
  };

  /* ---- Stepper ---- */
  const renderStepper = () => (
    <div className="flex items-center gap-1 mb-5">
      {steps.map((label, idx) => {
        const stepNum = (idx + 1) as WizardStep;
        const isActive = step === stepNum;
        const isDone = step > stepNum;
        return (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <div className={`flex-1 h-px ${isDone ? 'bg-c-surface' : 'bg-c-surface-raised'}`} />
            )}
            <button
              onClick={() => {
                if (isDone) setStep(stepNum);
              }}
              disabled={!isDone && !isActive}
              className={`
                flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors
                ${
                  isActive
                    ? 'bg-c-surface text-c-text'
                    : isDone
                      ? 'bg-c-surface-raised text-c-text-secondary cursor-pointer hover:bg-c-surface-raised/80'
                      : 'bg-c-surface-raised text-c-text-muted'
                }
              `}
            >
              {isDone ? <Check size={10} /> : <span>{stepNum}</span>}
              <span className="hidden sm:inline">{label}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );

  /* ---- Footer ---- */
  const footer = (
    <div className="flex items-center justify-between w-full">
      <button
        onClick={step === 1 ? onClose : prevStep}
        className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-c-text-muted hover:bg-c-surface-raised transition-colors"
      >
        {step === 1 ? (
          <>
            <X size={14} /> {t('myWorkTable.connectorWizard.cancel')}
          </>
        ) : (
          <>
            <ArrowLeft size={14} /> {t('myWorkTable.connectorWizard.back')}
          </>
        )}
      </button>

      {step < 5 ? (
        <button
          onClick={nextStep}
          disabled={!canProceed}
          className="inline-flex items-center gap-1.5 rounded-lg bg-c-text px-4 py-2 text-sm font-medium text-c-surface hover:opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('myWorkTable.connectorWizard.next')} <ArrowRight size={14} />
        </button>
      ) : (
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="inline-flex items-center gap-1.5 rounded-lg bg-c-text px-4 py-2 text-sm font-medium text-c-surface hover:opacity-90 transition-colors disabled:opacity-40"
        >
          {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {t('myWorkTable.connectorWizard.createConnector')}
        </button>
      )}
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('myWorkTable.connectorWizard.newDataConnector')}
      description={t('myWorkTable.connectorWizard.importDataFromAnExternal')}
      size="xl"
      footer={footer}
    >
      {renderStepper()}
      {renderCurrentStep()}
    </Modal>
  );
};

/* ------------------------------------------------------------------ */
/*  Summary card (Step 5)                                              */
/* ------------------------------------------------------------------ */

const SummaryCard: React.FC<{
  label: string;
  value: string;
  icon?: React.ReactNode;
}> = ({ label, value, icon }) => (
  <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-3">
    <p className="text-[11px] font-medium text-c-text-muted uppercase tracking-wider mb-1">
      {label}
    </p>
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-sm font-semibold text-c-text">{value}</span>
    </div>
  </div>
);

export default ConnectorWizard;
