// @ts-ignore
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Consultify API',
      version: '1.0.0',
      description: 'Enterprise SaaS API Documentation',
    },
    servers: [
      {
        url: 'http://localhost:3005/api',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./server/src/routes/*.js', './server/src/controllers/*.js'], // Path to the API docs
};

export const swaggerSpec = (swaggerJsdoc as any)(options);
