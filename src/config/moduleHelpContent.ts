export type HelpModuleId = string;

export interface ModuleHelp {
  id: HelpModuleId;
  name?: string | { pl?: string; en?: string };
  title: string;
  description: string;
  content: string;
  icon?: string;
  translationKey?: string;
  relatedModules?: string[];
  targetAudience?: any[];
}

export const MODULE_HELP_CONTENT: Record<HelpModuleId, ModuleHelp> = {
  'welcome': {
    id: 'welcome',
    title: 'Welcome',
    description: 'Welcome to Consultify',
    content: 'Welcome to Consultify help center.'
  }
};

export function getModuleHelp(id: HelpModuleId): ModuleHelp | null {
  return MODULE_HELP_CONTENT[id] || null;
}

