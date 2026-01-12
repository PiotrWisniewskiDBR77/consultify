declare module 'swagger-jsdoc' {
    interface SwaggerDefinition {
        openapi?: string;
        info?: {
            title?: string;
            version?: string;
            description?: string;
        };
        servers?: Array<{
            url?: string;
            description?: string;
        }>;
        components?: {
            securitySchemes?: Record<string, unknown>;
        };
        security?: Array<Record<string, string[]>>;
    }

    interface SwaggerOptions {
        definition: SwaggerDefinition;
        apis: string[];
    }

    function swaggerJsdoc(options: SwaggerOptions): unknown;
    export default swaggerJsdoc;
}
