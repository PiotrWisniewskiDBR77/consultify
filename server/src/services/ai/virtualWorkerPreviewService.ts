import { llmService } from './llmService.js';
import { modelRouter } from './modelRouter.js';
import { buildWorkerKnowledgeContext } from './virtualWorkerKnowledgeService.js';
import {
  getWorkerWithProfile,
  type VirtualWorker,
  type VirtualWorkerProfile,
  VirtualWorkerValidationError,
} from './virtualWorkerService.js';
import {
  buildWorkerWebAccessResult,
  type WorkerWebCitation,
} from './virtualWorkerWebAccessService.js';

export interface VirtualWorkerPreviewResult {
  worker: Pick<VirtualWorker, 'id' | 'slug' | 'name' | 'status' | 'surface' | 'locale_default'>;
  profile: Pick<VirtualWorkerProfile, 'id' | 'version' | 'system_prompt'>;
  answer: string;
  model: {
    id: string;
    provider: string;
  };
  responseMode: 'knowledge_pill_web' | 'knowledge_pill' | 'rag' | 'fallback';
  knowledgeSources: string[];
  matchedProducts: string[];
  primaryProducts: string[];
  usedPillIds: string[];
  usedPillSections: string[];
  webUsed: boolean;
  webCitations: WorkerWebCitation[];
  fallbackReason: string | null;
  knowledgeContextPreview: string;
}

function buildPreviewInstruction(args: {
  worker: VirtualWorker;
  profile: VirtualWorkerProfile;
  locale?: string;
  knowledgeContext: string;
  webInstructionAddon?: string;
}): string {
  const sections = [
    `You are previewing the virtual worker "${args.worker.name}" (${args.worker.slug}).`,
    'Follow the worker profile exactly, but stay conservative and factual.',
    'Use only the governed worker knowledge and governed web sources injected below.',
    'If the knowledge is insufficient, say so clearly instead of guessing.',
    'Keep the answer concise and operator-readable.',
    '',
    `Worker locale default: ${args.worker.locale_default}`,
    `Preview locale hint: ${String(args.locale || args.worker.locale_default || 'en')}`,
    '',
    '## ACTIVE WORKER PROFILE',
    String(args.profile.system_prompt || '').trim(),
    '',
    '## GOVERNED WORKER KNOWLEDGE',
    args.knowledgeContext,
  ];

  if (args.webInstructionAddon?.trim()) {
    sections.push('', args.webInstructionAddon.trim());
  }

  return sections.join('\n');
}

export async function previewVirtualWorkerResponse(args: {
  workerIdOrSlug: string;
  message: string;
  locale?: string;
  userEnabledWebSearch?: boolean;
}): Promise<VirtualWorkerPreviewResult> {
  const workerConfig = await getWorkerWithProfile(args.workerIdOrSlug);
  if (!workerConfig?.worker || !workerConfig.profile) {
    throw new VirtualWorkerValidationError(
      'Worker preview requires an existing worker with an active profile',
      'VW_PREVIEW_WORKER_NOT_READY'
    );
  }

  const worker = workerConfig.worker;
  const profile = workerConfig.profile;
  const message = String(args.message || '').trim();
  if (!message) {
    throw new VirtualWorkerValidationError(
      'Preview message is required',
      'VW_PREVIEW_MESSAGE_REQUIRED'
    );
  }

  const knowledge = await buildWorkerKnowledgeContext({
    workerSlug: worker.slug,
    query: message,
    locale: args.locale || worker.locale_default,
    limit: 6,
  });

  const workerWeb = await buildWorkerWebAccessResult({
    workerSlug: worker.slug,
    profile,
    message,
    locale: args.locale || worker.locale_default,
    historyLength: 0,
    userEnabledWebSearch: args.userEnabledWebSearch,
  });

  const systemPrompt = buildPreviewInstruction({
    worker,
    profile,
    locale: args.locale,
    knowledgeContext: knowledge.contextText,
    webInstructionAddon: workerWeb.used ? workerWeb.systemInstructionAddon : '',
  });

  const modelCfg = await modelRouter.select({
    capability: 'chat_confirm',
    tier: 'BUDGET',
  } as any);

  const result = (await llmService.callText({
    type: 'chat',
    modelConfig: {
      provider: modelCfg.provider,
      id: modelCfg.id,
      endpoint: (modelCfg as any).endpoint,
      apiKey: (modelCfg as any).apiKey,
    },
    systemPrompt,
    messages: [{ role: 'user', content: message }],
    timeoutMs: 15000,
    breakerOptions: {
      retryAttempts: 1,
      retryBaseDelay: 250,
      retryMaxDelay: 1000,
    },
  } as any)) as any;

  const responseMode: VirtualWorkerPreviewResult['responseMode'] = workerWeb.used
    ? 'knowledge_pill_web'
    : knowledge.usedPillIds.length > 0
      ? 'knowledge_pill'
      : knowledge.sources.length > 0
        ? 'rag'
        : 'fallback';

  return {
    worker: {
      id: worker.id,
      slug: worker.slug,
      name: worker.name,
      status: worker.status,
      surface: worker.surface,
      locale_default: worker.locale_default,
    },
    profile: {
      id: profile.id,
      version: profile.version,
      system_prompt: profile.system_prompt,
    },
    answer: String(result?.content || '').trim(),
    model: {
      id: String(modelCfg.id || 'unknown'),
      provider: String(modelCfg.provider || 'unknown'),
    },
    responseMode,
    knowledgeSources: knowledge.sources,
    matchedProducts: knowledge.matchedProducts,
    primaryProducts: knowledge.primaryProducts,
    usedPillIds: knowledge.usedPillIds,
    usedPillSections: knowledge.usedPillSections,
    webUsed: workerWeb.used,
    webCitations: workerWeb.citations,
    fallbackReason: knowledge.fallbackReason || null,
    knowledgeContextPreview: knowledge.contextText,
  };
}

export default {
  previewVirtualWorkerResponse,
};
