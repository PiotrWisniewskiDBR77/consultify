export default DemoService;
declare namespace DemoService {
    function createDemoOrganization(templateId?: string, email?: string, language?: string): Promise<Object>;
    function seedDemoData(organizationId: string, templateId: string, language?: string): Promise<any>;
    function seedDefaultDemoData(organizationId: string, language?: string): Promise<any>;
    function isDemoOrg(organizationId: string): Promise<boolean>;
    function cleanupExpiredDemos(): Promise<number>;
    function getTemplates(): Promise<any[]>;
    function _applySeedData(organizationId: any, seedData: any): Promise<void>;
    function hasActiveDemoForEmail(email: string): Promise<boolean>;
}
//# sourceMappingURL=demoService.d.ts.map