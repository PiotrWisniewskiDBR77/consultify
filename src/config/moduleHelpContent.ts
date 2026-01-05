export type HelpModuleId = string;

export interface ModuleHelp {
  id: HelpModuleId;
  title: string;
  description: string;
  content: string;
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

