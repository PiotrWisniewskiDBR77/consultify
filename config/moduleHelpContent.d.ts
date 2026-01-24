/**
 * Module Help Content
 *
 * Contains comprehensive documentation for all application modules.
 * Used by HelpSidePanel to display module overviews in the "Przegląd" tab.
 */
import { HelpModuleId } from './viewToModuleMapping';
export type { HelpModuleId };
export interface ModuleHelp {
  id: HelpModuleId;
  icon: string;
  targetAudience: ('user' | 'admin' | 'superadmin')[];
  relatedModules: HelpModuleId[];
  translationKey: string;
  name?: {
    en: string;
    pl: string;
  };
  description?: {
    en: string;
    pl: string;
  };
}
export declare const MODULE_HELP_CONTENT: Record<HelpModuleId, ModuleHelp>;
/**
 * Get help content for a specific module
 */
export declare function getModuleHelp(moduleId: HelpModuleId): ModuleHelp | undefined;
export default MODULE_HELP_CONTENT;
//# sourceMappingURL=moduleHelpContent.d.ts.map
