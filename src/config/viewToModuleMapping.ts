export interface ViewHelpMapping {
  moduleId: string;
  cardId?: string;
}

export type HelpModuleId = string;

export function getHelpMapping(viewId: string): ViewHelpMapping {
  return {
    moduleId: 'welcome',
  };
}
