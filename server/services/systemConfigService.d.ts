export default systemConfigServiceInstance;
declare const systemConfigServiceInstance: SystemConfigService;
declare class SystemConfigService {
    /**
     * Get configuration value by key
     */
    getConfig(key: any, environment?: null): Promise<any>;
    /**
     * Get all configurations
     */
    getAllConfigs(environment?: null): Promise<any>;
    /**
     * Set configuration value
     */
    setConfig(configData: any): Promise<any>;
    /**
     * Delete configuration
     */
    deleteConfig(key: any, environment?: null): Promise<any>;
    /**
     * Get configuration as typed value
     */
    getConfigValue(key: any, defaultValue?: null, environment?: null): Promise<any>;
}
//# sourceMappingURL=systemConfigService.d.ts.map