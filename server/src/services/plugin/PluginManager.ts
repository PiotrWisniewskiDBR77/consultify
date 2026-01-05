import logger from '../../utils/Logger.js';
import { IPlugin } from './IPlugin.js';

export class PluginManager {
    private static instance: PluginManager;
    private plugins: Map<string, IPlugin> = new Map();
    private context: any = {}; // Shared context passed to plugins

    private constructor() {}

    static getInstance(): PluginManager {
        if (!PluginManager.instance) {
            PluginManager.instance = new PluginManager();
        }
        return PluginManager.instance;
    }

    register(plugin: IPlugin): void {
        if (this.plugins.has(plugin.name)) {
            logger.warn(`Plugin ${plugin.name} is already registered. Overwriting.`);
        }
        this.plugins.set(plugin.name, plugin);
        logger.info(`Plugin registered: ${plugin.name} v${plugin.version}`);
    }

    async initAll(context: any): Promise<void> {
        this.context = context;
        logger.info('Initializing plugins...');
        for (const [name, plugin] of this.plugins) {
            try {
                logger.info(`Initializing plugin: ${name}`);
                await plugin.init(this.context);
                logger.info(`Plugin initialized: ${name}`);
            } catch (error) {
                logger.error(`Failed to initialize plugin ${name}:`, error);
                throw error; // Fail fast or continue? Fail fast for now
            }
        }
    }

    get(name: string): IPlugin | undefined {
        return this.plugins.get(name);
    }

    list(): string[] {
        return Array.from(this.plugins.keys());
    }
}

export default PluginManager.getInstance();
