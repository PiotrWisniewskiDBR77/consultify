export default ConnectorService;
declare namespace ConnectorService {
    function setDependencies(newDeps?: {}): void;
    function getCatalog(): Promise<Object[]>;
    function getOrgConfigs(orgId: string): Promise<Object[]>;
    function connect(orgId: string, connectorKey: string, secrets: Object, scopes?: string[], options?: Object): Promise<Object>;
    function disconnect(orgId: string, connectorKey: string, disconnectedBy: string): Promise<boolean>;
    function updateSecret(orgId: string, connectorKey: string, secrets: Object, updatedBy: string): Promise<boolean>;
    function getSecrets(orgId: string, connectorKey: string): Promise<Object | null>;
    function getConfig(orgId: string, connectorKey: string): Promise<Object | null>;
}
//# sourceMappingURL=connectorService.d.ts.map