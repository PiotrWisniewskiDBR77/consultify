export default EmailTemplateService;
declare namespace EmailTemplateService {
    function getTemplates(category?: null, activeOnly?: boolean): Promise<any>;
    function getTemplate(templateKey: any): Promise<any>;
    function createTemplate(templateData: any): Promise<any>;
    function updateTemplate(templateKey: any, updates: any): Promise<any>;
}
//# sourceMappingURL=emailTemplateService.d.ts.map